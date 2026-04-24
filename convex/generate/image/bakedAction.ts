// Single-image baked-text generation (replaces composite.ts / satori overlay).
//
// Given a single-image draft with a ready base asset, calls gpt-image-2 with
// a merged scene + Arabic caption + brand-chrome prompt so the model produces
// the final publishable slide in one shot. Inserted asset carries
// `overlaidFrom = base._id` so `firstReadyByDraft` prefers it over the base,
// mirroring how the old satori composite worked from the UI's perspective.

import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { action } from "../../_generated/server";
import { requireUser } from "../../lib/requireUser";
import { callImageProvider, type ImageProvider, type ImageProviderEnv } from "./providers";

const BAKED_MODEL = "gpt-image-2";
const BAKED_PROVIDER: ImageProvider = "gpt-image";

type BakedResult =
	| { ok: true; assetId: Id<"mediaAssets">; cost: number; model: string }
	| { ok: false; error: string };

function buildBakedPrompt(input: { ar: string; channel: string; baseScenePrompt: string }): string {
	return [
		"Produce a single square 1080x1080 Instagram-ready slide.",
		"",
		"Scene (covers the middle of the image, roughly y=120 to y=820):",
		input.baseScenePrompt,
		"",
		"Text overlays — render all four EXACTLY as specified, preserving every character literally:",
		"",
		`1. Top-left chip (x=40..280, y=24..56), JetBrains-Mono uppercase, ~20px, warm off-white 70% opacity:`,
		`   BANNAA · ${input.channel.toUpperCase()}`,
		"",
		`2. Top-right chip (x=1000..1060, y=24..56), JetBrains-Mono uppercase, ~20px, warm off-white 70% opacity:`,
		`   AR`,
		"",
		`3. Arabic caption block (x=60..1020, y=720..880), right-aligned RTL, Cairo-style bold display, ~64px, color #fff8ec with a soft dark drop-shadow for legibility. Render the Arabic text glyph-for-glyph verbatim — do NOT paraphrase, translate, or omit characters:`,
		`   ${input.ar}`,
		"",
		`4. Bottom-left footer (x=48..320, y=940..976), JetBrains-Mono ~22px, warm off-white 75% opacity:`,
		`   ⎯ bannaa.co`,
		"",
		"Add a subtle bottom-to-top dark gradient (rgba(0,0,0,0.65) at y=1080 → rgba(0,0,0,0) at y=600) behind the Arabic block so the letters stay legible regardless of what the scene is.",
		"",
		"Do not add any extra text, captions, or UI chrome beyond the four items above.",
	].join("\n");
}

export const bakedForDraft = action({
	args: { draftId: v.id("drafts") },
	returns: v.union(
		v.object({
			ok: v.literal(true),
			assetId: v.id("mediaAssets"),
			cost: v.number(),
			model: v.string(),
		}),
		v.object({ ok: v.literal(false), error: v.string() }),
	),
	handler: async (ctx, { draftId }): Promise<BakedResult> => {
		await requireUser(ctx);

		const env: ImageProviderEnv = {
			GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
			OPENAI_API_KEY: process.env.OPENAI_API_KEY,
			GROK_API_KEY: process.env.GROK_API_KEY,
			IDEOGRAM_API_KEY: process.env.IDEOGRAM_API_KEY,
			OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
			OPENROUTER_IMAGE_MODEL: process.env.OPENROUTER_IMAGE_MODEL,
		};

		const loaded: { draft: Doc<"drafts">; analysis: Doc<"analyses"> } | null = await ctx.runQuery(
			internal.generate.image.internal.loadDraftWithAnalysis,
			{ id: draftId },
		);
		if (!loaded) return { ok: false, error: "draft or analysis not found" };
		const { draft } = loaded;

		const base: Doc<"mediaAssets"> | null = await ctx.runQuery(
			internal.mediaAssets.list.firstBaseReady,
			{ draftId },
		);
		if (!base) return { ok: false, error: "no ready base image" };

		const prompt = buildBakedPrompt({
			ar: draft.ar,
			channel: draft.channel,
			baseScenePrompt: base.prompt,
		});

		try {
			const result = await callImageProvider({
				provider: BAKED_PROVIDER,
				prompt,
				model: BAKED_MODEL,
				env,
			});
			const blob = new Blob([result.bytes as BlobPart], { type: "image/png" });
			const storageId: Id<"_storage"> = await ctx.storage.store(blob);

			const runId: Id<"providerRuns"> = await ctx.runMutation(
				internal.generate.image.internal.recordImageRun,
				{
					provider: BAKED_PROVIDER,
					model: BAKED_MODEL,
					purpose: "bake-single-image",
					cost: result.cost,
				},
			);

			const assetId: Id<"mediaAssets"> = await ctx.runMutation(
				internal.generate.image.internal.insertBakedAsset,
				{
					draftId,
					overlaidFrom: base._id,
					storageId,
					width: result.width,
					height: result.height,
					provider: BAKED_PROVIDER,
					model: BAKED_MODEL,
					prompt,
					orderIndex: 0,
					genRunId: runId,
				},
			);

			return { ok: true, assetId, cost: result.cost, model: BAKED_MODEL };
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`[bakedForDraft] failed: ${msg}`);
			await ctx.runMutation(internal.generate.image.internal.recordImageRun, {
				provider: BAKED_PROVIDER,
				model: BAKED_MODEL,
				purpose: "bake-single-image",
				cost: 0,
				error: msg,
			});
			return { ok: false, error: msg };
		}
	},
});

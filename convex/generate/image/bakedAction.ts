// Single-image baked-text generation (replaces composite.ts / satori overlay).
//
// Given a single-image draft with a ready base asset, calls gpt-image-2 with
// a merged scene + selected-language caption + brand-chrome prompt so the model produces
// the final publishable slide in one shot. Inserted asset carries
// `overlaidFrom = base._id` so `firstReadyByDraft` prefers it over the base,
// mirroring how the old satori composite worked from the UI's perspective.

import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { action } from "../../_generated/server";
import { defaultBrandInput } from "../../brand/defaults";
import { LANG_LABELS, type OutputLanguage } from "../languages";
import { requireUser } from "../../lib/requireUser";
import { callImageProvider, type ImageProvider, type ImageProviderEnv } from "./providers";

const BAKED_MODEL = "gpt-image-2";
const BAKED_PROVIDER: ImageProvider = "gpt-image";
export const BAKED_PROMPT_VERSION = "2026-04-24-b";

type BakedResult =
	| { ok: true; assetId: Id<"mediaAssets">; cost: number; model: string }
	| { ok: false; error: string };

function buildBakedPrompt(input: {
	text: string;
	languageLabel: string;
	channel: string;
	baseScenePrompt: string;
	brand: Pick<Doc<"brands">, "design">;
}): string {
	const design = input.brand.design;
	const chipCorner = design.layout.chipPosition === "top-left" ? "Top-left" : "Top-right";
	const footerCorner = design.layout.footerPosition === "bottom-left" ? "Bottom-left" : "Bottom-right";
	return [
		"Produce a single square 1080x1080 Instagram-ready slide.",
		"",
		"Scene (covers the middle of the image, roughly y=120 to y=820):",
		input.baseScenePrompt,
		"",
		"Text overlays — render all four EXACTLY as specified, preserving every character literally:",
		"",
		`1. ${chipCorner} chip, ${design.typography.mono} uppercase, ~20px, ${design.palette.background} at 70% opacity, margin ${design.layout.margins}px:`,
		`   ${design.logoChipText} · ${input.channel.toUpperCase()}`,
		"",
		`2. Opposite top chip, ${design.typography.mono} uppercase, ~20px, ${design.palette.background} at 70% opacity:`,
		`   ${input.languageLabel}`,
		"",
		`3. ${input.languageLabel} caption block (x=60..1020, y=720..880), visually aligned for the selected language, ${design.typography.heading} bold display, ~64px, color ${design.palette.background} with a soft dark drop-shadow for legibility. Render the text glyph-for-glyph verbatim — do NOT paraphrase, translate, or omit characters:`,
		`   ${input.text}`,
		"",
		`4. ${footerCorner} footer, ${design.typography.mono} ~22px, ${design.palette.background} at 75% opacity, margin ${design.layout.margins}px:`,
		`   ⎯ ${design.footerText}`,
		"",
		"Add a subtle bottom-to-top dark gradient (rgba(0,0,0,0.65) at y=1080 → rgba(0,0,0,0) at y=600) behind the caption block so the letters stay legible regardless of what the scene is.",
		"",
		"Do not add any extra text, captions, or UI chrome beyond the four items above.",
	].join("\n");
}

export const bakedForDraft = action({
	args: {
		draftId: v.id("drafts"),
		targetLang: v.optional(
			v.union(v.literal("en"), v.literal("ar-khaleeji"), v.literal("ar-msa"), v.literal("ar-levantine")),
		),
	},
	returns: v.union(
		v.object({
			ok: v.literal(true),
			assetId: v.id("mediaAssets"),
			cost: v.number(),
			model: v.string(),
		}),
		v.object({ ok: v.literal(false), error: v.string() }),
	),
	handler: async (ctx, { draftId, targetLang }): Promise<BakedResult> => {
		await requireUser(ctx);

		const env: ImageProviderEnv = {
			GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
			OPENAI_API_KEY: process.env.OPENAI_API_KEY,
			GROK_API_KEY: process.env.GROK_API_KEY,
			IDEOGRAM_API_KEY: process.env.IDEOGRAM_API_KEY,
			OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
			OPENROUTER_IMAGE_MODEL: process.env.OPENROUTER_IMAGE_MODEL,
		};
		const activeBrand = await ctx.runQuery(internal.brand.doc.getActiveInternal, {});
		const brand = activeBrand ?? defaultBrandInput(Date.now());

		const loaded: { draft: Doc<"drafts">; analysis: Doc<"analyses"> } | null = await ctx.runQuery(
			internal.generate.image.internal.loadDraftWithAnalysis,
			{ id: draftId },
		);
		if (!loaded) return { ok: false, error: "draft or analysis not found" };
		const { draft, analysis } = loaded;

		const base: Doc<"mediaAssets"> | null = await ctx.runQuery(
			internal.mediaAssets.list.firstBaseReady,
			{ draftId },
		);
		if (!base) return { ok: false, error: "no ready base image" };

		const prompt = buildBakedPrompt({
			text: textForLanguage(draft, targetLang ?? "ar-khaleeji"),
			languageLabel: LANG_LABELS[targetLang ?? "ar-khaleeji"],
			channel: draft.channel,
			baseScenePrompt: base.prompt,
			brand,
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
					sourceItemId: analysis.itemId,
					brandVersion: brand.version,
					promptVersion: BAKED_PROMPT_VERSION,
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
				sourceItemId: analysis.itemId,
				brandVersion: brand.version,
				promptVersion: BAKED_PROMPT_VERSION,
			});
			return { ok: false, error: msg };
		}
	},
});

function textForLanguage(draft: Doc<"drafts">, lang: OutputLanguage): string {
	if (lang === "en") return draft.primary;
	const translation = draft.translations?.find((t) => t.lang === lang);
	if (translation) return translation.text;
	throw new Error(`No ${lang} copy exists for this draft`);
}

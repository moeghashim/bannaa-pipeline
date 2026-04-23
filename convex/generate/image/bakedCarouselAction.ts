// Baked-text carousel generation (Phase 2 · B.4-B, A/B vs HyperFrames).
//
// For each ready base asset, calls gpt-image-2 with a merged prompt — the
// original scene instructions + the Arabic caption + explicit chrome layout
// — so the model renders the final slide with text baked in, skipping
// satori. Inserted assets carry `overlaidFrom = base._id` so slidesForDraft
// treats them as composites (preferred over the base), and provider is
// `"gpt-image"` (not `"hyperframes"`) so the UI can tell satori composites
// and baked variants apart for A/B review.

import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { action } from "../../_generated/server";
import { requireUser } from "../../lib/requireUser";
import { callImageProvider, type ImageProvider, type ImageProviderEnv } from "./providers";

const BAKED_MODEL = "gpt-image-2";
const BAKED_PROVIDER: ImageProvider = "gpt-image";

type BakedResult =
	| { ok: true; generated: number; failed: number; totalCost: number; model: string }
	| { ok: false; error: string };

function buildBakedSlidePrompt(input: {
	styleAnchor: string;
	slidePrompt: string;
	ar: string;
	slideIndex: number;
	slideTotal: number;
}): string {
	return [
		input.styleAnchor,
		input.slidePrompt,
		"Square 1080x1080 composition.",
		"",
		"Render the following short Arabic sentence as visible text, bottom-right, right-aligned, bright warm off-white (#fff8ec), Cairo-style modern Arabic display font at ~64px, fontWeight 600, soft dark drop-shadow for legibility. The text MUST be rendered accurately glyph-for-glyph — do NOT paraphrase, translate, or improvise characters. Preserve every letter, harakat, and punctuation mark exactly as provided.",
		`Arabic text to render verbatim (RTL): ${input.ar}`,
		"",
		`Top-left chip: render the uppercase monospace label "BANNAA · IG" in small letters (~20px), warm off-white at 70% opacity, JetBrains Mono style.`,
		`Top-right chip: render the uppercase monospace label "${input.slideIndex}/${input.slideTotal}" in small letters (~20px), warm off-white at 70% opacity, JetBrains Mono style.`,
		`Bottom-left footer: render "⎯ bannaa.co" in small monospace (~22px), warm off-white at 75% opacity, JetBrains Mono style.`,
		"",
		"Add a subtle bottom-to-top dark gradient overlay behind the AR text block so the letters stay readable against whatever scene is underneath.",
	].join("\n");
}

export const bakedCarouselForDraft = action({
	args: { draftId: v.id("drafts") },
	returns: v.union(
		v.object({
			ok: v.literal(true),
			generated: v.number(),
			failed: v.number(),
			totalCost: v.number(),
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

		const loaded: {
			draft: Doc<"drafts">;
			slides: Doc<"carouselSlides">[];
			baseAssets: Doc<"mediaAssets">[];
		} | null = await ctx.runQuery(internal.generate.carouselInternal.loadCarouselForOverlay, { draftId });
		if (!loaded) return { ok: false, error: "carousel draft not found" };
		const { draft, slides, baseAssets } = loaded;

		if (draft.mediaKind !== "carousel") return { ok: false, error: "draft is not a carousel" };
		if (baseAssets.length === 0) return { ok: false, error: "no ready base images" };

		const slidesByIndex = new Map<number, Doc<"carouselSlides">>();
		for (const s of slides) slidesByIndex.set(s.orderIndex, s);

		const slideTotal = Math.max(slides.length, baseAssets.length);
		const styleAnchor = draft.styleAnchor ?? "";

		let generated = 0;
		let failed = 0;
		let totalCost = 0;

		for (const base of baseAssets) {
			const slide = slidesByIndex.get(base.orderIndex);
			if (!slide) {
				failed += 1;
				continue;
			}

			const prompt = buildBakedSlidePrompt({
				styleAnchor,
				slidePrompt: slide.imagePrompt,
				ar: slide.ar,
				slideIndex: base.orderIndex,
				slideTotal,
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
						purpose: "bake-carousel-slide",
						cost: result.cost,
					},
				);
				totalCost += result.cost;

				await ctx.runMutation(internal.generate.image.internal.insertBakedAsset, {
					draftId,
					overlaidFrom: base._id,
					storageId,
					width: result.width,
					height: result.height,
					provider: BAKED_PROVIDER,
					model: BAKED_MODEL,
					prompt,
					orderIndex: base.orderIndex,
					genRunId: runId,
				});
				generated += 1;
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				console.error(`[bakedCarouselForDraft] slide ${base.orderIndex} failed: ${msg}`);
				await ctx.runMutation(internal.generate.image.internal.recordImageRun, {
					provider: BAKED_PROVIDER,
					model: BAKED_MODEL,
					purpose: "bake-carousel-slide",
					cost: 0,
					error: msg,
				});
				failed += 1;
			}
		}

		return { ok: true, generated, failed, totalCost, model: BAKED_MODEL };
	},
});

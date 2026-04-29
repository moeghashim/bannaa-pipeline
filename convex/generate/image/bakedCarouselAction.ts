// Baked-text carousel generation (Phase 2 · B.4).
//
// For each ready base asset, calls the image-edit endpoint with the base PNG
// + a text+chrome prompt so the model bakes the caption / logo chip / slide
// counter / footer directly on top of the *actual* base image. Inserted
// assets carry `overlaidFrom = base._id` so slidesForDraft prefers them
// over the bare base.
//
// This used to re-generate the scene from scratch via /v1/images/generations
// — that produced an inconsistent visual under the text and doubled the
// scene-roll cost. Switching to /v1/images/edits keeps the underlying
// composition pixel-locked to whatever the operator approved as the base.
//
// Provider stays gpt-image (the only edit-capable + Arabic-fluent backend
// today). The MODEL is operator-tunable via settings.overlayModel so we
// can roll forward (gpt-image-2 → gpt-image-3) without a deploy.

import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { action } from "../../_generated/server";
import { defaultBrandInput } from "../../brand/defaults";
import { requireUser } from "../../lib/requireUser";
import { LANG_LABELS, type OutputLanguage } from "../languages";
import { callImageProviderEdit, type ImageProvider, type ImageProviderEnv } from "./providers";

const BAKED_PROVIDER: ImageProvider = "gpt-image";
const BAKED_MODEL_DEFAULT = "gpt-image-2";
export const BAKED_PROMPT_VERSION = "2026-04-29-c";

type BakedResult =
	| { ok: true; generated: number; failed: number; totalCost: number; model: string }
	| { ok: false; error: string };

function buildBakedSlidePrompt(input: {
	text: string;
	languageLabel: string;
	slideIndex: number;
	slideTotal: number;
	brand: Pick<Doc<"brands">, "design">;
}): string {
	const design = input.brand.design;
	// Edit-mode prompt: the model already sees the base PNG via the multipart
	// `image` field, so the prompt does NOT redescribe the scene. Instead we
	// tell it to preserve the underlying image and bake text + chrome on top.
	return [
		"Edit this image. Preserve the entire underlying scene exactly — do not regenerate, recolor, recompose, or alter the existing illustration. Only add the text overlays, chip marks, footer, and gradient described below.",
		"",
		`Caption: render this short ${input.languageLabel} sentence as visible text in the bottom-right area, aligned for the selected language, bright warm off-white (${design.palette.background}), ${design.typography.heading} display font at ~64px, fontWeight 600, with a soft dark drop-shadow for legibility. Render glyph-for-glyph verbatim — do NOT paraphrase, translate, omit, or improvise characters. Preserve every letter, mark, and punctuation exactly as provided.`,
		`Text to render verbatim (${input.languageLabel}): ${input.text}`,
		"",
		`Top-left chip: uppercase monospace label "${design.logoChipText} · IG" in small letters (~20px), ${design.palette.background} at 70% opacity, ${design.typography.mono} style.`,
		`Top-right chip: uppercase monospace label "${input.slideIndex}/${input.slideTotal}" in small letters (~20px), ${design.palette.background} at 70% opacity, ${design.typography.mono} style.`,
		`Bottom-left footer: "⎯ ${design.footerText}" in small monospace (~22px), ${design.palette.background} at 75% opacity, ${design.typography.mono} style.`,
		"",
		"Add a subtle bottom-to-top dark gradient overlay behind the caption block so the letters stay readable against whatever scene is underneath.",
		"",
		"Output: same square composition as the input image, with only the additions above. Do not add any other text, captions, or UI chrome beyond the four items specified.",
	].join("\n");
}

export const bakedCarouselForDraft = action({
	args: {
		draftId: v.id("drafts"),
		targetLang: v.optional(
			v.union(v.literal("en"), v.literal("ar-khaleeji"), v.literal("ar-msa"), v.literal("ar-levantine")),
		),
	},
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

		// Operator-tunable model — falls through to the hardcoded baseline if
		// settings have not been touched. Provider stays fixed (see file
		// header for why).
		const settings: Doc<"settings"> | null = await ctx.runQuery(internal.settings.doc.getInternal, {});
		const model = settings?.overlayModel ?? BAKED_MODEL_DEFAULT;

		const loaded: {
			draft: Doc<"drafts">;
			analysis: Doc<"analyses">;
			slides: Doc<"carouselSlides">[];
			baseAssets: Doc<"mediaAssets">[];
		} | null = await ctx.runQuery(internal.generate.carouselInternal.loadCarouselForOverlay, { draftId });
		if (!loaded) return { ok: false, error: "carousel draft not found" };
		const { draft, analysis, slides, baseAssets } = loaded;

		if (draft.mediaKind !== "carousel") return { ok: false, error: "draft is not a carousel" };
		if (baseAssets.length === 0) return { ok: false, error: "no ready base images" };

		const slidesByIndex = new Map<number, Doc<"carouselSlides">>();
		for (const s of slides) slidesByIndex.set(s.orderIndex, s);

		const slideTotal = Math.max(slides.length, baseAssets.length);

		let generated = 0;
		let failed = 0;
		let totalCost = 0;

		for (const base of baseAssets) {
			const slide = slidesByIndex.get(base.orderIndex);
			if (!slide) {
				failed += 1;
				continue;
			}
			if (!base.storageId) {
				console.error(`[bakedCarouselForDraft] slide ${base.orderIndex} base has no storageId`);
				failed += 1;
				continue;
			}

			const prompt = buildBakedSlidePrompt({
				text: slideTextForLanguage(slide, targetLang ?? "ar-khaleeji"),
				languageLabel: LANG_LABELS[targetLang ?? "ar-khaleeji"],
				slideIndex: base.orderIndex,
				slideTotal,
				brand,
			});

			try {
				// Pull the base PNG from storage so the edit endpoint operates
				// on the exact bytes the operator approved as the base — this
				// is the whole point of the edit-vs-regenerate switch.
				const baseBlob = await ctx.storage.get(base.storageId);
				if (!baseBlob) throw new Error(`base storage blob missing for slide ${base.orderIndex}`);
				const baseBytes = new Uint8Array(await baseBlob.arrayBuffer());

				const result = await callImageProviderEdit({
					provider: BAKED_PROVIDER,
					prompt,
					model,
					env,
					inputImage: baseBytes,
				});
				const blob = new Blob([result.bytes as BlobPart], { type: "image/png" });
				const storageId: Id<"_storage"> = await ctx.storage.store(blob);

				const runId: Id<"providerRuns"> = await ctx.runMutation(
					internal.generate.image.internal.recordImageRun,
					{
						provider: BAKED_PROVIDER,
						model,
						purpose: "bake-carousel-slide",
						cost: result.cost,
						sourceItemId: analysis.itemId,
						brandVersion: brand.version,
						promptVersion: BAKED_PROMPT_VERSION,
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
					model,
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
					model,
					purpose: "bake-carousel-slide",
					cost: 0,
					error: msg,
					sourceItemId: analysis.itemId,
					brandVersion: brand.version,
					promptVersion: BAKED_PROMPT_VERSION,
				});
				failed += 1;
			}
		}

		return { ok: true, generated, failed, totalCost, model };
	},
});

function slideTextForLanguage(slide: Doc<"carouselSlides">, lang: OutputLanguage): string {
	if (lang === "en") return slide.primary;
	const translation = slide.translations?.find((t) => t.lang === lang);
	if (translation) return translation.text;
	throw new Error(`No ${lang} copy exists for carousel slide ${slide.orderIndex}`);
}

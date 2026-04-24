// Carousel base-image generation (Phase 2 · B.3).
//
// Given a carousel draft, loops through its carouselSlides rows and generates
// one base image per slide using the shared styleAnchor + per-slide
// imagePrompt. Generations run sequentially to respect Convex action time
// budgets and common provider rate limits. Partial failures are tolerated:
// a failed slide is marked `state: "failed"` but the loop keeps going so a
// single rate-limit spike doesn't wipe out the whole carousel.

import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { action } from "../../_generated/server";
import { defaultBrandInput } from "../../brand/defaults";
import { requireUser } from "../../lib/requireUser";
import { IMAGE_PROMPT_VERSION } from "./prompts";
import { callImageProvider, defaultImageModel, type ImageProvider, type ImageProviderEnv } from "./providers";

const imageProviderValidator = v.union(
	v.literal("nano-banana"),
	v.literal("gpt-image"),
	v.literal("grok"),
	v.literal("ideogram"),
	v.literal("openrouter"),
);

const DEFAULT_IMAGE_PROVIDER: ImageProvider = "nano-banana";

type RunResult =
	| { ok: true; generated: number; failed: number; totalCost: number; provider: ImageProvider; model: string }
	| { ok: false; error: string };

function buildCarouselSlidePrompt(
	styleAnchor: string,
	slidePrompt: string,
	brand: Pick<Doc<"brands">, "design">,
): string {
	return [
		styleAnchor,
		slidePrompt,
		`Brand style guide: ${brand.design.imageStyleGuide}`,
		`Palette: primary ${brand.design.palette.primary}, accent ${brand.design.palette.accent}, background ${brand.design.palette.background}.`,
		"Clean background suitable for text overlay with top-right and bottom-left negative space.",
		"Do not render any Arabic or English text. No letters, glyphs, watermarks, or UI chrome.",
		"Square 1024x1024 composition.",
	].join(" ");
}

export const generateCarouselForDraft = action({
	args: {
		draftId: v.id("drafts"),
		provider: v.optional(imageProviderValidator),
	},
	returns: v.union(
		v.object({
			ok: v.literal(true),
			generated: v.number(),
			failed: v.number(),
			totalCost: v.number(),
			provider: imageProviderValidator,
			model: v.string(),
		}),
		v.object({ ok: v.literal(false), error: v.string() }),
	),
	handler: async (ctx, args): Promise<RunResult> => {
		await requireUser(ctx);

		const env: ImageProviderEnv = {
			GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
			OPENAI_API_KEY: process.env.OPENAI_API_KEY,
			GROK_API_KEY: process.env.GROK_API_KEY,
			IDEOGRAM_API_KEY: process.env.IDEOGRAM_API_KEY,
			OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
			OPENROUTER_IMAGE_MODEL: process.env.OPENROUTER_IMAGE_MODEL,
		};

		const settings: Doc<"settings"> | null = await ctx.runQuery(internal.settings.doc.getInternal, {});
		const provider: ImageProvider = args.provider ?? settings?.defaultImageProvider ?? DEFAULT_IMAGE_PROVIDER;
		const model = defaultImageModel(provider, env);
		const activeBrand = await ctx.runQuery(internal.brand.doc.getActiveInternal, {});
		const brand = activeBrand ?? defaultBrandInput(Date.now());

		const loaded: {
			draft: Doc<"drafts">;
			analysis: Doc<"analyses">;
			slides: Doc<"carouselSlides">[];
		} | null = await ctx.runQuery(internal.generate.carouselInternal.loadCarouselForImages, {
			draftId: args.draftId,
		});
		if (!loaded) return { ok: false, error: "Carousel draft or analysis not found" };
		const { draft, analysis, slides } = loaded;

		if (draft.mediaKind !== "carousel") {
			return { ok: false, error: "Draft is not a carousel" };
		}
		if (slides.length === 0) {
			return { ok: false, error: "Carousel draft has no slides" };
		}

		const styleAnchor = draft.styleAnchor ?? "";

		let generated = 0;
		let failed = 0;
		let totalCost = 0;

		for (const slide of slides) {
			const prompt = buildCarouselSlidePrompt(styleAnchor, slide.imagePrompt, brand);
			const assetId: Id<"mediaAssets"> = await ctx.runMutation(
				internal.generate.image.internal.insertPendingAsset,
				{
					draftId: args.draftId,
					provider,
					model,
					prompt,
					orderIndex: slide.orderIndex,
				},
			);

			try {
				const result = await callImageProvider({ provider, prompt, model, env });
				const blob = new Blob([result.bytes as BlobPart], { type: "image/png" });
				const storageId: Id<"_storage"> = await ctx.storage.store(blob);

				const runId: Id<"providerRuns"> = await ctx.runMutation(
					internal.generate.image.internal.recordImageRun,
					{
						provider,
						model,
						purpose: "generate-carousel-image",
						cost: result.cost,
						sourceItemId: analysis.itemId,
						brandVersion: brand.version,
						promptVersion: IMAGE_PROMPT_VERSION,
					},
				);
				totalCost += result.cost;

				await ctx.runMutation(internal.generate.image.internal.completeAsset, {
					assetId,
					storageId,
					width: result.width,
					height: result.height,
					genRunId: runId,
				});
				generated += 1;
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				const runId: Id<"providerRuns"> = await ctx.runMutation(
					internal.generate.image.internal.recordImageRun,
					{
						provider,
						model,
						purpose: "generate-carousel-image",
						cost: 0,
						sourceItemId: analysis.itemId,
						error: msg,
						brandVersion: brand.version,
						promptVersion: IMAGE_PROMPT_VERSION,
					},
				);
				await ctx.runMutation(internal.generate.image.internal.failAsset, {
					assetId,
					error: msg,
					genRunId: runId,
				});
				failed += 1;
			}
		}

		// Patch draft with picked provider/model so the UI can show which
		// generator produced the carousel. mediaKind already set at creation.
		await ctx.runMutation(internal.generate.image.internal.patchDraftMedia, {
			draftId: args.draftId,
			mediaKind: "carousel",
			imageProvider: provider,
			imageModel: model,
		});

		return { ok: true, generated, failed, totalCost, provider, model };
	},
});

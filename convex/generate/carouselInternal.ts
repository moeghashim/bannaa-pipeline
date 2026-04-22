import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";

const providerValidator = v.union(v.literal("claude"), v.literal("glm"), v.literal("openrouter"));

// Insert a brand-new carousel draft + its carouselSlides rows + record the
// providerRun — all in one transaction so the draft never exists without
// slides or its run record.
export const insertCarouselDraft = internalMutation({
	args: {
		channelAr: v.string(),
		channelEn: v.string(),
		chars: v.number(),
		analysisId: v.id("analyses"),
		sourceItemId: v.id("inboxItems"),
		concepts: v.array(v.string()),
		capturedBy: v.id("users"),
		styleAnchor: v.string(),
		provider: providerValidator,
		model: v.string(),
		inputTokens: v.number(),
		outputTokens: v.number(),
		cost: v.number(),
		slides: v.array(
			v.object({
				ar: v.string(),
				imagePrompt: v.string(),
				orderIndex: v.number(),
			}),
		),
	},
	returns: v.id("drafts"),
	handler: async (ctx, args): Promise<Id<"drafts">> => {
		const runId = await ctx.db.insert("providerRuns", {
			provider: args.provider,
			model: args.model,
			purpose: "generate-carousel",
			itemId: args.sourceItemId,
			inputTokens: args.inputTokens,
			outputTokens: args.outputTokens,
			cost: args.cost,
			runAt: Date.now(),
		});

		const draftId = await ctx.db.insert("drafts", {
			channel: "ig",
			ar: args.channelAr,
			en: args.channelEn,
			chars: args.chars,
			state: "new",
			analysisId: args.analysisId,
			sourceItemId: args.sourceItemId,
			concepts: args.concepts,
			capturedBy: args.capturedBy,
			createdAt: Date.now(),
			genRunId: runId,
			mediaKind: "carousel",
			styleAnchor: args.styleAnchor,
		});

		for (const slide of args.slides) {
			await ctx.db.insert("carouselSlides", {
				draftId,
				orderIndex: slide.orderIndex,
				ar: slide.ar,
				imagePrompt: slide.imagePrompt,
				createdAt: Date.now(),
			});
		}

		return draftId;
	},
});

export const recordFailedCarouselRun = internalMutation({
	args: {
		provider: providerValidator,
		model: v.string(),
		error: v.string(),
		sourceItemId: v.id("inboxItems"),
	},
	returns: v.id("providerRuns"),
	handler: async (ctx, args): Promise<Id<"providerRuns">> => {
		return await ctx.db.insert("providerRuns", {
			provider: args.provider,
			model: args.model,
			purpose: "generate-carousel",
			itemId: args.sourceItemId,
			inputTokens: 0,
			outputTokens: 0,
			cost: 0,
			runAt: Date.now(),
			error: args.error,
		});
	},
});

// Carousel-image internal helpers. Kept next to carousel draft internals so
// the generation action doesn't need to reach into image/internal.ts for
// slide-specific mutations.
export const loadCarouselForImages = internalQuery({
	args: { draftId: v.id("drafts") },
	handler: async (
		ctx,
		{ draftId },
	): Promise<{
		draft: Doc<"drafts">;
		analysis: Doc<"analyses">;
		slides: Doc<"carouselSlides">[];
	} | null> => {
		const draft = await ctx.db.get(draftId);
		if (!draft) return null;
		const analysis = await ctx.db.get(draft.analysisId);
		if (!analysis) return null;
		const rawSlides = await ctx.db
			.query("carouselSlides")
			.withIndex("by_draft", (q) => q.eq("draftId", draftId))
			.collect();
		const slides = rawSlides.sort((a, b) => a.orderIndex - b.orderIndex);
		return { draft, analysis, slides };
	},
});

export const loadCarouselForOverlay = internalQuery({
	args: { draftId: v.id("drafts") },
	handler: async (
		ctx,
		{ draftId },
	): Promise<{
		draft: Doc<"drafts">;
		slides: Doc<"carouselSlides">[];
		baseAssets: Doc<"mediaAssets">[];
	} | null> => {
		const draft = await ctx.db.get(draftId);
		if (!draft) return null;
		const rawSlides = await ctx.db
			.query("carouselSlides")
			.withIndex("by_draft", (q) => q.eq("draftId", draftId))
			.collect();
		const slides = rawSlides.sort((a, b) => a.orderIndex - b.orderIndex);
		const assets = await ctx.db
			.query("mediaAssets")
			.withIndex("by_draft", (q) => q.eq("draftId", draftId))
			.collect();
		// Base assets only (no composites), sorted by orderIndex.
		const baseAssets = assets
			.filter((a) => !a.overlaidFrom && a.state === "ready")
			.sort((a, b) => a.orderIndex - b.orderIndex);
		return { draft, slides, baseAssets };
	},
});

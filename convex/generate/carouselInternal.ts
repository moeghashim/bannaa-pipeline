import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";
import { outputLanguageValidator } from "./languages";

const providerValidator = v.union(
	v.literal("claude"),
	v.literal("glm"),
	v.literal("openrouter"),
	v.literal("deepseek"),
);

const slideRoleValidator = v.union(
	v.literal("hook"),
	v.literal("concept"),
	v.literal("mechanism"),
	v.literal("example"),
	v.literal("payoff"),
);

// Insert a brand-new carousel draft + its carouselSlides rows + record the
// providerRun — all in one transaction so the draft never exists without
// slides or its run record.
export const insertCarouselDraft = internalMutation({
	args: {
		channelPrimary: v.string(),
		primaryLang: v.optional(outputLanguageValidator),
		chars: v.number(),
		analysisId: v.id("analyses"),
		sourceItemId: v.id("inboxItems"),
		concepts: v.array(v.string()),
		capturedBy: v.id("users"),
		styleAnchor: v.string(),
		postTemplateId: v.optional(v.id("postTemplates")),
		provider: providerValidator,
		model: v.string(),
		inputTokens: v.number(),
		outputTokens: v.number(),
		cost: v.number(),
		brandVersion: v.optional(v.number()),
		promptVersion: v.optional(v.string()),
		slides: v.array(
			v.object({
				primary: v.string(),
				imagePrompt: v.string(),
				orderIndex: v.number(),
				role: v.optional(slideRoleValidator),
			}),
		),
	},
	returns: v.object({ draftId: v.id("drafts"), runId: v.id("providerRuns") }),
	handler: async (ctx, args): Promise<{ draftId: Id<"drafts">; runId: Id<"providerRuns"> }> => {
		const runId = await ctx.db.insert("providerRuns", {
			provider: args.provider,
			model: args.model,
			purpose: "generate-carousel",
			itemId: args.sourceItemId,
			inputTokens: args.inputTokens,
			outputTokens: args.outputTokens,
			cost: args.cost,
			runAt: Date.now(),
			brandVersion: args.brandVersion,
			promptVersion: args.promptVersion,
		});

		const draftId = await ctx.db.insert("drafts", {
			channel: "ig",
			primary: args.channelPrimary,
			primaryLang: args.primaryLang,
			translations: [],
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
			postTemplateId: args.postTemplateId,
		});

		for (const slide of args.slides) {
			await ctx.db.insert("carouselSlides", {
				draftId,
				orderIndex: slide.orderIndex,
				primary: slide.primary,
				primaryLang: args.primaryLang,
				translations: [],
				imagePrompt: slide.imagePrompt,
				role: slide.role,
				genRunId: runId,
				createdAt: Date.now(),
			});
		}

		await ctx.db.patch(args.sourceItemId, { state: "draft", error: undefined });
		return { draftId, runId };
	},
});

export const recordFailedCarouselRun = internalMutation({
	args: {
		provider: providerValidator,
		model: v.string(),
		error: v.string(),
		sourceItemId: v.id("inboxItems"),
		brandVersion: v.optional(v.number()),
		promptVersion: v.optional(v.string()),
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
			brandVersion: args.brandVersion,
			promptVersion: args.promptVersion,
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
	analysis: Doc<"analyses">;
	slides: Doc<"carouselSlides">[];
	baseAssets: Doc<"mediaAssets">[];
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
		const assets = await ctx.db
			.query("mediaAssets")
			.withIndex("by_draft", (q) => q.eq("draftId", draftId))
			.collect();
		// Base assets only (no composites), sorted by orderIndex.
		const baseAssets = assets
		.filter((a) => !a.overlaidFrom && a.state === "ready")
		.sort((a, b) => a.orderIndex - b.orderIndex);
	return { draft, analysis, slides, baseAssets };
},
});

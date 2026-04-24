import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";

const providerValidator = v.union(v.literal("claude"), v.literal("glm"), v.literal("openrouter"));
const outputLanguageValidator = v.union(v.literal("ar-khaleeji"), v.literal("ar-msa"), v.literal("ar-levantine"));

export const loadDraftWithAnalysis = internalQuery({
	args: { draftId: v.id("drafts") },
	handler: async (
		ctx,
		{ draftId },
	): Promise<{ draft: Doc<"drafts">; analysis: Doc<"analyses"> } | null> => {
		const draft = await ctx.db.get(draftId);
		if (!draft) return null;
		const analysis = await ctx.db.get(draft.analysisId);
		if (!analysis) return null;
		return { draft, analysis };
	},
});

export const listSlidesForDraft = internalQuery({
	args: { draftId: v.id("drafts") },
	handler: async (ctx, { draftId }): Promise<Doc<"carouselSlides">[]> => {
		const rows = await ctx.db
			.query("carouselSlides")
			.withIndex("by_draft", (q) => q.eq("draftId", draftId))
			.collect();
		return rows.sort((a, b) => a.orderIndex - b.orderIndex);
	},
});

export const saveDraftTranslation = internalMutation({
	args: {
		draftId: v.id("drafts"),
		lang: outputLanguageValidator,
		text: v.string(),
		chars: v.number(),
		provider: providerValidator,
		model: v.string(),
		inputTokens: v.number(),
		outputTokens: v.number(),
		cost: v.number(),
		brandVersion: v.optional(v.number()),
		promptVersion: v.optional(v.string()),
	},
	returns: v.id("providerRuns"),
	handler: async (ctx, args): Promise<Id<"providerRuns">> => {
		const draft = await ctx.db.get(args.draftId);
		if (!draft) throw new Error("Draft not found");
		const runId = await ctx.db.insert("providerRuns", {
			provider: args.provider,
			model: args.model,
			purpose: "generate-translation",
			itemId: draft.sourceItemId,
			inputTokens: args.inputTokens,
			outputTokens: args.outputTokens,
			cost: args.cost,
			runAt: Date.now(),
			brandVersion: args.brandVersion,
			promptVersion: args.promptVersion,
		});
		const next = [
			...(draft.translations ?? []).filter((t) => t.lang !== args.lang),
			{
				lang: args.lang,
				text: args.text,
				chars: args.chars,
				genRunId: runId,
				createdAt: Date.now(),
			},
		];
		await ctx.db.patch(args.draftId, {
			translations: next,
			ar: args.lang.startsWith("ar-") ? args.text : draft.ar,
		});
		return runId;
	},
});

export const recordFailedTranslation = internalMutation({
	args: {
		draftId: v.id("drafts"),
		provider: providerValidator,
		model: v.string(),
		error: v.string(),
		brandVersion: v.optional(v.number()),
		promptVersion: v.optional(v.string()),
	},
	returns: v.id("providerRuns"),
	handler: async (ctx, args): Promise<Id<"providerRuns">> => {
		const draft = await ctx.db.get(args.draftId);
		return await ctx.db.insert("providerRuns", {
			provider: args.provider,
			model: args.model,
			purpose: "generate-translation",
			itemId: draft?.sourceItemId,
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

export const saveSlideTranslation = internalMutation({
	args: {
		slideId: v.id("carouselSlides"),
		lang: outputLanguageValidator,
		text: v.string(),
		chars: v.number(),
		genRunId: v.id("providerRuns"),
	},
	handler: async (ctx, args) => {
		const slide = await ctx.db.get(args.slideId);
		if (!slide) throw new Error("Carousel slide not found");
		const translations = [
			...(slide.translations ?? []).filter((t) => t.lang !== args.lang),
			{
				lang: args.lang,
				text: args.text,
				chars: args.chars,
				genRunId: args.genRunId,
				createdAt: Date.now(),
			},
		];
		await ctx.db.patch(args.slideId, {
			translations,
			ar: args.lang.startsWith("ar-") ? args.text : slide.ar,
		});
	},
});

import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";

const textProviderValidator = v.union(
	v.literal("claude"),
	v.literal("glm"),
	v.literal("openrouter"),
	v.literal("deepseek"),
);
const imageProviderValidator = v.union(
	v.literal("nano-banana"),
	v.literal("gpt-image"),
	v.literal("grok"),
	v.literal("ideogram"),
	v.literal("openrouter"),
);
const targetKindValidator = v.union(v.literal("draft"), v.literal("mediaAsset"), v.literal("carouselSlide"));

export const loadDraftTarget = internalQuery({
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

export const loadMediaTarget = internalQuery({
	args: { assetId: v.id("mediaAssets") },
	handler: async (
		ctx,
		{ assetId },
	): Promise<{ asset: Doc<"mediaAssets">; draft: Doc<"drafts">; analysis: Doc<"analyses"> } | null> => {
		const asset = await ctx.db.get(assetId);
		if (!asset) return null;
		const draft = await ctx.db.get(asset.draftId);
		if (!draft) return null;
		const analysis = await ctx.db.get(draft.analysisId);
		if (!analysis) return null;
		return { asset, draft, analysis };
	},
});

export const loadCarouselSlideTarget = internalQuery({
	args: { slideId: v.id("carouselSlides") },
	handler: async (
		ctx,
		{ slideId },
	): Promise<{ slide: Doc<"carouselSlides">; draft: Doc<"drafts">; analysis: Doc<"analyses"> } | null> => {
		const slide = await ctx.db.get(slideId);
		if (!slide) return null;
		const draft = await ctx.db.get(slide.draftId);
		if (!draft) return null;
		const analysis = await ctx.db.get(draft.analysisId);
		if (!analysis) return null;
		return { slide, draft, analysis };
	},
});

export const saveDraftRegeneration = internalMutation({
	args: {
		draftId: v.id("drafts"),
		primary: v.string(),
		concepts: v.array(v.string()),
		provider: textProviderValidator,
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
			purpose: "regenerate-draft-feedback",
			itemId: draft.sourceItemId,
			inputTokens: args.inputTokens,
			outputTokens: args.outputTokens,
			cost: args.cost,
			runAt: Date.now(),
			brandVersion: args.brandVersion,
			promptVersion: args.promptVersion,
		});
		await ctx.db.patch(args.draftId, {
			primary: args.primary,
			translations: [],
			chars: args.primary.length,
			concepts: args.concepts,
			genRunId: runId,
		});
		return runId;
	},
});

export const saveCarouselSlideRegeneration = internalMutation({
	args: {
		slideId: v.id("carouselSlides"),
		primary: v.string(),
		imagePrompt: v.string(),
		concepts: v.array(v.string()),
		provider: textProviderValidator,
		model: v.string(),
		inputTokens: v.number(),
		outputTokens: v.number(),
		cost: v.number(),
		brandVersion: v.optional(v.number()),
		promptVersion: v.optional(v.string()),
	},
	returns: v.id("providerRuns"),
	handler: async (ctx, args): Promise<Id<"providerRuns">> => {
		const slide = await ctx.db.get(args.slideId);
		if (!slide) throw new Error("Carousel slide not found");
		const draft = await ctx.db.get(slide.draftId);
		if (!draft) throw new Error("Draft not found");
		const runId = await ctx.db.insert("providerRuns", {
			provider: args.provider,
			model: args.model,
			purpose: "regenerate-carousel-slide-feedback",
			itemId: draft.sourceItemId,
			inputTokens: args.inputTokens,
			outputTokens: args.outputTokens,
			cost: args.cost,
			runAt: Date.now(),
			brandVersion: args.brandVersion,
			promptVersion: args.promptVersion,
		});
		await ctx.db.patch(args.slideId, {
			primary: args.primary,
			translations: [],
			imagePrompt: args.imagePrompt,
			genRunId: runId,
		});
		await ctx.db.patch(draft._id, { concepts: args.concepts });
		return runId;
	},
});

export const recordRegenerationFeedback = internalMutation({
	args: {
		targetKind: targetKindValidator,
		targetId: v.string(),
		draftId: v.id("drafts"),
		tags: v.array(v.string()),
		note: v.optional(v.string()),
		authorId: v.id("users"),
		runId: v.id("providerRuns"),
		priorRunId: v.id("providerRuns"),
	},
	returns: v.id("feedback"),
	handler: async (ctx, args): Promise<Id<"feedback">> => {
		const run = await ctx.db.get(args.runId);
		if (!run) throw new Error("Provider run not found");
		const feedbackId = await ctx.db.insert("feedback", {
			targetKind: args.targetKind,
			targetId: args.targetId,
			draftId: args.draftId,
			rating: "neutral",
			tags: args.tags,
			note: args.note,
			authorId: args.authorId,
			createdAt: Date.now(),
			brandVersion: run.brandVersion,
			promptVersion: run.promptVersion,
			provider: run.provider,
			model: run.model,
			runId: args.runId,
			priorRunId: args.priorRunId,
		});
		await ctx.scheduler.runAfter(0, internal.analytics.events.captureEvent, {
			distinctId: args.authorId,
			event: "feedback.submitted",
			properties: {
				feedback_id: feedbackId,
				draft_id: args.draftId,
				target_kind: args.targetKind,
				target_id: args.targetId,
				rating: "neutral",
				tag_count: args.tags.length,
				run_id: args.runId,
				prior_run_id: args.priorRunId,
				provider: run.provider,
				model: run.model,
				brand_version: run.brandVersion ?? null,
				prompt_version: run.promptVersion ?? null,
			},
		});
		return feedbackId;
	},
});

export const recordImageRegenerationRun = internalMutation({
	args: {
		provider: imageProviderValidator,
		model: v.string(),
		cost: v.number(),
		sourceItemId: v.id("inboxItems"),
		brandVersion: v.optional(v.number()),
		promptVersion: v.optional(v.string()),
		error: v.optional(v.string()),
	},
	returns: v.id("providerRuns"),
	handler: async (ctx, args): Promise<Id<"providerRuns">> => {
		return await ctx.db.insert("providerRuns", {
			provider: args.provider,
			model: args.model,
			purpose: "regenerate-media-feedback",
			itemId: args.sourceItemId,
			inputTokens: 0,
			outputTokens: 0,
			cost: args.cost,
			runAt: Date.now(),
			error: args.error,
			brandVersion: args.brandVersion,
			promptVersion: args.promptVersion,
		});
	},
});

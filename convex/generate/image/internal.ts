import { v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { internalMutation, internalQuery } from "../../_generated/server";

// External generator providers (matches ImageProvider in providers.ts).
const imageGeneratorValidator = v.union(
	v.literal("nano-banana"),
	v.literal("gpt-image"),
	v.literal("grok"),
	v.literal("ideogram"),
	v.literal("openrouter"),
);

const mediaKindValidator = v.union(
	v.literal("text"),
	v.literal("single-image"),
	v.literal("carousel"),
	v.literal("video"),
);

export const loadDraftWithAnalysis = internalQuery({
	args: { id: v.id("drafts") },
	handler: async (
		ctx,
		{ id },
	): Promise<{ draft: Doc<"drafts">; analysis: Doc<"analyses"> } | null> => {
		const draft = await ctx.db.get(id);
		if (!draft) return null;
		const analysis = await ctx.db.get(draft.analysisId);
		if (!analysis) return null;
		return { draft, analysis };
	},
});

export const insertPendingAsset = internalMutation({
	args: {
		draftId: v.id("drafts"),
		provider: imageGeneratorValidator,
		model: v.string(),
		prompt: v.string(),
		orderIndex: v.number(),
	},
	returns: v.id("mediaAssets"),
	handler: async (ctx, args): Promise<Id<"mediaAssets">> => {
		return await ctx.db.insert("mediaAssets", {
			draftId: args.draftId,
			kind: "image",
			prompt: args.prompt,
			provider: args.provider,
			model: args.model,
			state: "generating",
			width: 1024,
			height: 1024,
			orderIndex: args.orderIndex,
			createdAt: Date.now(),
		});
	},
});

export const completeAsset = internalMutation({
	args: {
		assetId: v.id("mediaAssets"),
		storageId: v.id("_storage"),
		width: v.number(),
		height: v.number(),
		genRunId: v.id("providerRuns"),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.assetId, {
			storageId: args.storageId,
			width: args.width,
			height: args.height,
			state: "ready",
			genRunId: args.genRunId,
		});
	},
});

export const failAsset = internalMutation({
	args: {
		assetId: v.id("mediaAssets"),
		error: v.string(),
		genRunId: v.id("providerRuns"),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.assetId, {
			state: "failed",
			error: args.error,
			genRunId: args.genRunId,
		});
	},
});

export const patchDraftMedia = internalMutation({
	args: {
		draftId: v.id("drafts"),
		mediaKind: mediaKindValidator,
		imageProvider: imageGeneratorValidator,
		imageModel: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.draftId, {
			mediaKind: args.mediaKind,
			imageProvider: args.imageProvider,
			imageModel: args.imageModel,
		});
	},
});

// Baked-text variant: the image model produces the final slide with the AR
// caption + brand chrome rendered by gpt-image-2 in one shot (replaces the
// old satori-based `insertCompositeAsset`). Keeps the real generator's
// provider + model so publish flows and analytics see gpt-image, and points
// `overlaidFrom` at the base so `slidesForDraft` / `firstReadyByDraft`
// continue to prefer the finished slide over the bare base.
export const insertBakedAsset = internalMutation({
	args: {
		draftId: v.id("drafts"),
		overlaidFrom: v.id("mediaAssets"),
		storageId: v.id("_storage"),
		width: v.number(),
		height: v.number(),
		provider: imageGeneratorValidator,
		model: v.string(),
		prompt: v.string(),
		orderIndex: v.number(),
		genRunId: v.id("providerRuns"),
	},
	returns: v.id("mediaAssets"),
	handler: async (ctx, args): Promise<Id<"mediaAssets">> => {
		return await ctx.db.insert("mediaAssets", {
			draftId: args.draftId,
			kind: "image",
			storageId: args.storageId,
			prompt: args.prompt,
			provider: args.provider,
			model: args.model,
			state: "ready",
			width: args.width,
			height: args.height,
			orderIndex: args.orderIndex,
			createdAt: Date.now(),
			overlaidFrom: args.overlaidFrom,
			genRunId: args.genRunId,
		});
	},
});

export const recordImageRun = internalMutation({
	args: {
		provider: v.union(
			v.literal("nano-banana"),
			v.literal("gpt-image"),
			v.literal("grok"),
			v.literal("ideogram"),
			v.literal("openrouter"),
		),
		model: v.string(),
		purpose: v.string(),
		cost: v.number(),
		sourceItemId: v.optional(v.id("inboxItems")),
		error: v.optional(v.string()),
		brandVersion: v.optional(v.number()),
		promptVersion: v.optional(v.string()),
	},
	returns: v.id("providerRuns"),
	handler: async (ctx, args): Promise<Id<"providerRuns">> => {
		return await ctx.db.insert("providerRuns", {
			provider: args.provider,
			model: args.model,
			purpose: args.purpose,
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

import { v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { internalMutation, internalQuery } from "../../_generated/server";

const imageProviderValidator = v.union(
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
		provider: imageProviderValidator,
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
		imageProvider: imageProviderValidator,
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
		});
	},
});

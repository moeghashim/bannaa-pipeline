import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";

const providerValidator = v.union(
	v.literal("claude"),
	v.literal("glm"),
	v.literal("openrouter"),
	v.literal("deepseek"),
	v.literal("nano-banana"),
	v.literal("gpt-image"),
	v.literal("grok"),
	v.literal("ideogram"),
);

export const recordPreviewRun = internalMutation({
	args: {
		provider: providerValidator,
		model: v.string(),
		purpose: v.string(),
		inputTokens: v.number(),
		outputTokens: v.number(),
		cost: v.number(),
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
			inputTokens: args.inputTokens,
			outputTokens: args.outputTokens,
			cost: args.cost,
			runAt: Date.now(),
			error: args.error,
			brandVersion: args.brandVersion,
			promptVersion: args.promptVersion,
		});
	},
});

export const getCachedBakedPreview = internalQuery({
	args: { brandId: v.id("brands"), hash: v.string() },
	handler: async (ctx, { brandId, hash }) => {
		const rows = await ctx.db
			.query("brandPreviews")
			.withIndex("by_brand_hash", (q) => q.eq("brandId", brandId).eq("hash", hash))
			.collect();
		rows.sort((a, b) => b.createdAt - a.createdAt);
		const row = rows[0];
		if (!row) return null;
		const url = await ctx.storage.getUrl(row.storageId);
		return { ...row, url };
	},
});

export const insertBakedPreview = internalMutation({
	args: {
		brandId: v.id("brands"),
		hash: v.string(),
		storageId: v.id("_storage"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.insert("brandPreviews", {
			brandId: args.brandId,
			hash: args.hash,
			storageId: args.storageId,
			createdAt: Date.now(),
		});
	},
});

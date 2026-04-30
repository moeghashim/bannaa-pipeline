import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";

export const insertIntegrationSnapshot = internalMutation({
	args: {
		integrationId: v.string(),
		provider: v.string(),
		name: v.string(),
		capturedAt: v.number(),
		windowDays: v.number(),
		views: v.optional(v.number()),
		likes: v.optional(v.number()),
		comments: v.optional(v.number()),
		shares: v.optional(v.number()),
		saves: v.optional(v.number()),
		followers: v.optional(v.number()),
		reach: v.optional(v.number()),
		rawMetricCount: v.number(),
	},
	returns: v.id("postizIntegrationMetrics"),
	handler: async (ctx, args): Promise<Id<"postizIntegrationMetrics">> =>
		await ctx.db.insert("postizIntegrationMetrics", args),
});

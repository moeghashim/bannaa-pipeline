import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, query } from "../_generated/server";
import { requireUser } from "../lib/requireUser";

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

export const latestByProvider = query({
	args: { provider: v.optional(v.string()) },
	returns: v.array(
		v.object({
			_id: v.id("postizIntegrationMetrics"),
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
		}),
	),
	handler: async (ctx, args) => {
		await requireUser(ctx);
		const rows = await ctx.db.query("postizIntegrationMetrics").withIndex("by_provider_capturedAt").collect();
		const latest = new Map<string, (typeof rows)[number]>();
		for (const row of rows) {
			if (args.provider && row.provider !== args.provider) continue;
			const previous = latest.get(row.integrationId);
			if (!previous || row.capturedAt > previous.capturedAt) latest.set(row.integrationId, row);
		}
		return [...latest.values()].sort((a, b) => a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name));
	},
});

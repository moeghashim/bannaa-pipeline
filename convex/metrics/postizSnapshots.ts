import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalQuery, query } from "../_generated/server";
import { requireUser } from "../lib/requireUser";

const snapshotValidator = v.object({
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
});

function toSnapshot(row: {
	_id: Id<"postizIntegrationMetrics">;
	integrationId: string;
	provider: string;
	name: string;
	capturedAt: number;
	windowDays: number;
	views?: number;
	likes?: number;
	comments?: number;
	shares?: number;
	saves?: number;
	followers?: number;
	reach?: number;
	rawMetricCount: number;
}) {
	return {
		_id: row._id,
		integrationId: row.integrationId,
		provider: row.provider,
		name: row.name,
		capturedAt: row.capturedAt,
		windowDays: row.windowDays,
		views: row.views,
		likes: row.likes,
		comments: row.comments,
		shares: row.shares,
		saves: row.saves,
		followers: row.followers,
		reach: row.reach,
		rawMetricCount: row.rawMetricCount,
	};
}

export const latestByProvider = query({
	args: { provider: v.optional(v.string()) },
	returns: v.array(snapshotValidator),
	handler: async (ctx, args) => {
		await requireUser(ctx);
		const provider = args.provider;
		const rows =
			provider === undefined
				? await ctx.db.query("postizIntegrationMetrics").withIndex("by_provider_capturedAt").collect()
				: await ctx.db
						.query("postizIntegrationMetrics")
						.withIndex("by_provider_capturedAt", (q) => q.eq("provider", provider))
						.collect();
		const latest = new Map<string, (typeof rows)[number]>();
		for (const row of rows) {
			const previous = latest.get(row.integrationId);
			if (!previous || row.capturedAt > previous.capturedAt) latest.set(row.integrationId, row);
		}
		return [...latest.values()]
			.sort((a, b) => a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name))
			.map(toSnapshot);
	},
});

export const latestForProviderInternal = internalQuery({
	args: { provider: v.string() },
	returns: v.union(snapshotValidator, v.null()),
	handler: async (ctx, args) => {
		const rows = await ctx.db
			.query("postizIntegrationMetrics")
			.withIndex("by_provider_capturedAt", (q) => q.eq("provider", args.provider))
			.order("desc")
			.take(1);
		const row = rows[0];
		return row ? toSnapshot(row) : null;
	},
});

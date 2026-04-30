import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";

const channelType = v.union(
	v.literal("x"),
	v.literal("ig"),
	v.literal("ig-reel"),
	v.literal("tiktok"),
	v.literal("yt-shorts"),
	v.literal("fb-page"),
	v.literal("linkedin-page"),
);

export const listPublishedXDrafts = internalQuery({
	args: { now: v.number(), maxAgeMs: v.number() },
	returns: v.array(
		v.object({
			_id: v.id("drafts"),
			channel: v.literal("x"),
			capturedBy: v.id("users"),
			createdAt: v.number(),
			scheduled: v.optional(v.number()),
			postizPermalink: v.optional(v.string()),
			rating: v.optional(v.number()),
			genRunId: v.id("providerRuns"),
			postTemplateId: v.optional(v.id("postTemplates")),
		}),
	),
	handler: async (ctx, args) => {
		const cutoff = args.now - args.maxAgeMs;
		const rows = await ctx.db
			.query("drafts")
			.withIndex("by_channel", (q) => q.eq("channel", "x"))
			.collect();
		return rows
			.filter((draft) => {
				if (draft.postizStatus !== "published") return false;
				if (!draft.postizPermalink) return false;
				const publishedAt = draft.scheduled ?? draft.createdAt;
				return publishedAt >= cutoff && publishedAt <= args.now;
			})
			.map((draft) => ({
				_id: draft._id,
				channel: "x" as const,
				capturedBy: draft.capturedBy,
				createdAt: draft.createdAt,
				scheduled: draft.scheduled,
				postizPermalink: draft.postizPermalink,
				rating: draft.rating,
				genRunId: draft.genRunId,
				postTemplateId: draft.postTemplateId,
			}));
	},
});

export const loadProviderRun = internalQuery({
	args: { id: v.id("providerRuns") },
	returns: v.union(
		v.null(),
		v.object({
			provider: v.string(),
			model: v.string(),
			brandVersion: v.optional(v.number()),
			promptVersion: v.optional(v.string()),
		}),
	),
	handler: async (ctx, args) => {
		const run: Doc<"providerRuns"> | null = await ctx.db.get(args.id);
		if (!run) return null;
		return {
			provider: run.provider,
			model: run.model,
			brandVersion: run.brandVersion,
			promptVersion: run.promptVersion,
		};
	},
});

export const insertSnapshot = internalMutation({
	args: {
		draftId: v.id("drafts"),
		channel: channelType,
		sourcePostId: v.string(),
		capturedAt: v.number(),
		postAgeHours: v.number(),
		views: v.optional(v.number()),
		likes: v.number(),
		comments: v.number(),
		shares: v.number(),
		saves: v.optional(v.number()),
	},
	returns: v.id("postMetrics"),
	handler: async (ctx, args): Promise<Id<"postMetrics">> => await ctx.db.insert("postMetrics", args),
});

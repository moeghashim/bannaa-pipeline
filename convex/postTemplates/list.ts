import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { requireUser } from "../lib/requireUser";
import { channelValidator } from "./validators";

type Candidate = {
	draftId: Id<"drafts">;
	channel: Doc<"drafts">["channel"];
	primary: string;
	rating?: number;
	views?: number;
	likes?: number;
	score: number;
	publishedAt: number;
	alreadyTemplate: boolean;
};

export const list = query({
	args: { channel: v.optional(v.union(v.literal("all"), channelValidator)) },
	returns: v.array(
		v.object({
			_id: v.id("postTemplates"),
			name: v.string(),
			channel: channelValidator,
			sourceDraftId: v.id("drafts"),
			structureNotes: v.string(),
			exampleText: v.optional(v.string()),
			createdAt: v.number(),
			updatedAt: v.number(),
			usageCount: v.number(),
			lastUsedAt: v.optional(v.number()),
			sourceRating: v.optional(v.number()),
			sourceViews: v.optional(v.number()),
		}),
	),
	handler: async (ctx, args) => {
		const userId = await requireUser(ctx);
		const rows = await ctx.db
			.query("postTemplates")
			.withIndex("by_createdBy", (q) => q.eq("createdBy", userId))
			.collect();
		const channel = args.channel ?? "all";
		return rows
			.filter((row) => channel === "all" || row.channel === channel)
			.sort((a, b) => b.updatedAt - a.updatedAt)
			.map((row) => ({
				_id: row._id,
				name: row.name,
				channel: row.channel,
				sourceDraftId: row.sourceDraftId,
				structureNotes: row.structureNotes,
				exampleText: row.exampleText,
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
				usageCount: row.usageCount,
				lastUsedAt: row.lastUsedAt,
				sourceRating: row.sourceRating,
				sourceViews: row.sourceViews,
			}));
	},
});

export const topCandidates = query({
	args: { channel: v.optional(v.union(v.literal("all"), channelValidator)) },
	returns: v.array(
		v.object({
			draftId: v.id("drafts"),
			channel: channelValidator,
			primary: v.string(),
			rating: v.optional(v.number()),
			views: v.optional(v.number()),
			likes: v.optional(v.number()),
			score: v.number(),
			publishedAt: v.number(),
			alreadyTemplate: v.boolean(),
		}),
	),
	handler: async (ctx, args): Promise<Candidate[]> => {
		const userId = await requireUser(ctx);
		const channel = args.channel ?? "all";
		const drafts = await ctx.db.query("drafts").withIndex("by_createdAt").order("desc").take(200);
		const templates = await ctx.db
			.query("postTemplates")
			.withIndex("by_createdBy", (q) => q.eq("createdBy", userId))
			.collect();
		const templatedDraftIds = new Set(templates.map((template) => String(template.sourceDraftId)));
		const candidates: Candidate[] = [];
		for (const draft of drafts) {
			if (draft.capturedBy !== userId) continue;
			if (channel !== "all" && draft.channel !== channel) continue;
			if (draft.postizStatus !== "published" && draft.state !== "published") continue;
			const latestMetric = await latestMetricForDraft(ctx, draft._id);
			const views = latestMetric?.views;
			const likes = latestMetric?.likes;
			const rating = draft.rating;
			const score = (rating ?? 0) + Math.min(50, (views ?? 0) / 20) + Math.min(25, (likes ?? 0) * 2);
			candidates.push({
				draftId: draft._id,
				channel: draft.channel,
				primary: draft.primary,
				rating,
				views,
				likes,
				score,
				publishedAt: draft.scheduled ?? draft.createdAt,
				alreadyTemplate: templatedDraftIds.has(String(draft._id)),
			});
		}
		return candidates.sort((a, b) => b.score - a.score).slice(0, 12);
	},
});

async function latestMetricForDraft(ctx: QueryCtx, draftId: Id<"drafts">) {
	const rows = await ctx.db
		.query("postMetrics")
		.withIndex("by_draft_capturedAt", (q) => q.eq("draftId", draftId))
		.order("desc")
		.take(1);
	return rows[0] ?? null;
}

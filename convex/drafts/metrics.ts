import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { requireUser } from "../lib/requireUser";

export const latestForDrafts = query({
	args: { draftIds: v.array(v.id("drafts")) },
	returns: v.array(
		v.object({
			draftId: v.id("drafts"),
			sourcePostId: v.string(),
			capturedAt: v.number(),
			postAgeHours: v.number(),
			views: v.optional(v.number()),
			likes: v.number(),
			comments: v.number(),
			shares: v.number(),
			saves: v.optional(v.number()),
		}),
	),
	handler: async (ctx, args) => {
		const userId = await requireUser(ctx);
		const out = [];
		for (const draftId of args.draftIds) {
			const draft = await ctx.db.get(draftId);
			if (!draft || draft.capturedBy !== userId) continue;
			const snapshots = await ctx.db
				.query("postMetrics")
				.withIndex("by_draft_capturedAt", (q) => q.eq("draftId", draftId))
				.order("desc")
				.take(1);
			const latest = snapshots[0];
			if (!latest) continue;
			out.push({
				draftId: latest.draftId as Id<"drafts">,
				sourcePostId: latest.sourcePostId,
				capturedAt: latest.capturedAt,
				postAgeHours: latest.postAgeHours,
				views: latest.views,
				likes: latest.likes,
				comments: latest.comments,
				shares: latest.shares,
				saves: latest.saves,
			});
		}
		return out;
	},
});

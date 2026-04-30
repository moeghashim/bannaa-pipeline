import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireUser } from "../lib/requireUser";

export const deleteItem = mutation({
	args: { id: v.id("inboxItems") },
	handler: async (ctx, { id }) => {
		await requireUser(ctx);
		const item = await ctx.db.get(id);
		if (!item) throw new Error("Item not found");

		const analyses = await ctx.db
			.query("analyses")
			.withIndex("by_itemId", (q) => q.eq("itemId", id))
			.collect();

		for (const analysis of analyses) {
			const drafts = await ctx.db
				.query("drafts")
				.withIndex("by_analysis", (q) => q.eq("analysisId", analysis._id))
				.take(1);
			if (drafts.length > 0) {
				throw new Error("Cannot delete: this analysis has drafts. Remove the drafts first.");
			}
		}

		for (const analysis of analyses) {
			await ctx.db.delete(analysis._id);
		}
		await ctx.db.delete(id);
	},
});

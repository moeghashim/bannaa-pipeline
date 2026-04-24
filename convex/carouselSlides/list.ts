import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { requireUser } from "../lib/requireUser";

// Returns the carouselSlides rows for a draft, ordered by orderIndex ascending.
// Public (read-only) so the Drafts UI can render per-slide captions under
// each tile.
export const scriptForDraft = query({
	args: { draftId: v.id("drafts") },
	handler: async (ctx, { draftId }): Promise<Doc<"carouselSlides">[]> => {
		await requireUser(ctx);
		const rows = await ctx.db
			.query("carouselSlides")
			.withIndex("by_draft", (q) => q.eq("draftId", draftId))
			.collect();
		return rows.sort((a, b) => a.orderIndex - b.orderIndex);
	},
});

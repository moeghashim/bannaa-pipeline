// Internal-only media-asset queries for the publish pipeline. Kept
// separate from list.ts (which is public + auth-gated) so we don't
// accidentally expose an un-auth'd listing to the client bundle.

import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalQuery } from "../_generated/server";

export const readyForDraft = internalQuery({
	args: { draftId: v.id("drafts") },
	handler: async (ctx, { draftId }): Promise<Doc<"mediaAssets">[]> => {
		const rows = await ctx.db
			.query("mediaAssets")
			.withIndex("by_draft", (q) => q.eq("draftId", draftId))
			.collect();
		return rows.filter((r) => r.state === "ready");
	},
});

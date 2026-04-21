import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";

export const findByTweetId = internalQuery({
	args: { xTweetId: v.string() },
	returns: v.union(v.object({ _id: v.id("inboxItems") }), v.null()),
	handler: async (ctx, { xTweetId }) => {
		const row = await ctx.db
			.query("inboxItems")
			.withIndex("by_xTweetId", (q) => q.eq("xTweetId", xTweetId))
			.unique();
		if (!row) return null;
		return { _id: row._id };
	},
});

export const insertFromBookmark = internalMutation({
	args: {
		userId: v.id("users"),
		xTweetId: v.string(),
		handle: v.string(),
		title: v.string(),
		snippet: v.string(),
		url: v.string(),
		capturedAt: v.number(),
		wordCount: v.number(),
	},
	returns: v.id("inboxItems"),
	handler: async (ctx, args): Promise<Id<"inboxItems">> => {
		return await ctx.db.insert("inboxItems", {
			source: "x",
			handle: args.handle,
			title: args.title,
			snippet: args.snippet,
			raw: args.snippet,
			url: args.url,
			lang: "en",
			state: "new",
			length: args.wordCount,
			capturedBy: args.userId,
			captured: args.capturedAt,
			xTweetId: args.xTweetId,
		});
	},
});

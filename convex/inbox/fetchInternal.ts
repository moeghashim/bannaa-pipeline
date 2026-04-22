// Internal patch mutations used by the tweet-body fetcher. Kept
// separate from inbox/capture.ts (public) and x/inbox.ts (bookmarks
// cron) because those have different shapes — the bookmarks cron
// inserts whole rows, this one only patches a subset of fields on an
// existing row.

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

export const applyFetchedTweet = internalMutation({
	args: {
		id: v.id("inboxItems"),
		xTweetId: v.string(),
		handle: v.string(),
		title: v.string(),
		snippet: v.string(),
		wordCount: v.number(),
	},
	returns: v.null(),
	handler: async (ctx, args): Promise<null> => {
		const row = await ctx.db.get(args.id);
		if (!row) return null;
		await ctx.db.patch(args.id, {
			xTweetId: args.xTweetId,
			handle: args.handle,
			title: args.title,
			snippet: args.snippet,
			raw: args.snippet,
			length: args.wordCount,
			error: undefined,
		});
		return null;
	},
});

export const applyFetchedYoutube = internalMutation({
	args: {
		id: v.id("inboxItems"),
		handle: v.string(),
		title: v.string(),
		snippet: v.string(),
		wordCount: v.number(),
	},
	returns: v.null(),
	handler: async (ctx, args): Promise<null> => {
		const row = await ctx.db.get(args.id);
		if (!row) return null;
		await ctx.db.patch(args.id, {
			handle: args.handle,
			title: args.title,
			snippet: args.snippet,
			raw: args.snippet,
			length: args.wordCount,
			error: undefined,
		});
		return null;
	},
});

export const markFetchError = internalMutation({
	args: {
		id: v.id("inboxItems"),
		error: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args): Promise<null> => {
		const row = await ctx.db.get(args.id);
		if (!row) return null;
		await ctx.db.patch(args.id, {
			error: args.error,
			// Surface the failure in the `length` field too so the operator
			// sees something other than the stale "fetching…" placeholder.
			length: "fetch failed",
		});
		return null;
	},
});

export const clearFetchError = internalMutation({
	args: { id: v.id("inboxItems") },
	returns: v.null(),
	handler: async (ctx, { id }): Promise<null> => {
		const row = await ctx.db.get(id);
		if (!row) return null;
		await ctx.db.patch(id, { error: undefined, length: "fetching…" });
		return null;
	},
});

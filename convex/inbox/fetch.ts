// Inbox URL fetcher — pulls the real tweet body when an operator pastes
// an x.com / twitter.com URL into the capture bar. The capture mutation
// drops a placeholder ("Awaiting fetch & extraction") and schedules this
// action via `ctx.scheduler.runAfter(0, ...)`. We then:
//
//   1. Parse the tweet ID out of the URL
//   2. Load the operator's X account tokens (refreshing if near-expiry)
//   3. Call GET /2/tweets/:id with text + author expansions
//   4. Patch the inbox item with the real snippet, handle, word count,
//      and stamp `xTweetId` so duplicate captures via bookmarks cron
//      dedup cleanly against the same row.
//
// Runs in V8 (fetch + URLSearchParams + btoa all work here — no Node
// APIs needed). Errors are recorded on the inbox item's `error` field
// so the operator sees why it didn't fill in, and a public retry action
// is exposed for manually re-triggering after a transient failure.

import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { action, type ActionCtx, internalAction } from "../_generated/server";
import { requireUser } from "../lib/requireUser";
import { refreshXTokenIfNeeded } from "../x/tokens";

type TweetResponse = {
	data?: { id: string; text: string; created_at?: string; author_id?: string };
	includes?: { users?: Array<{ id: string; username: string; name: string }> };
	errors?: Array<{ title?: string; detail?: string; type?: string }>;
};

// x.com/someone/status/1234  OR  twitter.com/someone/status/1234
// Optional trailing `?query` or `/photo/1` etc.
function parseTweetId(url: string): string | null {
	const m = url.match(/(?:x|twitter)\.com\/[^/]+\/status\/(\d+)/i);
	return m?.[1] ?? null;
}

async function fetchTweetBody(ctx: ActionCtx, itemId: Id<"inboxItems">): Promise<void> {
	// Defensive reload — between schedule + run the item may have been
	// rejected / deleted by the operator.
	const item: Doc<"inboxItems"> | null = await ctx.runQuery(internal.analyze.internal.loadItem, {
		id: itemId,
	});
	if (!item) return;
	if (item.source !== "x" || !item.url) return;

	const tweetId = parseTweetId(item.url);
	if (!tweetId) {
		await ctx.runMutation(internal.inbox.fetchInternal.markFetchError, {
			id: itemId,
			error: "Could not parse tweet id from URL",
		});
		return;
	}

	// If the operator already has this tweet via the bookmarks cron,
	// the `by_xTweetId` index will find it and we shouldn't write a
	// duplicate — but the pasted item is a separate row, so we just
	// patch this row with the fetched content and stamp the id.
	const accounts = await ctx.runQuery(internal.x.accounts.listAll, {});
	const acc = accounts.find((a: { userId: Id<"users"> }) => a.userId === item.capturedBy);
	if (!acc) {
		await ctx.runMutation(internal.inbox.fetchInternal.markFetchError, {
			id: itemId,
			error: "X account not connected — connect in Settings to auto-fetch tweet bodies",
		});
		return;
	}

	try {
		const token = await refreshXTokenIfNeeded(ctx, acc);
		const params = new URLSearchParams({
			"tweet.fields": "created_at,text,author_id",
			expansions: "author_id",
			"user.fields": "username,name",
		});
		const resp = await fetch(`https://api.x.com/2/tweets/${tweetId}?${params.toString()}`, {
			headers: { Authorization: `Bearer ${token}` },
		});
		if (!resp.ok) {
			const body = await resp.text().catch(() => "");
			throw new Error(`X /2/tweets/${tweetId} ${resp.status}: ${body.slice(0, 200)}`);
		}
		const payload = (await resp.json()) as TweetResponse;
		if (payload.errors && payload.errors.length > 0) {
			const first = payload.errors[0];
			throw new Error(first?.detail ?? first?.title ?? "X API returned errors with no detail");
		}
		const data = payload.data;
		if (!data) throw new Error("X API returned empty data field");

		const author = payload.includes?.users?.[0];
		const handle = author ? `@${author.username}` : item.handle;
		const firstLine = data.text.split("\n")[0]?.slice(0, 140) ?? data.text.slice(0, 140);
		const wordCount = data.text.split(/\s+/).filter(Boolean).length;

		await ctx.runMutation(internal.inbox.fetchInternal.applyFetchedTweet, {
			id: itemId,
			xTweetId: tweetId,
			handle,
			title: `${handle} · ${firstLine}`,
			snippet: data.text,
			wordCount,
		});
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		await ctx.runMutation(internal.inbox.fetchInternal.markFetchError, {
			id: itemId,
			error: msg,
		});
	}
}

export const fetchInbox = internalAction({
	args: { id: v.id("inboxItems") },
	returns: v.null(),
	handler: async (ctx, { id }): Promise<null> => {
		await fetchTweetBody(ctx, id);
		return null;
	},
});

// Operator-facing retry — same logic, auth-gated. The retry resets the
// item's error field up-front so the UI loses the red pill while the
// fetch is in flight.
export const retryFetch = action({
	args: { id: v.id("inboxItems") },
	returns: v.null(),
	handler: async (ctx, { id }): Promise<null> => {
		await requireUser(ctx);
		await ctx.runMutation(internal.inbox.fetchInternal.clearFetchError, { id });
		await fetchTweetBody(ctx, id);
		return null;
	},
});

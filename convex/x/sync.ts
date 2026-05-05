import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, type ActionCtx, internalAction } from "../_generated/server";
import { requireUser } from "../lib/requireUser";
import { buildTweetBody, type MediaInclude, type TweetData, tweetQueryParams } from "./parseTweet";
import { refreshXTokenIfNeeded } from "./tokens";

const MAX_PAGES_PER_SYNC = 5;

type BookmarkItem = TweetData & { created_at: string; author_id: string };

type BookmarkUser = { id: string; username: string; name: string };

type BookmarksResponse = {
	data?: BookmarkItem[];
	includes?: { users?: BookmarkUser[]; media?: MediaInclude[] };
	meta?: { result_count: number; next_token?: string };
};

type Account = {
	_id: Id<"xAccounts">;
	userId: Id<"users">;
	xUserId: string;
	xHandle: string;
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
	autoSync?: boolean;
};

async function fetchBookmarksPage(
	token: string,
	xUserId: string,
	paginationToken?: string,
): Promise<BookmarksResponse> {
	const params = tweetQueryParams({ max_results: "100" });
	if (paginationToken) params.set("pagination_token", paginationToken);

	const resp = await fetch(`https://api.x.com/2/users/${xUserId}/bookmarks?${params.toString()}`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!resp.ok) {
		throw new Error(`X bookmarks fetch failed: ${resp.status} ${await resp.text()}`);
	}
	return (await resp.json()) as BookmarksResponse;
}

async function syncAccount(
	ctx: ActionCtx,
	acc: Account,
): Promise<{ inserted: number; scanned: number }> {
	const accessToken = await refreshXTokenIfNeeded(ctx, acc);

	let inserted = 0;
	let scanned = 0;
	let pageToken: string | undefined;
	let pages = 0;

	do {
		const page: BookmarksResponse = await fetchBookmarksPage(accessToken, acc.xUserId, pageToken);
		const users = new Map<string, BookmarkUser>();
		for (const u of page.includes?.users ?? []) users.set(u.id, u);
		// /2/users/:id/bookmarks returns one `media[]` array shared across all
		// tweets on the page, so map by media_key to attribute correctly.
		const mediaByKey = new Map<string, MediaInclude>();
		for (const m of page.includes?.media ?? []) mediaByKey.set(m.media_key, m);

		for (const tw of page.data ?? []) {
			scanned += 1;
			const existing = await ctx.runQuery(internal.x.inbox.findByTweetId, { xTweetId: tw.id });
			if (existing) continue;
			const author = users.get(tw.author_id);
			const handle = author ? `@${author.username}` : "@unknown";
			const mediaTypes =
				tw.attachments?.media_keys
					?.map((k) => mediaByKey.get(k)?.type)
					.filter((t): t is string => Boolean(t)) ?? [];
			const bodyText = buildTweetBody(tw, author?.username, mediaTypes);
			const firstLine = bodyText.split("\n")[0]?.slice(0, 140) ?? bodyText.slice(0, 140);
			await ctx.runMutation(internal.x.inbox.insertFromBookmark, {
				userId: acc.userId,
				xTweetId: tw.id,
				handle,
				title: `${handle} · ${firstLine}`,
				snippet: bodyText,
				url: `https://x.com/${author?.username ?? "i"}/status/${tw.id}`,
				capturedAt: new Date(tw.created_at).getTime(),
				wordCount: bodyText.split(/\s+/).filter(Boolean).length,
			});
			inserted += 1;
		}

		pageToken = page.meta?.next_token;
		pages += 1;
	} while (pageToken && pages < MAX_PAGES_PER_SYNC);

	return { inserted, scanned };
}

export const syncMine = action({
	args: {},
	returns: v.object({ inserted: v.number(), scanned: v.number() }),
	handler: async (ctx): Promise<{ inserted: number; scanned: number }> => {
		const userId = await requireUser(ctx);
		const accounts = await ctx.runQuery(internal.x.accounts.listAll, {});
		const acc = accounts.find((a) => a.userId === userId);
		if (!acc) throw new Error("X account not connected");
		try {
			const result = await syncAccount(ctx, acc);
			await ctx.runMutation(internal.x.accounts.markSynced, { id: acc._id });
			return result;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			await ctx.runMutation(internal.x.accounts.markSynced, { id: acc._id, error: msg });
			throw err;
		}
	},
});

export const syncAll = internalAction({
	args: {},
	returns: v.null(),
	handler: async (ctx): Promise<null> => {
		const accounts = await ctx.runQuery(internal.x.accounts.listAll, {});
		for (const acc of accounts) {
			if (acc.autoSync === false) continue;
			try {
				await syncAccount(ctx, acc);
				await ctx.runMutation(internal.x.accounts.markSynced, { id: acc._id });
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				await ctx.runMutation(internal.x.accounts.markSynced, { id: acc._id, error: msg });
			}
		}
		return null;
	},
});

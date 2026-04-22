import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, type ActionCtx, internalAction } from "../_generated/server";
import { requireUser } from "../lib/requireUser";

const TOKEN_URL = "https://api.x.com/2/oauth2/token";
const REFRESH_MARGIN_MS = 60_000;
const MAX_PAGES_PER_SYNC = 5;

type BookmarkItem = {
	id: string;
	text: string;
	created_at: string;
	author_id: string;
};

type BookmarkUser = { id: string; username: string; name: string };

type BookmarksResponse = {
	data?: BookmarkItem[];
	includes?: { users?: BookmarkUser[] };
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

function basicAuth(): string {
	const id = process.env.X_CLIENT_ID;
	const secret = process.env.X_CLIENT_SECRET;
	if (!id || !secret) throw new Error("X_CLIENT_ID or X_CLIENT_SECRET not configured");
	return `Basic ${btoa(`${id}:${secret}`)}`;
}

async function refreshIfNeeded(ctx: ActionCtx, acc: Account): Promise<string> {
	if (acc.expiresAt - REFRESH_MARGIN_MS > Date.now()) return acc.accessToken;

	const body = new URLSearchParams({
		grant_type: "refresh_token",
		refresh_token: acc.refreshToken,
	});
	const resp = await fetch(TOKEN_URL, {
		method: "POST",
		headers: {
			Authorization: basicAuth(),
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: body.toString(),
	});
	if (!resp.ok) {
		throw new Error(`X token refresh failed: ${resp.status} ${await resp.text()}`);
	}
	const token = (await resp.json()) as {
		access_token: string;
		refresh_token: string;
		expires_in: number;
	};
	await ctx.runMutation(internal.x.accounts.updateTokens, {
		id: acc._id,
		accessToken: token.access_token,
		refreshToken: token.refresh_token,
		expiresAt: Date.now() + token.expires_in * 1000,
	});
	return token.access_token;
}

async function fetchBookmarksPage(
	token: string,
	xUserId: string,
	paginationToken?: string,
): Promise<BookmarksResponse> {
	const params = new URLSearchParams({
		"tweet.fields": "created_at,text,author_id",
		expansions: "author_id",
		"user.fields": "username,name",
		max_results: "100",
	});
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
	const accessToken = await refreshIfNeeded(ctx, acc);

	let inserted = 0;
	let scanned = 0;
	let pageToken: string | undefined;
	let pages = 0;

	do {
		const page: BookmarksResponse = await fetchBookmarksPage(accessToken, acc.xUserId, pageToken);
		const users = new Map<string, BookmarkUser>();
		for (const u of page.includes?.users ?? []) users.set(u.id, u);

		for (const tw of page.data ?? []) {
			scanned += 1;
			const existing = await ctx.runQuery(internal.x.inbox.findByTweetId, { xTweetId: tw.id });
			if (existing) continue;
			const author = users.get(tw.author_id);
			const handle = author ? `@${author.username}` : "@unknown";
			const firstLine = tw.text.split("\n")[0]?.slice(0, 140) ?? tw.text.slice(0, 140);
			await ctx.runMutation(internal.x.inbox.insertFromBookmark, {
				userId: acc.userId,
				xTweetId: tw.id,
				handle,
				title: `${handle} · ${firstLine}`,
				snippet: tw.text,
				url: `https://x.com/${author?.username ?? "i"}/status/${tw.id}`,
				capturedAt: new Date(tw.created_at).getTime(),
				wordCount: tw.text.split(/\s+/).filter(Boolean).length,
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

// Shared X OAuth 2.0 helpers. Originally inlined in sync.ts but pulled
// out when a second caller (inbox/fetch.ts) needed the same refresh
// dance. Both the bookmarks cron and the tweet-body fetch want: "hand
// me a valid access token for this user's X account, refreshing via
// the stored refresh_token if the current one is near-expiry."

import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

export const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
const REFRESH_MARGIN_MS = 60_000;

export type XAccountForRefresh = {
	_id: Id<"xAccounts">;
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
};

export function xBasicAuth(): string {
	const id = process.env.X_CLIENT_ID;
	const secret = process.env.X_CLIENT_SECRET;
	if (!id || !secret) throw new Error("X_CLIENT_ID or X_CLIENT_SECRET not configured");
	return `Basic ${btoa(`${id}:${secret}`)}`;
}

export async function refreshXTokenIfNeeded(
	ctx: ActionCtx,
	acc: XAccountForRefresh,
): Promise<string> {
	if (acc.expiresAt - REFRESH_MARGIN_MS > Date.now()) return acc.accessToken;

	const body = new URLSearchParams({
		grant_type: "refresh_token",
		refresh_token: acc.refreshToken,
	});
	const resp = await fetch(X_TOKEN_URL, {
		method: "POST",
		headers: {
			Authorization: xBasicAuth(),
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

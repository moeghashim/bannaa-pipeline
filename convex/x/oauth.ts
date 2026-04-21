import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action, httpAction } from "../_generated/server";
import { requireUser } from "../lib/requireUser";

const SCOPES = ["tweet.read", "bookmark.read", "users.read", "offline.access"].join(" ");
const AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.x.com/2/oauth2/token";
const ME_URL = "https://api.x.com/2/users/me";

function b64urlFromBytes(bytes: Uint8Array): string {
	let bin = "";
	for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i] ?? 0);
	return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
	const verifier = b64urlFromBytes(crypto.getRandomValues(new Uint8Array(48)));
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
	return { verifier, challenge: b64urlFromBytes(new Uint8Array(digest)) };
}

function redirectUri(): string {
	const site = process.env.CONVEX_SITE_URL;
	if (!site) throw new Error("CONVEX_SITE_URL is not configured");
	return `${site}/auth/x/callback`;
}

function basicAuth(): string {
	const id = process.env.X_CLIENT_ID;
	const secret = process.env.X_CLIENT_SECRET;
	if (!id || !secret) throw new Error("X_CLIENT_ID or X_CLIENT_SECRET not configured");
	return `Basic ${btoa(`${id}:${secret}`)}`;
}

export const startForCaller = action({
	args: {},
	returns: v.string(),
	handler: async (ctx): Promise<string> => {
		const userId = await requireUser(ctx);
		const clientId = process.env.X_CLIENT_ID;
		if (!clientId) throw new Error("X_CLIENT_ID not configured in Convex env");

		const { verifier, challenge } = await pkcePair();
		const state = b64urlFromBytes(crypto.getRandomValues(new Uint8Array(24)));

		await ctx.runMutation(internal.x.oauthState.create, {
			state,
			codeVerifier: verifier,
			userId,
		});

		const qp = new URLSearchParams({
			response_type: "code",
			client_id: clientId,
			redirect_uri: redirectUri(),
			scope: SCOPES,
			state,
			code_challenge: challenge,
			code_challenge_method: "S256",
		});
		return `${AUTHORIZE_URL}?${qp.toString()}`;
	},
});

export const callback = httpAction(async (ctx, request) => {
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	const error = url.searchParams.get("error");

	const siteReturn = process.env.SITE_URL ?? "http://localhost:3000";

	if (error) return Response.redirect(`${siteReturn}/?x_error=${encodeURIComponent(error)}`, 302);
	if (!code || !state) return Response.redirect(`${siteReturn}/?x_error=missing_code_or_state`, 302);

	const pending = await ctx.runQuery(internal.x.oauthState.consume, { state });
	if (!pending) return Response.redirect(`${siteReturn}/?x_error=invalid_state`, 302);

	const tokenBody = new URLSearchParams({
		grant_type: "authorization_code",
		code,
		redirect_uri: redirectUri(),
		code_verifier: pending.codeVerifier,
	});

	const tokenResp = await fetch(TOKEN_URL, {
		method: "POST",
		headers: {
			Authorization: basicAuth(),
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: tokenBody.toString(),
	});

	if (!tokenResp.ok) {
		const body = await tokenResp.text();
		return Response.redirect(
			`${siteReturn}/?x_error=${encodeURIComponent(`token_exchange_${tokenResp.status}:${body.slice(0, 200)}`)}`,
			302,
		);
	}

	const token = (await tokenResp.json()) as {
		access_token: string;
		refresh_token: string;
		expires_in: number;
		scope: string;
	};

	const meResp = await fetch(ME_URL, {
		headers: { Authorization: `Bearer ${token.access_token}` },
	});
	if (!meResp.ok) return Response.redirect(`${siteReturn}/?x_error=me_${meResp.status}`, 302);
	const me = (await meResp.json()) as { data: { id: string; username: string; name: string } };

	await ctx.runMutation(internal.x.accounts.upsert, {
		userId: pending.userId,
		xUserId: me.data.id,
		xHandle: me.data.username,
		accessToken: token.access_token,
		refreshToken: token.refresh_token,
		expiresAt: Date.now() + token.expires_in * 1000,
		scope: token.scope,
	});

	await ctx.runMutation(internal.x.oauthState.remove, { state });

	return Response.redirect(`${siteReturn}/?x_connected=1`, 302);
});

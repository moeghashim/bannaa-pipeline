import { api } from "@convex/_generated/api";
import { convexAuthNextjsToken, isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { fetchAction } from "convex/nextjs";
import { NextResponse } from "next/server";

export async function GET() {
	const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

	if (!(await isAuthenticatedNextjs())) {
		return NextResponse.redirect(new URL("/sign-in", siteUrl));
	}

	const token = await convexAuthNextjsToken();
	try {
		const authorizeUrl = await fetchAction(api.x.oauth.startForCaller, {}, { token });
		return NextResponse.redirect(authorizeUrl);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return NextResponse.redirect(new URL(`/?x_error=${encodeURIComponent(msg)}`, siteUrl));
	}
}

"use client";

import posthog from "posthog-js";

export type ClientAnalyticsEvent = "view_changed" | "palette_opened";

export type ClientAnalyticsProperties = Record<string, string | number | boolean | null>;

let initialized = false;

export function initPostHog() {
	if (initialized || typeof window === "undefined") return posthog;

	const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
	const debug = process.env.NEXT_PUBLIC_POSTHOG_DEBUG === "1";
	if (!key || (process.env.NODE_ENV !== "production" && !debug)) return posthog;

	posthog.init(key, {
		api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "/ingest",
		ui_host: "https://us.posthog.com",
		capture_pageview: "history_change",
		capture_exceptions: true,
		defaults: "2025-05-24",
		debug,
	});
	initialized = true;
	return posthog;
}

export function captureClientEvent(event: ClientAnalyticsEvent, properties?: ClientAnalyticsProperties) {
	if (!initialized) return;
	posthog.capture(event, properties);
}

export function identifyClientUser(user: { id: string; email?: string | null; name?: string | null }) {
	if (!initialized) return;
	posthog.identify(user.id, {
		email: user.email ?? undefined,
		name: user.name ?? undefined,
	});
}

export function resetClientUser() {
	if (!initialized) return;
	posthog.reset();
}

export { posthog };

"use node";

// Postiz hosted-plan publish adapter (Phase C scaffold).
//
// Two ops we'll expose to drafts/approve:
//   • `uploadMedia(bytes)` → returns a Postiz `mediaId` we can reference
//     in a schedule call. For carousels we upload every slide composite in
//     orderIndex order and collect the ids into a list.
//   • `schedulePost({ channel, text, mediaIds, scheduledAt? })` → creates
//     a post in Postiz; returns the Postiz `postId` we store on the draft
//     row. If `scheduledAt` is omitted Postiz publishes immediately.
//
// The adapter runs in the **Node runtime** only because the multipart upload
// body (Blob) is more ergonomic in Node fetch than V8; everything else here
// is plain JSON and would work in V8 too if we wanted to move it later.
//
// NOT wired to any action yet — the draft approve button still just flips
// state to `approved` locally. Phase C next steps will build `convex/publish/
// publishDraft.ts` that calls these two functions + stores the returned
// Postiz ids + sets up webhook-driven state transitions.

const POSTIZ_API_BASE = "https://api.postiz.com/public/v1";

// Maps our internal channel union to the Postiz provider identifier the
// hosted API expects on POST /posts. These strings match Postiz's public
// REST docs; if they rev the slugs we'll catch it via the schedulePost
// error path (their API echoes "unknown provider: x" in the 400 body).
//
// Note: we don't yet have slugs confirmed for IG Reels vs IG feed — Postiz
// treats IG as a single provider with a `postType` flag in the body. Same
// for YT Shorts (routed via their YouTube provider with a type marker).
// TODO: confirm the exact flag names once the Postiz dashboard is live and
// we can inspect a real outbound payload.
export type PostizProvider =
	| "x"
	| "instagram"
	| "tiktok"
	| "youtube"
	| "facebook"
	| "linkedin";

export type UploadMediaInput = {
	bytes: Uint8Array;
	contentType: string; // e.g. "image/png"
	filename: string; // Postiz uses this as the asset label in their dashboard
};

export type UploadMediaResult = {
	mediaId: string;
	url: string; // Postiz-hosted CDN URL — useful for preview + audit
};

export type SchedulePostInput = {
	provider: PostizProvider;
	text: string; // the Khaleeji-AR copy from the draft
	mediaIds: string[]; // from uploadMedia; 1 for single-image, 3-5 for carousel
	scheduledAt?: number; // unix ms; omit for immediate publish
	// Channel-specific knobs; add as we need them. Postiz's REST surface
	// supports a freeform `settings` object per provider (e.g. IG carousel
	// vs single, YT short vs long, TikTok draft vs publish). We'll grow
	// this into a discriminated union once we've seen the real payloads.
	settings?: Record<string, unknown>;
};

export type SchedulePostResult = {
	postId: string;
	permalink: string | null; // null until the provider actually publishes
	status: "scheduled" | "publishing" | "published" | "failed";
};

function requireApiKey(): string {
	const key = process.env.POSTIZ_API_KEY;
	if (!key) {
		throw new Error("POSTIZ_API_KEY is not set in Convex environment");
	}
	return key;
}

// --- STUBS -----------------------------------------------------------------
// Both of these throw until Phase C wiring lands the real API calls. The
// shapes above are the stable part — call sites can be written against them
// today and will light up as soon as the implementations ship.

export async function uploadMedia(_input: UploadMediaInput): Promise<UploadMediaResult> {
	requireApiKey();
	throw new Error("Postiz uploadMedia not yet implemented — Phase C pending API key verification");
}

export async function schedulePost(_input: SchedulePostInput): Promise<SchedulePostResult> {
	requireApiKey();
	throw new Error("Postiz schedulePost not yet implemented — Phase C pending API key verification");
}

// Exposed for the Settings tile's self-test ping. Hits `GET /integrations`
// — Postiz's canonical "what do I have connected" endpoint. Returns the
// provider slugs + names so we can surface "connected to X, IG, TikTok" in
// the UI. A 200 with an empty list means the key works but no socials are
// connected yet; a 401/403 means the key is wrong or the plan tier lacks
// API access.
export type PostizSelfCheck =
	| { ok: true; providers: string[] }
	| { ok: false; error: string };

export async function selfCheck(): Promise<PostizSelfCheck> {
	const key = process.env.POSTIZ_API_KEY;
	if (!key) return { ok: false, error: "POSTIZ_API_KEY not set" };
	try {
		const resp = await fetch(`${POSTIZ_API_BASE}/integrations`, {
			headers: { Authorization: key },
		});
		if (!resp.ok) {
			const body = await resp.text().catch(() => "");
			return { ok: false, error: `Postiz /integrations ${resp.status}${body ? ` — ${body.slice(0, 200)}` : ""}` };
		}
		// Postiz historically returns either a bare array or `{ integrations: [...] }`
		// depending on the API version — handle both to avoid a breakage on rev.
		const json = (await resp.json()) as unknown;
		const list = Array.isArray(json)
			? json
			: Array.isArray((json as { integrations?: unknown }).integrations)
				? (json as { integrations: unknown[] }).integrations
				: [];
		const providers = list
			.map((row) => {
				if (typeof row !== "object" || row === null) return null;
				const r = row as Record<string, unknown>;
				return typeof r.providerIdentifier === "string"
					? r.providerIdentifier
					: typeof r.provider === "string"
						? r.provider
						: typeof r.name === "string"
							? r.name
							: null;
			})
			.filter((x): x is string => typeof x === "string");
		return { ok: true, providers };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { ok: false, error: msg };
	}
}

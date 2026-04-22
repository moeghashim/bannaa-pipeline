"use node";

// Postiz hosted-plan publish adapter (Phase C).
//
// Thin HTTP client against api.postiz.com/public/v1. Exposes three ops
// that the publish action + scheduler UI drive:
//
//   • listIntegrations() → connected socials with their Postiz-side IDs,
//     so the operator can pick which account to publish through.
//   • uploadMedia({bytes, contentType, filename}) → returns a Postiz
//     media ID + CDN url for one asset. Carousels upload each slide
//     sequentially in order.
//   • schedulePost({...}) → creates a scheduled post with N media refs
//     and the Khaleeji-AR copy, returns the Postiz post ID we store on
//     the draft row.
//
// Runs in the Node runtime so multipart uploads work cleanly with the
// global FormData + Blob (V8 has both, but Node's streaming upload path
// is more forgiving on large PNGs).
//
// Auth: Postiz's public API uses a bare `Authorization: <key>` header, NOT
// `Authorization: Bearer <key>`. That took a 401 round-trip to find out.
//
// Error model: every op returns `{ ok: true, ... } | { ok: false, error }`
// instead of throwing, so the calling action can update the draft's
// `postizError` field with something human-readable. The only exception
// is `requireApiKey` which throws synchronously — that's a config problem,
// not a runtime failure.

const POSTIZ_API_BASE = "https://api.postiz.com/public/v1";

export type PostizProvider =
	| "x"
	| "instagram"
	| "tiktok"
	| "youtube"
	| "facebook"
	| "linkedin";

// --- Integrations ----------------------------------------------------------

export type PostizIntegration = {
	id: string;
	name: string;
	providerIdentifier: string; // e.g. "instagram", "x", "tiktok"
	picture: string | null; // avatar URL if Postiz has one, null otherwise
	disabled: boolean;
};

export type ListIntegrationsResult =
	| { ok: true; integrations: PostizIntegration[] }
	| { ok: false; error: string };

export async function listIntegrations(): Promise<ListIntegrationsResult> {
	const key = process.env.POSTIZ_API_KEY;
	if (!key) return { ok: false, error: "POSTIZ_API_KEY not set" };
	try {
		const resp = await fetch(`${POSTIZ_API_BASE}/integrations`, {
			headers: { Authorization: key },
		});
		if (!resp.ok) {
			const body = await resp.text().catch(() => "");
			return {
				ok: false,
				error: `Postiz /integrations ${resp.status}${body ? ` — ${body.slice(0, 200)}` : ""}`,
			};
		}
		const json = (await resp.json()) as unknown;
		const list: unknown[] = Array.isArray(json)
			? json
			: Array.isArray((json as { integrations?: unknown }).integrations)
				? (json as { integrations: unknown[] }).integrations
				: [];
		const integrations: PostizIntegration[] = [];
		for (const row of list) {
			if (typeof row !== "object" || row === null) continue;
			const r = row as Record<string, unknown>;
			const id = typeof r.id === "string" ? r.id : null;
			if (!id) continue;
			integrations.push({
				id,
				name: typeof r.name === "string" ? r.name : "(unnamed)",
				providerIdentifier:
					typeof r.providerIdentifier === "string"
						? r.providerIdentifier
						: typeof r.provider === "string"
							? r.provider
							: "unknown",
				picture: typeof r.picture === "string" ? r.picture : null,
				disabled: Boolean(r.disabled),
			});
		}
		return { ok: true, integrations };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}

// --- Media upload ----------------------------------------------------------

export type UploadMediaInput = {
	bytes: Uint8Array;
	contentType: string; // "image/png" for HyperFrames composites
	filename: string; // shown in Postiz's asset library — we pass the draft id
};

export type UploadMediaResult =
	| { ok: true; id: string; path: string }
	| { ok: false; error: string };

export async function uploadMedia(input: UploadMediaInput): Promise<UploadMediaResult> {
	const key = process.env.POSTIZ_API_KEY;
	if (!key) return { ok: false, error: "POSTIZ_API_KEY not set" };
	try {
		const blob = new Blob([input.bytes as BlobPart], { type: input.contentType });
		const form = new FormData();
		form.append("file", blob, input.filename);
		const resp = await fetch(`${POSTIZ_API_BASE}/upload`, {
			method: "POST",
			headers: { Authorization: key },
			body: form,
		});
		if (!resp.ok) {
			const body = await resp.text().catch(() => "");
			return {
				ok: false,
				error: `Postiz /upload ${resp.status}${body ? ` — ${body.slice(0, 200)}` : ""}`,
			};
		}
		const json = (await resp.json()) as Record<string, unknown>;
		const id = typeof json.id === "string" ? json.id : null;
		const path = typeof json.path === "string" ? json.path : null;
		if (!id || !path) {
			return { ok: false, error: `Postiz /upload returned malformed body: ${JSON.stringify(json).slice(0, 200)}` };
		}
		return { ok: true, id, path };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}

// --- Schedule post ---------------------------------------------------------

export type SchedulePostInput = {
	integrationId: string; // from listIntegrations — which Postiz social to use
	text: string; // Khaleeji-AR copy
	media: Array<{ id: string; path: string }>; // from uploadMedia, in order
	scheduledAt: number; // unix ms; Postiz requires an ISO date even for "publish now"
	settings: Record<string, unknown>; // from channelMatrix — provider-specific knobs
};

export type SchedulePostResult =
	| { ok: true; postId: string }
	| { ok: false; error: string };

export async function schedulePost(input: SchedulePostInput): Promise<SchedulePostResult> {
	const key = process.env.POSTIZ_API_KEY;
	if (!key) return { ok: false, error: "POSTIZ_API_KEY not set" };
	try {
		// Postiz's /posts body is a nested structure — one top-level post
		// can contain multi-platform + multi-slot drafts, but we always
		// ship a single-platform single-slot variant (one integration,
		// one `value` entry, all media on that entry).
		const body = {
			type: "schedule" as const,
			date: new Date(input.scheduledAt).toISOString(),
			posts: [
				{
					integration: { id: input.integrationId },
					value: [
						{
							content: input.text,
							image: input.media.map((m) => ({ id: m.id, path: m.path })),
						},
					],
					settings: input.settings,
				},
			],
		};
		const resp = await fetch(`${POSTIZ_API_BASE}/posts`, {
			method: "POST",
			headers: {
				Authorization: key,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});
		if (!resp.ok) {
			const respBody = await resp.text().catch(() => "");
			return {
				ok: false,
				error: `Postiz /posts ${resp.status}${respBody ? ` — ${respBody.slice(0, 300)}` : ""}`,
			};
		}
		const json = (await resp.json()) as unknown;
		// /posts returns different shapes across Postiz versions — try a few
		// locations for the post id before giving up.
		const postId = extractPostId(json);
		if (!postId) {
			return {
				ok: false,
				error: `Postiz /posts returned no postId: ${JSON.stringify(json).slice(0, 300)}`,
			};
		}
		return { ok: true, postId };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}

function extractPostId(json: unknown): string | null {
	if (typeof json !== "object" || json === null) return null;
	const j = json as Record<string, unknown>;
	if (typeof j.id === "string") return j.id;
	if (typeof j.postId === "string") return j.postId;
	if (Array.isArray(j.posts) && j.posts.length > 0) {
		const first = j.posts[0];
		if (typeof first === "object" && first !== null) {
			const f = first as Record<string, unknown>;
			if (typeof f.id === "string") return f.id;
			if (typeof f.postId === "string") return f.postId;
		}
	}
	return null;
}

// --- Self-check (reused by Settings) --------------------------------------

export type PostizSelfCheck =
	| { ok: true; providers: string[] }
	| { ok: false; error: string };

export async function selfCheck(): Promise<PostizSelfCheck> {
	const r = await listIntegrations();
	if (!r.ok) return { ok: false, error: r.error };
	return { ok: true, providers: r.integrations.map((i) => i.name) };
}

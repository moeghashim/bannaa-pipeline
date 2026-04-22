"use node";

// YouTube transcript fetcher — pulls the auto-generated or manual
// transcript when an operator pastes a youtube.com / youtu.be / shorts
// URL into the capture bar.
//
// Originally used the `youtube-transcript` npm package. Dropped it
// because the package declares `"type": "module"` but ships a CJS `main`
// that uses `exports.X =`, which Convex's esbuild refuses to treat as
// having exports — leaving `YoutubeTranscript` undefined at bundle time.
// The ESM bundle works but pointing at it directly breaks types
// resolution. The scraping logic is small enough (~80 lines) to own
// outright, so we just inline it here.
//
// Flow:
//   1. GET the watch page HTML with a browser UA.
//   2. Extract `ytInitialPlayerResponse` from the inline script block.
//   3. Walk to captions.playerCaptionsTracklistRenderer.captionTracks[0]
//      for the first available caption track (prefers English when
//      present; else whatever YouTube sorts first).
//   4. GET the track's baseUrl → TimedText XML.
//   5. Parse <text start="..." dur="...">...</text> into segments and
//      join into one readable blob.
//
// If the video has captions disabled, captionTracks is empty and we
// surface a friendly error on the inbox row.
//
// Title + author come from the public oEmbed endpoint (no key).

import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { action, type ActionCtx, internalAction } from "../_generated/server";
import { requireUser } from "../lib/requireUser";

const BROWSER_UA =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function parseYoutubeId(url: string): string | null {
	const patterns = [
		/(?:youtube\.com\/watch\?(?:[^&]+&)*v=)([a-zA-Z0-9_-]{11})/,
		/youtu\.be\/([a-zA-Z0-9_-]{11})/,
		/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
		/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
	];
	for (const p of patterns) {
		const m = url.match(p);
		if (m?.[1]) return m[1];
	}
	return null;
}

type CaptionTrack = { baseUrl?: string; languageCode?: string; name?: { simpleText?: string } };

function extractInlineJson(html: string, varName: string): Record<string, unknown> | null {
	const needle = `var ${varName} = `;
	const start = html.indexOf(needle);
	if (start === -1) return null;
	const jsonStart = start + needle.length;
	let depth = 0;
	for (let i = jsonStart; i < html.length; i += 1) {
		const ch = html[i];
		if (ch === "{") depth += 1;
		else if (ch === "}") {
			depth -= 1;
			if (depth === 0) {
				try {
					return JSON.parse(html.slice(jsonStart, i + 1)) as Record<string, unknown>;
				} catch {
					return null;
				}
			}
		}
	}
	return null;
}

function extractCaptionTracks(json: Record<string, unknown>): CaptionTrack[] {
	const captions = json.captions as { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } } | undefined;
	return captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
}

function decodeEntities(s: string): string {
	return s
		.replace(/&amp;#39;/g, "'")
		.replace(/&amp;quot;/g, '"')
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&#x([0-9a-fA-F]+);/g, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
		.replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(parseInt(d, 10)));
}

function parseTimedTextXml(xml: string): string {
	const segments: string[] = [];
	const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
	let m: RegExpExecArray | null = re.exec(xml);
	while (m !== null) {
		const raw = m[1] ?? "";
		const stripped = raw.replace(/<[^>]+>/g, "");
		const decoded = decodeEntities(stripped).trim();
		if (decoded) segments.push(decoded);
		m = re.exec(xml);
	}
	return segments.join(" ").replace(/\s+/g, " ").trim();
}

// Primary path: InnerTube API with the Android YouTube client spoof.
// Much more reliable than the watch-page scraper because YouTube treats
// the Android app as a first-class client and returns caption tracks
// regardless of server region — the watch-page variant is geo-gated
// and strips captionTracks for some IPs. Falls through to the scraper
// if this returns empty.
const INNERTUBE_ANDROID_VERSION = "20.10.38";
async function fetchTracksViaInnerTube(videoId: string): Promise<CaptionTrack[] | null> {
	try {
		const resp = await fetch(
			"https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"User-Agent": `com.google.android.youtube/${INNERTUBE_ANDROID_VERSION} (Linux; U; Android 14)`,
				},
				body: JSON.stringify({
					context: {
						client: {
							clientName: "ANDROID",
							clientVersion: INNERTUBE_ANDROID_VERSION,
						},
					},
					videoId,
				}),
			},
		);
		if (!resp.ok) return null;
		const json = (await resp.json()) as Record<string, unknown>;
		const tracks = extractCaptionTracks(json);
		return tracks.length > 0 ? tracks : null;
	} catch {
		return null;
	}
}

async function fetchTranscriptText(videoId: string): Promise<string> {
	// Try InnerTube first (region-agnostic). Fall back to the watch-page
	// scraper only if that returns nothing.
	let tracks = await fetchTracksViaInnerTube(videoId);

	if (!tracks) {
		const watchResp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
			headers: { "User-Agent": BROWSER_UA, "Accept-Language": "en-US,en;q=0.9" },
		});
		if (!watchResp.ok) {
			throw new Error(`YouTube watch page ${watchResp.status}`);
		}
		const html = await watchResp.text();
		if (html.includes('class="g-recaptcha"')) {
			throw new Error("YouTube is requiring a captcha for this IP — try again later");
		}
		const player = extractInlineJson(html, "ytInitialPlayerResponse");
		if (!player) {
			throw new Error("Could not locate ytInitialPlayerResponse — YouTube may have changed the page shape");
		}
		tracks = extractCaptionTracks(player);
	}

	if (!tracks || tracks.length === 0) {
		throw new Error("No caption tracks on this video (captions may be disabled)");
	}
	// Prefer English if present, else take the first track YouTube gives us.
	const pick = tracks.find((t) => (t.languageCode ?? "").startsWith("en")) ?? tracks[0];
	if (!pick?.baseUrl) {
		throw new Error("Caption track had no baseUrl");
	}
	const xmlResp = await fetch(pick.baseUrl, {
		headers: { "User-Agent": BROWSER_UA },
	});
	if (!xmlResp.ok) {
		throw new Error(`YouTube timedtext ${xmlResp.status}`);
	}
	const xml = await xmlResp.text();
	const text = parseTimedTextXml(xml);
	if (!text) throw new Error("Transcript parsed empty — unexpected timedtext format");
	return text;
}

type OEmbedResponse = {
	title?: string;
	author_name?: string;
	author_url?: string;
};

async function fetchVideoBody(ctx: ActionCtx, itemId: Id<"inboxItems">): Promise<void> {
	const item: Doc<"inboxItems"> | null = await ctx.runQuery(internal.analyze.internal.loadItem, {
		id: itemId,
	});
	if (!item) return;
	if (item.source !== "youtube" || !item.url) return;

	const videoId = parseYoutubeId(item.url);
	if (!videoId) {
		await ctx.runMutation(internal.inbox.fetchInternal.markFetchError, {
			id: itemId,
			error: "Could not parse YouTube video id from URL",
		});
		return;
	}

	try {
		// Parallelise oEmbed + transcript. Different origins, no shared
		// state, so one shouldn't gate the other.
		const canonical = `https://www.youtube.com/watch?v=${videoId}`;
		const [oembedResp, snippet] = await Promise.all([
			fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(canonical)}&format=json`),
			fetchTranscriptText(videoId),
		]);

		let title = item.title;
		let handle = item.handle;
		if (oembedResp.ok) {
			const oembed = (await oembedResp.json()) as OEmbedResponse;
			if (typeof oembed.title === "string") title = oembed.title;
			if (typeof oembed.author_name === "string") handle = `@${oembed.author_name}`;
		}

		const wordCount = snippet.split(/\s+/).filter(Boolean).length;

		await ctx.runMutation(internal.inbox.fetchInternal.applyFetchedYoutube, {
			id: itemId,
			handle,
			title,
			snippet,
			wordCount,
		});
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		// Log so a failed-silently outcome is debuggable from the Convex
		// dashboard — the UI only shows "fetch failed" today, and the
		// full error string lives in the DB row's `error` field.
		console.error(`[fetchYoutube] video ${videoId} failed: ${msg}`);
		await ctx.runMutation(internal.inbox.fetchInternal.markFetchError, {
			id: itemId,
			error: msg,
		});
	}
}

export const fetchYoutube = internalAction({
	args: { id: v.id("inboxItems") },
	returns: v.null(),
	handler: async (ctx, { id }): Promise<null> => {
		await fetchVideoBody(ctx, id);
		return null;
	},
});

export const retryYoutubeFetch = action({
	args: { id: v.id("inboxItems") },
	returns: v.null(),
	handler: async (ctx, { id }): Promise<null> => {
		await requireUser(ctx);
		await ctx.runMutation(internal.inbox.fetchInternal.clearFetchError, { id });
		await fetchVideoBody(ctx, id);
		return null;
	},
});

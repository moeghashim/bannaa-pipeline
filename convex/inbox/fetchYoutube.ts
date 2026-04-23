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
// Flow (three tiers — stop at the first that yields text):
//   1. InnerTube — POST /youtubei/v1/player with the Android client
//      spoof; parse captions.playerCaptionsTracklistRenderer.
//   2. Watch-page scrape — GET the HTML, extract
//      `ytInitialPlayerResponse` and walk the same tracklist shape.
//      Tiers 1 and 2 then GET the track's baseUrl → TimedText XML →
//      parse <text start="..." dur="...">...</text> segments.
//   3. Apify `streamers/youtube-scraper` — paid residential-proxy
//      fallback. Convex's eu-west-1 IP gets stripped caption tracks by
//      YouTube, so the free tiers return empty for most videos and we
//      escalate to this ~$0.0024/video actor. Returns transcript +
//      title + channel in one round-trip, so we skip oEmbed when it
//      fires.
//
// Title + author come from the public oEmbed endpoint when tiers 1 or
// 2 deliver the transcript; tier 3 provides them inline.

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

// Tier 3: Apify's official `streamers/youtube-scraper` actor. Used when
// tiers 1 and 2 both fail — which happens routinely from Convex's
// eu-west-1 IP because YouTube strips caption tracks for non-residential
// IPs. Apify runs its own residential-proxy fleet so this path actually
// returns captions. Metered at ~$0.0024 per video.
//
// The actor returns the full video metadata (title, channelName) in the
// same payload, so we skip oEmbed when this tier fires.
type ApifySubtitle = {
	type?: string;
	language?: string;
	plaintext?: string;
	srtUrl?: string | null;
};

type ApifyVideoItem = {
	title?: string;
	channelName?: string;
	channelUsername?: string;
	subtitles?: ApifySubtitle[] | null;
};

type ApifyResult = {
	snippet: string;
	meta: { title?: string; handle?: string };
};

async function fetchViaApify(videoId: string): Promise<ApifyResult | null> {
	const token = process.env.APIFY_API_TOKEN;
	if (!token) {
		console.log("[fetchYoutube] Apify tier skipped: no token");
		return null;
	}
	const endpoint = `https://api.apify.com/v2/acts/streamers~youtube-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
	const body = {
		startUrls: [{ url: `https://www.youtube.com/watch?v=${videoId}` }],
		maxResults: 1,
		downloadSubtitles: true,
		subtitlesLanguage: "any",
		subtitlesFormat: "plaintext",
		preferAutoGeneratedSubtitles: true,
	};
	const resp = await fetch(endpoint, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!resp.ok) {
		const text = await resp.text().catch(() => "");
		throw new Error(`Apify /run-sync-get-dataset-items ${resp.status}: ${text.slice(0, 200)}`);
	}
	const parsed = (await resp.json().catch(() => null)) as ApifyVideoItem[] | null;
	if (!parsed || !Array.isArray(parsed) || parsed.length === 0) return null;
	const item = parsed[0];
	if (!item) return null;
	const subs = Array.isArray(item.subtitles) ? item.subtitles : [];
	// Prefer English when present; fall back to the first track with any
	// plaintext content.
	const picked =
		subs.find((s) => (s.language ?? "").toLowerCase().startsWith("en") && s.plaintext) ??
		subs.find((s) => typeof s.plaintext === "string" && s.plaintext.length > 0);
	const raw = picked?.plaintext ?? "";
	// Apify returns the plaintext WebVTT conversion with linebreaks and
	// musical-note decorations. Strip them and collapse whitespace to
	// match what the XML parser produces for tiers 1 and 2.
	const snippet = decodeEntities(raw)
		.replace(/\r/g, " ")
		.replace(/\n+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (!snippet) return null;
	const meta: { title?: string; handle?: string } = {};
	if (typeof item.title === "string" && item.title) meta.title = item.title;
	const author = item.channelName ?? item.channelUsername;
	if (typeof author === "string" && author) meta.handle = `@${author}`;
	return { snippet, meta };
}

type TranscriptResult = {
	snippet: string;
	// When present, the caller should skip oEmbed — tier 3 returns meta
	// inline and tiers 1/2 return none.
	meta?: { title?: string; handle?: string };
};

async function fetchTranscriptText(videoId: string): Promise<TranscriptResult> {
	// Try InnerTube first (region-agnostic). Fall back to the watch-page
	// scraper. If both return no caption tracks — typical for Convex's
	// eu-west-1 IP — escalate to the paid Apify tier.
	let tracks = await fetchTracksViaInnerTube(videoId);
	const tierErrors: string[] = [];

	if (!tracks) {
		try {
			const watchResp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
				headers: { "User-Agent": BROWSER_UA, "Accept-Language": "en-US,en;q=0.9" },
			});
			if (!watchResp.ok) {
				throw new Error(`YouTube watch page ${watchResp.status}`);
			}
			const html = await watchResp.text();
			if (html.includes('class="g-recaptcha"')) {
				throw new Error("YouTube is requiring a captcha for this IP");
			}
			const player = extractInlineJson(html, "ytInitialPlayerResponse");
			if (!player) {
				throw new Error("Could not locate ytInitialPlayerResponse");
			}
			tracks = extractCaptionTracks(player);
		} catch (err) {
			tierErrors.push(err instanceof Error ? err.message : String(err));
			tracks = null;
		}
	}

	if (tracks && tracks.length > 0) {
		// Prefer English if present, else take the first track YouTube gives us.
		const pick = tracks.find((t) => (t.languageCode ?? "").startsWith("en")) ?? tracks[0];
		if (pick?.baseUrl) {
			const xmlResp = await fetch(pick.baseUrl, {
				headers: { "User-Agent": BROWSER_UA },
			});
			if (xmlResp.ok) {
				const xml = await xmlResp.text();
				const text = parseTimedTextXml(xml);
				if (text) return { snippet: text };
				tierErrors.push("Transcript parsed empty — unexpected timedtext format");
			} else {
				tierErrors.push(`YouTube timedtext ${xmlResp.status}`);
			}
		} else {
			tierErrors.push("Caption track had no baseUrl");
		}
	} else {
		tierErrors.push("No caption tracks via InnerTube or watch-page scraper");
	}

	// Tier 3 — Apify fallback. Only surfaces errors; returns null if the
	// token is missing or the dataset comes back empty.
	const apify = await fetchViaApify(videoId);
	if (apify) return { snippet: apify.snippet, meta: apify.meta };

	throw new Error(
		tierErrors.length > 0 ? tierErrors.join("; ") : "No caption tracks on this video (captions may be disabled)",
	);
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
		// Fetch the transcript first. When tier 3 (Apify) fires, it
		// returns title + channel inline — so we skip the oEmbed round-
		// trip. Tiers 1 and 2 don't surface metadata, so we call oEmbed
		// in that case.
		const transcript = await fetchTranscriptText(videoId);

		let title = item.title;
		let handle = item.handle;
		if (transcript.meta) {
			if (transcript.meta.title) title = transcript.meta.title;
			if (transcript.meta.handle) handle = transcript.meta.handle;
		} else {
			const canonical = `https://www.youtube.com/watch?v=${videoId}`;
			const oembedResp = await fetch(
				`https://www.youtube.com/oembed?url=${encodeURIComponent(canonical)}&format=json`,
			);
			if (oembedResp.ok) {
				const oembed = (await oembedResp.json()) as OEmbedResponse;
				if (typeof oembed.title === "string") title = oembed.title;
				if (typeof oembed.author_name === "string") handle = `@${oembed.author_name}`;
			}
		}

		const wordCount = transcript.snippet.split(/\s+/).filter(Boolean).length;

		await ctx.runMutation(internal.inbox.fetchInternal.applyFetchedYoutube, {
			id: itemId,
			handle,
			title,
			snippet: transcript.snippet,
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

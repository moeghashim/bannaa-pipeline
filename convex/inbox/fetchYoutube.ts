"use node";

// YouTube transcript fetcher — pulls the auto-generated or manual
// transcript when an operator pastes a youtube.com / youtu.be URL into
// the capture bar. Mirrors convex/inbox/fetch.ts (the X variant) but for
// a totally different upstream:
//
//   • Title + author: via YouTube's public oEmbed endpoint (no key).
//   • Transcript: via the `youtube-transcript` npm package, which
//     scrapes the same endpoint the web player uses. Works for most
//     videos with captions; returns [] (we treat as an error) for
//     videos that have captions disabled or are region-blocked.
//
// Runs in Node because `youtube-transcript` uses Node-only APIs
// internally (it worked in V8 on paper but has crashed during bundle
// analysis when pulled into a V8 module). `"use node"` on this file
// alone is enough — nothing else imports the package.

import { v } from "convex/values";
import { YoutubeTranscript } from "youtube-transcript";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { action, type ActionCtx, internalAction } from "../_generated/server";
import { requireUser } from "../lib/requireUser";

// youtube.com/watch?v=VID · youtu.be/VID · youtube.com/shorts/VID ·
// youtube.com/embed/VID — captures the 11-char VID in each case.
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
		// Parallelise — oEmbed is a separate origin from transcript
		// scraping, so one shouldn't gate the other. We also prefer the
		// canonical watch URL for oEmbed (more reliable than shorts/ URLs
		// for title lookup).
		const canonical = `https://www.youtube.com/watch?v=${videoId}`;
		const [oembedResp, transcript] = await Promise.all([
			fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(canonical)}&format=json`),
			YoutubeTranscript.fetchTranscript(videoId).catch((err: unknown) => {
				// Re-throw with a friendlier message; the default
				// "TranscriptError" is cryptic.
				throw new Error(
					err instanceof Error
						? `Transcript fetch failed: ${err.message}`
						: `Transcript fetch failed: ${String(err)}`,
				);
			}),
		]);

		let title = item.title;
		let handle = item.handle;
		if (oembedResp.ok) {
			const oembed = (await oembedResp.json()) as OEmbedResponse;
			if (typeof oembed.title === "string") title = oembed.title;
			if (typeof oembed.author_name === "string") handle = `@${oembed.author_name}`;
		}

		if (!Array.isArray(transcript) || transcript.length === 0) {
			throw new Error("Transcript is empty — video may have captions disabled");
		}
		// Join segments into one readable blob. youtube-transcript returns
		// HTML-escaped entities (e.g. `&amp;#39;`) — decode the common
		// ones so the analyzer prompt gets clean text. Not a full HTML
		// decoder; adding one would pull another dep for a couple edge
		// cases.
		const snippet = transcript
			.map((s: { text: string }) => s.text)
			.join(" ")
			.replace(/&amp;#39;/g, "'")
			.replace(/&amp;quot;/g, '"')
			.replace(/&amp;/g, "&")
			.replace(/\s+/g, " ")
			.trim();
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

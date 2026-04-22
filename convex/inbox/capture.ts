import { v } from "convex/values";
import { internal } from "../_generated/api";
import { mutation } from "../_generated/server";
import { requireUser } from "../lib/requireUser";

type DetectResult = {
	source: "x" | "youtube" | "article" | "manual";
	url?: string;
	handle: string;
	title?: string;
};

function detectSource(input: string): DetectResult {
	const s = input.trim();
	if (/(?:twitter\.com|x\.com)\/[^\s/]+/i.test(s)) {
		const m = s.match(/(?:twitter\.com|x\.com)\/([^\s/]+)/i);
		return { source: "x", url: s, handle: `@${m?.[1] ?? "user"}` };
	}
	if (/youtu\.?be/i.test(s)) {
		return { source: "youtube", url: s, handle: "youtube" };
	}
	if (/^https?:\/\//i.test(s)) {
		try {
			const u = new URL(s);
			return { source: "article", url: s, handle: u.hostname.replace(/^www\./, "") };
		} catch {
			return { source: "article", url: s, handle: "article" };
		}
	}
	return { source: "manual", handle: "operator", title: s.slice(0, 80) };
}

export const capture = mutation({
	args: {
		raw: v.string(),
	},
	returns: v.id("inboxItems"),
	handler: async (ctx, { raw }) => {
		const userId = await requireUser(ctx);
		const trimmed = raw.trim();
		if (!trimmed) {
			throw new Error("Capture input cannot be empty");
		}

		const detected = detectSource(trimmed);

		const titleFor = (d: DetectResult): string => {
			if (d.title) return d.title;
			if (d.source === "x") return `${d.handle} · captured tweet`;
			if (d.source === "youtube") return "Captured YouTube video";
			if (d.source === "article") return `Captured article · ${d.handle}`;
			return "Manual note";
		};

		const snippetFor = (d: DetectResult): string => {
			if (d.source === "manual") return trimmed;
			return "Awaiting fetch & extraction — the LLM will pull the transcript/body and produce a summary, concept tags, and suggested outputs.";
		};

		const lengthFor = (d: DetectResult): number | string => {
			if (d.source === "manual") return trimmed.split(/\s+/).filter(Boolean).length;
			return "fetching…";
		};

		const id = await ctx.db.insert("inboxItems", {
			source: detected.source,
			handle: detected.handle,
			title: titleFor(detected),
			snippet: snippetFor(detected),
			raw: detected.source === "manual" ? trimmed : undefined,
			url: detected.url,
			lang: "en",
			state: "new",
			length: lengthFor(detected),
			capturedBy: userId,
			captured: Date.now(),
		});

		// Schedule the tweet-body fetch immediately after insert so the UI
		// flips from "fetching…" to the real snippet within a few seconds.
		// YouTube + article URLs don't have a fetcher yet — they stay as
		// placeholder rows until the operator either pastes the body
		// manually or those fetchers ship in a later phase.
		if (detected.source === "x" && detected.url) {
			await ctx.scheduler.runAfter(0, internal.inbox.fetch.fetchInbox, { id });
		}

		return id;
	},
});

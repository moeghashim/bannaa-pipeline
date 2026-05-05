// Helpers for normalizing X /2/tweets payloads into the snippet shape
// the inbox stores. The single-fetch action (operator paste) and the
// bookmarks cron both call into here so they handle URL expansion,
// long-tweet (`note_tweet`) bodies, and media-only tweets identically.

export type TweetUrlEntity = {
	url: string;
	expanded_url?: string;
	display_url?: string;
};

export type TweetEntities = { urls?: Array<TweetUrlEntity> };

export type TweetData = {
	id: string;
	text: string;
	created_at?: string;
	author_id?: string;
	entities?: TweetEntities;
	note_tweet?: { text: string; entities?: TweetEntities };
	attachments?: { media_keys?: string[] };
};

export type MediaInclude = { media_key: string; type: string };

// Twitter stores every link as a t.co shortcode in `text`. We swap each
// shortcode for its `expanded_url` so the inbox snippet shows what the
// operator actually pasted, not "https://t.co/abc". Self-links (the
// shortcode that points back at the tweet itself, present on media-only
// or quote tweets) get stripped entirely — keeping them adds noise and
// inflates the word count.
export function expandTcoUrls(
	text: string,
	entities: TweetEntities | undefined,
	selfUrl: string,
): string {
	const urls = entities?.urls;
	if (!urls || urls.length === 0) return text.trim();
	let out = text;
	for (const u of urls) {
		if (!u.url) continue;
		const expanded = u.expanded_url ?? "";
		const isSelfLink = selfUrl !== "" && expanded.startsWith(selfUrl);
		out = out.split(u.url).join(isSelfLink ? "" : expanded);
	}
	return out.replace(/\s+/g, " ").trim();
}

// Build the displayable body for a tweet:
//   1. Prefer note_tweet.text for >280-char tweets (otherwise text is truncated).
//   2. Expand t.co shortcodes against the matching entities object.
//   3. For media-only tweets that end up empty, return a "[photo]" /
//      "[video]" / "[gif]" placeholder so the snippet isn't blank.
export function buildTweetBody(
	data: TweetData,
	username: string | undefined,
	mediaTypes: string[],
): string {
	const selfUrl = username ? `https://twitter.com/${username}/status/${data.id}` : "";
	const rawText = data.note_tweet?.text ?? data.text;
	const rawEntities = data.note_tweet?.entities ?? data.entities;
	let body = expandTcoUrls(rawText, rawEntities, selfUrl);
	if (!body && mediaTypes.length > 0) {
		const kind = mediaTypes.includes("video")
			? "video"
			: mediaTypes.includes("animated_gif")
				? "gif"
				: "photo";
		body = `[${kind}]`;
	}
	if (!body) body = rawText.trim();
	return body;
}

// Shared query string for /2/tweets and /2/users/:id/bookmarks. Keeps
// the field set in one place so we don't drift between fetch sites.
export function tweetQueryParams(extra?: Record<string, string>): URLSearchParams {
	const params = new URLSearchParams({
		"tweet.fields": "created_at,text,author_id,entities,note_tweet,attachments",
		expansions: "author_id,attachments.media_keys",
		"user.fields": "username,name",
		"media.fields": "type",
	});
	if (extra) for (const [k, v] of Object.entries(extra)) params.set(k, v);
	return params;
}

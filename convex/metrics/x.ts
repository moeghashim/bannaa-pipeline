"use node";

export type XPostMetrics = {
	sourcePostId: string;
	views?: number;
	likes: number;
	comments: number;
	shares: number;
	saves?: number;
};

type XPublicMetrics = {
	impression_count?: number;
	like_count?: number;
	reply_count?: number;
	retweet_count?: number;
	quote_count?: number;
	bookmark_count?: number;
};

type XNonPublicMetrics = {
	impression_count?: number;
	user_profile_clicks?: number;
	url_link_clicks?: number;
};

type XTweet = {
	id: string;
	public_metrics?: XPublicMetrics;
	non_public_metrics?: XNonPublicMetrics;
};

type XTweetsResponse = {
	data?: XTweet[];
	errors?: Array<{ title?: string; detail?: string }>;
};

export function extractTweetIdFromPermalink(permalink: string | undefined): string | null {
	if (!permalink) return null;
	const match = permalink.match(/\/status(?:es)?\/(\d+)/i) ?? permalink.match(/\/i\/web\/status\/(\d+)/i);
	return match?.[1] ?? null;
}

function toNumber(value: number | undefined): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function mapTweetMetrics(tweet: XTweet): XPostMetrics {
	const publicMetrics = tweet.public_metrics;
	const nonPublicMetrics = tweet.non_public_metrics;
	const retweets = toNumber(publicMetrics?.retweet_count) ?? 0;
	const quotes = toNumber(publicMetrics?.quote_count) ?? 0;
	return {
		sourcePostId: tweet.id,
		views: toNumber(publicMetrics?.impression_count) ?? toNumber(nonPublicMetrics?.impression_count),
		likes: toNumber(publicMetrics?.like_count) ?? 0,
		comments: toNumber(publicMetrics?.reply_count) ?? 0,
		shares: retweets + quotes,
		saves: toNumber(publicMetrics?.bookmark_count),
	};
}

async function fetchTweetBatch(
	token: string,
	ids: string[],
	includeNonPublic: boolean,
): Promise<XTweetsResponse> {
	const params = new URLSearchParams({
		ids: ids.join(","),
		"tweet.fields": includeNonPublic ? "public_metrics,non_public_metrics" : "public_metrics",
	});
	const response = await fetch(`https://api.x.com/2/tweets?${params.toString()}`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!response.ok) {
		throw new Error(`X tweet metrics fetch failed: ${response.status} ${await response.text()}`);
	}
	return (await response.json()) as XTweetsResponse;
}

function shouldRetryPublicOnly(response: XTweetsResponse): boolean {
	if ((response.data?.length ?? 0) > 0) return false;
	return (response.errors ?? []).some((err) => {
		const text = `${err.title ?? ""} ${err.detail ?? ""}`.toLowerCase();
		return text.includes("not authorized") || text.includes("authorization");
	});
}

export async function fetchXPostMetrics(token: string, ids: string[]): Promise<Map<string, XPostMetrics>> {
	if (ids.length === 0) return new Map();
	const uniqueIds = Array.from(new Set(ids));
	const result = new Map<string, XPostMetrics>();

	for (let start = 0; start < uniqueIds.length; start += 100) {
		const batch = uniqueIds.slice(start, start + 100);
		let response: XTweetsResponse;
		try {
			response = await fetchTweetBatch(token, batch, true);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			if (!message.includes("403") && !message.includes("400")) throw err;
			response = await fetchTweetBatch(token, batch, false);
		}
		if (shouldRetryPublicOnly(response)) {
			response = await fetchTweetBatch(token, batch, false);
		}
		for (const tweet of response.data ?? []) {
			result.set(tweet.id, mapTweetMetrics(tweet));
		}
	}

	return result;
}

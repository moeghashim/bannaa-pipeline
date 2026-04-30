"use node";

const POSTIZ_API_BASE = "https://api.postiz.com/public/v1";

type PostizMetricPoint = {
	total?: string | number;
	date?: string;
};

type PostizMetric = {
	label?: string;
	data?: PostizMetricPoint[];
	percentageChange?: number;
};

export type PostizIntegrationMetricSnapshot = {
	integrationId: string;
	provider: string;
	name: string;
	windowDays: number;
	views?: number;
	likes?: number;
	comments?: number;
	shares?: number;
	saves?: number;
	followers?: number;
	reach?: number;
	rawMetricCount: number;
};

function apiKey(): string {
	const key = process.env.POSTIZ_API_KEY;
	if (!key) throw new Error("POSTIZ_API_KEY not set");
	return key;
}

function normalizeLabel(label: string): string {
	return label.toLowerCase().replaceAll(/[\s_-]+/g, "");
}

function numericTotal(value: string | number | undefined): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value !== "string") return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function latestTotal(metric: PostizMetric): number | undefined {
	const points = metric.data ?? [];
	for (let index = points.length - 1; index >= 0; index -= 1) {
		const total = numericTotal(points[index]?.total);
		if (total !== undefined) return total;
	}
	return undefined;
}

function assignMetric(snapshot: PostizIntegrationMetricSnapshot, metric: PostizMetric): void {
	const label = normalizeLabel(metric.label ?? "");
	const total = latestTotal(metric);
	if (total === undefined) return;
	if (label === "views" || label === "view" || label === "impression" || label === "impressions") {
		snapshot.views = total;
		return;
	}
	if (label === "likes" || label === "like") {
		snapshot.likes = total;
		return;
	}
	if (label === "comments" || label === "comment" || label === "replies" || label === "reply") {
		snapshot.comments = total;
		return;
	}
	if (label === "shares" || label === "share" || label === "retweet" || label === "retweets" || label === "quote") {
		snapshot.shares = (snapshot.shares ?? 0) + total;
		return;
	}
	if (label === "saves" || label === "save" || label === "bookmark" || label === "bookmarks") {
		snapshot.saves = total;
		return;
	}
	if (label === "followercount" || label === "followers" || label === "follower") {
		snapshot.followers = total;
		return;
	}
	if (label === "reach") {
		snapshot.reach = total;
	}
}

export async function fetchPostizIntegrationMetrics(input: {
	integrationId: string;
	provider: string;
	name: string;
	windowDays: number;
}): Promise<PostizIntegrationMetricSnapshot> {
	const params = new URLSearchParams({ date: String(input.windowDays) });
	const response = await fetch(`${POSTIZ_API_BASE}/analytics/${input.integrationId}?${params.toString()}`, {
		headers: { Authorization: apiKey() },
	});
	if (!response.ok) {
		throw new Error(`Postiz /analytics/${input.integrationId} failed: ${response.status} ${await response.text()}`);
	}
	const body = (await response.json()) as unknown;
	const rows: PostizMetric[] = Array.isArray(body) ? (body as PostizMetric[]) : [];
	const snapshot: PostizIntegrationMetricSnapshot = {
		integrationId: input.integrationId,
		provider: input.provider,
		name: input.name,
		windowDays: input.windowDays,
		rawMetricCount: rows.length,
	};
	for (const row of rows) assignMetric(snapshot, row);
	return snapshot;
}

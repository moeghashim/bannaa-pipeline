import type { ChannelHealthHint, Channel } from "./prompts";

type Snapshot = {
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

export function postizProviderForChannel(channel: Channel): string {
	const map: Record<Channel, string> = {
		x: "x",
		ig: "instagram",
		"ig-reel": "instagram",
		tiktok: "tiktok",
		"yt-shorts": "youtube",
		"fb-page": "facebook",
		"linkedin-page": "linkedin-page",
	};
	return map[channel];
}

function compactNumber(value: number): string {
	return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function renderChannelHealthHint(snapshot: Snapshot | null): ChannelHealthHint | undefined {
	if (!snapshot) return undefined;
	const metrics = [
		["views", snapshot.views],
		["likes", snapshot.likes],
		["comments", snapshot.comments],
		["shares", snapshot.shares],
		["saves", snapshot.saves],
		["followers", snapshot.followers],
		["reach", snapshot.reach],
	]
		.filter((entry): entry is [string, number] => typeof entry[1] === "number")
		.map(([label, value]) => `${compactNumber(value)} ${label}`);

	const visibleMetrics = metrics.length > 0 ? metrics.join(", ") : `${snapshot.rawMetricCount} raw Postiz metrics`;
	return {
		summary: `Latest ${snapshot.windowDays}d Postiz snapshot for ${snapshot.name} (${snapshot.provider}): ${visibleMetrics}. Attribution is integration/account-level, not per-post or per-draft performance.`,
	};
}

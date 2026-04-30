import type { Channel } from "../types";

export const CHANNELS: { value: Channel | "all"; label: string }[] = [
	{ value: "all", label: "All channels" },
	{ value: "x", label: "X" },
	{ value: "ig", label: "Instagram" },
	{ value: "ig-reel", label: "IG Reels" },
	{ value: "tiktok", label: "TikTok" },
	{ value: "yt-shorts", label: "YT Shorts" },
	{ value: "fb-page", label: "FB Page" },
	{ value: "linkedin-page", label: "LinkedIn" },
];

const VIDEO_CHANNELS: readonly Channel[] = ["ig-reel", "tiktok", "yt-shorts"];

export const isVideoChannel = (c: string): boolean => (VIDEO_CHANNELS as readonly string[]).includes(c);

export const channelLabel = (c: string): string => {
	const map: Record<string, string> = {
		x: "X",
		ig: "Instagram",
		"ig-reel": "Instagram Reels",
		tiktok: "TikTok",
		"yt-shorts": "YouTube Shorts",
		"fb-page": "Facebook Page",
		"linkedin-page": "LinkedIn Page",
	};
	return map[c] ?? c;
};

export const channelFrame = (c: string): "square" | "vertical" => {
	if (isVideoChannel(c)) return "vertical";
	return "square";
};

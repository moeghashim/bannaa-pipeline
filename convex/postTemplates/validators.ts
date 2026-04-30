import { v } from "convex/values";

export const channelValidator = v.union(
	v.literal("x"),
	v.literal("ig"),
	v.literal("ig-reel"),
	v.literal("tiktok"),
	v.literal("yt-shorts"),
	v.literal("fb-page"),
	v.literal("linkedin-page"),
);

export const templateSuggestionValidator = v.object({
	name: v.string(),
	structureNotes: v.string(),
});

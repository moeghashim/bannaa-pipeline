import { v } from "convex/values";

export const brandRegisterValidator = v.union(v.literal("formal"), v.literal("casual"), v.literal("playful"));

export const brandReadingLevelValidator = v.union(
	v.literal("beginner"),
	v.literal("intermediate"),
	v.literal("advanced"),
);

export const brandEmojiPolicyValidator = v.union(v.literal("never"), v.literal("sparse"), v.literal("free"));

export const brandToneValidator = v.object({
	voicePersona: v.string(),
	register: brandRegisterValidator,
	readingLevel: brandReadingLevelValidator,
	maxSentenceChars: v.number(),
	emojiPolicy: brandEmojiPolicyValidator,
	doPhrases: v.array(v.string()),
	dontPhrases: v.array(v.string()),
	arPresets: v.record(v.string(), v.string()),
	activeArPreset: v.string(),
	channelOverrides: v.optional(v.record(v.string(), v.string())),
});

export const brandDesignValidator = v.object({
	palette: v.object({
		primary: v.string(),
		accent: v.string(),
		neutral: v.string(),
		background: v.string(),
		text: v.string(),
	}),
	typography: v.object({
		heading: v.string(),
		body: v.string(),
		mono: v.string(),
	}),
	logoChipText: v.string(),
	footerText: v.string(),
	footerUrl: v.string(),
	layout: v.object({
		chipPosition: v.union(v.literal("top-left"), v.literal("top-right")),
		footerPosition: v.union(v.literal("bottom-left"), v.literal("bottom-right")),
		margins: v.number(),
	}),
	imageStyleGuide: v.string(),
	bannedSubjects: v.array(v.string()),
});

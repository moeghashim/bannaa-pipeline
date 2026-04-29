export const DEFAULT_AR_PRESETS: Record<string, string> = {
	"ar-msa": "Modern Standard Arabic (Fusha), formal, publication-ready, no dialect markers.",
	"ar-saudi":
		"Saudi/Khaleeji dialect, conversational, natural for Gulf readers, not formal MSA. Avoid stiff academic phrasing.",
	"ar-egy": "Egyptian Arabic, Cairene register, conversational. Common markers like إزاي, كده, ده/دي welcome.",
};

export const DEFAULT_CHANNEL_OVERRIDES: Record<string, string> = {
	x: "Punchy, opinionated. One clear thesis per post. No hashtags.",
			ig: "Curious, inviting. A short insight with one takeaway. One or two hashtags are acceptable.",
	"ig-reel": "Short, visual, active voice. Point the viewer to the payoff in the video.",
	tiktok: "Native short-video voice. Direct address. Set up the hook quickly.",
	"yt-shorts": "Title-like, information-dense. The operator will compose the video separately.",
	"fb-page": "Warmer and more conversational. Invite discussion.",
	"linkedin-page": "Professional and thoughtful. Framed as an operator reflection, with substance.",
};

export const DEFAULT_IMAGE_STYLE_GUIDE = [
	"Modern minimalist, warm off-white and muted terracotta palette.",
	"Use oklch-warm neutrals, a soft terracotta accent, and no harsh primaries.",
	"Leave the top-right and bottom-left quadrants relatively empty for text overlay.",
].join(" ");

export function defaultBrandInput(now: number) {
	return {
		name: "Bannaa",
		isActive: true,
		tone: {
			voicePersona: "friendly AI educator for Gulf readers, conversational, not academic",
			register: "casual" as const,
			readingLevel: "intermediate" as const,
			maxSentenceChars: 220,
			emojiPolicy: "sparse" as const,
			doPhrases: [],
			dontPhrases: [],
			arPresets: DEFAULT_AR_PRESETS,
			activeArPreset: "ar-saudi",
			channelOverrides: DEFAULT_CHANNEL_OVERRIDES,
		},
		design: {
			palette: {
				primary: "oklch-warm-terracotta",
				accent: "#d97757",
				neutral: "#f5e8d8",
				background: "#fff8ec",
				text: "#2a1f18",
			},
			typography: {
				heading: "JetBrains Mono",
				body: "JetBrains Mono",
				mono: "JetBrains Mono",
			},
			logoChipText: "BANNAA",
			footerText: "bannaa.co",
			footerUrl: "https://bannaa.co",
			layout: {
				chipPosition: "top-left" as const,
				footerPosition: "bottom-left" as const,
				margins: 48,
			},
			imageStyleGuide: DEFAULT_IMAGE_STYLE_GUIDE,
			bannedSubjects: [],
		},
		version: 1,
		updatedAt: now,
	};
}

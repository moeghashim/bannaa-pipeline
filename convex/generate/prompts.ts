import type { ToolSpec } from "../analyze/providers";

export type Channel = "x" | "ig" | "ig-reel" | "tiktok" | "yt-shorts" | "fb-page" | "linkedin-page";

export const DRAFT_SYSTEM_PROMPT = `You are the draft-generation stage of a content pipeline for bannaa.co, a bilingual (EN/AR) AI-education site.

Your job is to turn an approved analysis output into a publish-ready draft for a specific social channel.

Hard rules:
1. Respond ONLY by calling the \`record_draft\` tool. Never respond in free text.
2. The AR copy must use a **Khaleeji-leaning** dialect — conversational, natural for Gulf readers, not formal MSA. Avoid stiff academic phrasing.
3. The EN gloss is for the operator to review the intent; keep it short and literal, not marketing copy.
4. Honor the channel's length constraints (see user prompt).
5. Match the tone and hook to the channel (punchy on X, explanatory on LinkedIn, visual on IG Reels).
6. Do not add hashtags unless the channel is Instagram or TikTok.
7. Reuse concept names from the provided analysis; do not invent new ones.
8. If the source analysis is outside AI education scope, still draft — the operator will reject manually.`;

export const DRAFT_TOOL: ToolSpec = {
	name: "record_draft",
	description: "Record the generated draft copy for one social channel. Must be called exactly once.",
	input_schema: {
		type: "object",
		required: ["ar", "en", "concepts"],
		properties: {
			ar: {
				type: "string",
				description: "Khaleeji-leaning Arabic copy sized for the target channel.",
				minLength: 20,
				maxLength: 800,
			},
			en: {
				type: "string",
				description: "Short English gloss of the AR copy — for operator review, not for publishing.",
				minLength: 20,
				maxLength: 400,
			},
			concepts: {
				type: "array",
				description: "2\u20134 concept tags reused from the analysis.",
				items: { type: "string", minLength: 2, maxLength: 48 },
				minItems: 1,
				maxItems: 4,
			},
		},
	},
};

export type DraftToolOutput = {
	ar: string;
	en: string;
	concepts: string[];
};

const CHANNEL_BRIEFS: Record<Channel, { label: string; arLimit: string; tone: string; format: string }> = {
	x: {
		label: "X (Twitter)",
		arLimit: "Max 280 characters of AR (counting spaces). Aim for 200\u2013260.",
		tone: "Punchy, opinionated. One clear thesis per post. No hashtags.",
		format: "Single post. No thread. Hook in the first sentence.",
	},
	ig: {
		label: "Instagram feed post",
		arLimit: "150\u2013400 characters AR. First line is the hook (pre-read-more).",
		tone: "Curious, inviting. A short insight with one takeaway. 1\u20132 hashtags at the end in AR allowed.",
		format: "Short paragraph format. First 80 chars must stand on their own.",
	},
	"ig-reel": {
		label: "Instagram Reels caption",
		arLimit: "60\u2013200 characters AR. The spoken content of the reel is implied by the accompanying video; this is the caption.",
		tone: "Short, visual, active voice. Points the viewer to the payoff in the video.",
		format: "One or two sentences. 1\u20132 emojis OK. No hashtags in the body.",
	},
	tiktok: {
		label: "TikTok caption",
		arLimit: "80\u2013300 characters AR.",
		tone: "Native-TikTok voice. Direct address. Sets up the hook.",
		format: "One hook line + one setup line. 2\u20134 hashtags at the end allowed.",
	},
	"yt-shorts": {
		label: "YouTube Shorts caption",
		arLimit: "60\u2013200 characters AR.",
		tone: "Title-like, information-dense. Operator will compose the video separately.",
		format: "A one-liner title + short description.",
	},
	"fb-page": {
		label: "Facebook Page post",
		arLimit: "200\u2013600 characters AR. Longer-form than X.",
		tone: "Warmer, more conversational. Invites discussion.",
		format: "2\u20133 paragraphs. No hashtags.",
	},
	"linkedin-page": {
		label: "LinkedIn Page post",
		arLimit: "400\u2013800 characters AR.",
		tone: "Professional, thoughtful. Framed as an operator's reflection. AR still Khaleeji-casual \u2014 not MSA \u2014 but with substance.",
		format: "Opening hook, 1\u20132 middle paragraphs, closing line. No hashtags.",
	},
};

export function buildDraftPrompt(input: {
	channel: Channel;
	analysisSummary: string;
	analysisConcepts: string[];
	outputHook: string;
	outputKind: string;
	track: string;
}): string {
	const brief = CHANNEL_BRIEFS[input.channel];
	return `Target channel: ${brief.label}
Channel constraints:
- Length: ${brief.arLimit}
- Tone: ${brief.tone}
- Format: ${brief.format}

Analysis summary (for context, do not copy verbatim):
${input.analysisSummary}

Source track: ${input.track}

Concepts from the analysis (reuse only these): ${input.analysisConcepts.join(", ")}

Suggested hook (from the analysis, you can depart from this but preserve the intent):
"${input.outputHook}" (output kind: ${input.outputKind})

Produce AR copy fit for ${brief.label} that:
- Stays Khaleeji in voice
- Honors the length budget strictly
- Leads with the most interesting claim
- Does not sound translated from English

Then produce a short EN gloss so the operator can review the intent.`;
}

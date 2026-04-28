import type { ToolSpec } from "../analyze/providers";

export type Channel = "x" | "ig" | "ig-reel" | "tiktok" | "yt-shorts" | "fb-page" | "linkedin-page";

export type Angle = "explainer" | "news" | "hot_take" | "use_case" | "debunk" | "tutorial";

export const ANGLES: readonly Angle[] = [
	"explainer",
	"news",
	"hot_take",
	"use_case",
	"debunk",
	"tutorial",
] as const;

export const ANGLE_GUIDANCE: Record<Angle, string> = {
	explainer: "Walk the reader through how a concept or technique works. Calm, instructive tone.",
	news: "Report a development plainly. Lead with what happened and who it affects.",
	hot_take: "Stake an opinion. Confident, specific, willing to disagree with the popular take.",
	use_case: "Show a concrete application or workflow. Practical, grounded in a real scenario.",
	debunk: "Correct a misconception. Name the wrong claim, then state what's actually true.",
	tutorial: "Give a short step-by-step. Numbered steps or imperative sentences.",
};

export const DRAFT_PROMPT_VERSION = "2026-04-27-a";
export const TRANSLATE_PROMPT_VERSION = "2026-04-27-a";

export const DRAFT_SYSTEM_PROMPT = `You are the draft-generation stage of a content pipeline for bannaa.co.

Your job is to turn an approved analysis output into a publish-ready draft for a specific social channel.

Hard rules:
1. Respond ONLY by calling the \`record_draft\` tool. Never respond in free text.
2. Follow the active brand voice and channel tone supplied in the system context.
3. Honor the channel's length constraints (see user prompt).
4. Match the hook structure to the channel.
5. Do not add hashtags unless the channel is Instagram or TikTok.
6. Reuse concept names from the provided analysis; do not invent new ones.
7. Pick the editorial angle that best fits the analysis. The angle drives tone and structure — see the user prompt for the menu.
8. If the source analysis is outside AI education scope, still draft — the operator will reject manually.`;

export const DRAFT_TOOL_EN: ToolSpec = {
	name: "record_draft",
	description: "Record the generated English draft copy for one social channel. Must be called exactly once.",
	input_schema: {
		type: "object",
		required: ["primary", "concepts", "angle"],
		properties: {
			primary: {
				type: "string",
				description: "English copy sized for the target channel.",
				minLength: 20,
				maxLength: 800,
			},
			concepts: {
				type: "array",
				description: "2\u20134 concept tags reused from the analysis.",
				items: { type: "string", minLength: 2, maxLength: 48 },
				minItems: 1,
				maxItems: 4,
			},
			angle: {
				type: "string",
				enum: ANGLES as readonly string[],
				description: "Editorial angle that best fits this draft.",
			},
		},
	},
};

export type DraftToolOutput = {
	primary: string;
	concepts: string[];
	angle: Angle;
};

export const TRANSLATE_TOOL: ToolSpec = {
	name: "record_translation",
	description: "Record one translated draft. Must be called exactly once.",
	input_schema: {
		type: "object",
		required: ["text", "chars"],
		properties: {
			text: {
				type: "string",
				description: "Translated copy sized for the target channel.",
				minLength: 10,
				maxLength: 900,
			},
			chars: {
				type: "number",
				description: "Character count of text, including spaces.",
				minimum: 1,
				maximum: 900,
			},
		},
	},
};

export type TranslateToolOutput = {
	text: string;
	chars: number;
};

const CHANNEL_BRIEFS: Record<Channel, { label: string; charLimit: string; format: string }> = {
	x: {
		label: "X (Twitter)",
		charLimit: "Max 280 characters counting spaces. Aim for 200\u2013260.",
		format: "Single post. No thread. Hook in the first sentence.",
	},
	ig: {
		label: "Instagram feed post",
		charLimit: "150\u2013400 characters. First line is the hook (pre-read-more).",
		format: "Short paragraph format. First 80 chars must stand on their own.",
	},
	"ig-reel": {
		label: "Instagram Reels caption",
		charLimit: "60\u2013200 characters. The spoken content of the reel is implied by the accompanying video; this is the caption.",
		format: "One or two sentences. 1\u20132 emojis OK. No hashtags in the body.",
	},
	tiktok: {
		label: "TikTok caption",
		charLimit: "80\u2013300 characters.",
		format: "One hook line + one setup line. 2\u20134 hashtags at the end allowed.",
	},
	"yt-shorts": {
		label: "YouTube Shorts caption",
		charLimit: "60\u2013200 characters.",
		format: "A one-liner title + short description.",
	},
	"fb-page": {
		label: "Facebook Page post",
		charLimit: "200\u2013600 characters. Longer-form than X.",
		format: "2\u20133 paragraphs. No hashtags.",
	},
	"linkedin-page": {
		label: "LinkedIn Page post",
		charLimit: "400\u2013800 characters.",
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
	const angleMenu = ANGLES.map((a) => `- ${a}: ${ANGLE_GUIDANCE[a]}`).join("\n");
	return `Target channel: ${brief.label}
Channel constraints:
- Length: ${brief.charLimit}
- Format: ${brief.format}

Analysis summary (for context, do not copy verbatim):
${input.analysisSummary}

Source track: ${input.track}

Concepts from the analysis (reuse only these): ${input.analysisConcepts.join(", ")}

Suggested hook (from the analysis, you can depart from this but preserve the intent):
"${input.outputHook}" (output kind: ${input.outputKind})

Editorial angles — pick the one that best fits the source and report it as \`angle\`:
${angleMenu}

Produce English copy fit for ${brief.label} that:
- Follows the active brand voice
- Honors the length budget strictly
- Leads with the most interesting claim
- Reflects the chosen angle in tone and structure

Use only concepts from the supplied list. Do not invent new concept tags.`;
}

export function buildTranslatePrompt(input: {
	channel: Channel;
	primary: string;
	targetLang: string;
	brandVoicePreset: string;
	angle?: Angle;
}): string {
	const brief = CHANNEL_BRIEFS[input.channel];
	const angleLine = input.angle
		? `\nEditorial angle (preserve in translation): ${input.angle} — ${ANGLE_GUIDANCE[input.angle]}\n`
		: "";
	return `Target channel: ${brief.label}
Target language: ${input.targetLang}
Channel constraints:
- Length: ${brief.charLimit}
- Format: ${brief.format}
${angleLine}
Brand language guidance:
${input.brandVoicePreset}

English source copy:
${input.primary}

Translate the source into the target language. Preserve the intent, hook, and channel fit. Do not add claims or concept names.`;
}

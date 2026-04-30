import type { ToolSpec } from "../analyze/providers";
import { isArabicDialect, LANG_NAMES, type OutputLanguage } from "./languages";

export type Channel = "x" | "ig" | "ig-reel" | "tiktok" | "yt-shorts" | "fb-page" | "linkedin-page";

export type Angle = "explainer" | "news" | "hot_take" | "use_case" | "debunk" | "tutorial";

export type PostTemplateReference = {
	name: string;
	structureNotes: string;
};

export const ANGLES: readonly Angle[] = [
	"explainer",
	"news",
	"hot_take",
	"use_case",
	"debunk",
	"tutorial",
] as const;

/**
 * Deterministic angle distribution for a batch of N drafts on one
 * channel from one analysis. Front-loads the highest-leverage angles
 * (explainer, hot_take, use_case) and only reaches for the niche ones
 * (news, tutorial, debunk) at higher counts. Loops past 6.
 */
export function angleSlotPlan(count: number): Angle[] {
	const priority: Angle[] = ["explainer", "hot_take", "use_case", "news", "tutorial", "debunk"];
	const out: Angle[] = [];
	for (let i = 0; i < count; i++) out.push(priority[i % priority.length]);
	return out;
}

export const ANGLE_GUIDANCE: Record<Angle, string> = {
	explainer: "Walk the reader through how a concept or technique works. Calm, instructive tone.",
	news: "Report a development plainly. Lead with what happened and who it affects.",
	hot_take: "Stake an opinion. Confident, specific, willing to disagree with the popular take.",
	use_case: "Show a concrete application or workflow. Practical, grounded in a real scenario.",
	debunk: "Correct a misconception. Name the wrong claim, then state what's actually true.",
	tutorial: "Give a short step-by-step. Numbered steps or imperative sentences.",
};

export const DRAFT_PROMPT_VERSION = "2026-04-30-a";
export const TRANSLATE_PROMPT_VERSION = "2026-04-28-a";

const DIALECT_HINT: Partial<Record<OutputLanguage, string>> = {
	"ar-msa": "Use Modern Standard Arabic (Fusha). Formal register, no dialect markers.",
	"ar-saudi": "Use Saudi/Khaleeji dialect — Gulf register. Common Saudi colloquialisms welcome.",
	"ar-egy": "Use Egyptian Arabic dialect — Cairene register. Use markers like إزاي / كده / ده / دي.",
};

export function buildDraftSystemPrompt(lang: OutputLanguage): string {
	const dialect = DIALECT_HINT[lang];
	const langLine = `Write the primary copy in ${LANG_NAMES[lang]}.${dialect ? ` ${dialect}` : ""}`;
	return `You are the draft-generation stage of a content pipeline for bannaa.co.

Your job is to turn an approved analysis output into a publish-ready draft for a specific social channel.

${langLine}

Hard rules:
1. Respond ONLY by calling the \`record_draft\` tool. Never respond in free text.
2. Follow the active brand voice and channel tone supplied in the system context.
3. Honor the channel's length constraints (see user prompt).
4. Match the hook structure to the channel.
5. Do not add hashtags unless the channel is Instagram or TikTok.
6. Reuse concept names from the provided analysis; do not invent new ones (concept tags stay in English regardless of primary language — they're internal taxonomy).
7. Pick the editorial angle that best fits the analysis. The angle drives tone and structure — see the user prompt for the menu.
8. If the source analysis is outside AI education scope, still draft — the operator will reject manually.`;
}

export function renderPostTemplateReference(template: PostTemplateReference | null | undefined): string {
	if (!template) return "";
	return `<reference_post_template>
Name: ${template.name}

Reusable structure notes:
${template.structureNotes}

Instructions:
- Follow the structure, pacing, hook mechanics, and CTA shape.
- Do not copy prior wording or preserve topic-specific facts.
- The current analysis and active brand remain the source of truth.
</reference_post_template>`;
}

// Kept so any remaining direct importers compile; new code should call
// `buildDraftSystemPrompt(lang)`.
export const DRAFT_SYSTEM_PROMPT = buildDraftSystemPrompt("en");

export const DRAFT_TOOL: ToolSpec = {
	name: "record_draft",
	description: "Record the generated draft copy for one social channel. Must be called exactly once.",
	input_schema: {
		type: "object",
		required: ["primary", "concepts", "angle"],
		properties: {
			primary: {
				type: "string",
				description: "Primary copy in the language specified by the system prompt, sized for the target channel.",
				minLength: 20,
				maxLength: 800,
			},
			concepts: {
				type: "array",
				description: "2\u20134 concept tags reused from the analysis (English tags, internal taxonomy).",
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

// Deprecated alias. New code should import `DRAFT_TOOL`.
export const DRAFT_TOOL_EN = DRAFT_TOOL;

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

export const MAX_CHARS_BY_CHANNEL: Record<Channel, number> = {
	x: 280,
	ig: 400,
	"ig-reel": 200,
	tiktok: 300,
	"yt-shorts": 200,
	"fb-page": 600,
	"linkedin-page": 800,
};

export function buildTightenPrompt(input: {
	channel: Channel;
	previous: string;
	angle: Angle | undefined;
	concepts: string[];
	maxChars: number;
	lang?: OutputLanguage;
}): string {
	const brief = CHANNEL_BRIEFS[input.channel];
	const langName = LANG_NAMES[input.lang ?? "en"];
	return `Your previous draft was ${input.previous.length} characters, which exceeds the ${brief.label} hard limit of ${input.maxChars} characters.

Rewrite the draft under ${input.maxChars} characters in ${langName} while preserving:
- The chosen angle: ${input.angle ?? "(unset)"}
- The concept tags (reuse only these): ${input.concepts.join(", ")}
- The hook and the most interesting claim

Previous draft:
"${input.previous}"

Call \`record_draft\` with the tightened version. Same angle and concepts. Stay in ${langName}.`;
}

export function buildDraftPrompt(input: {
	channel: Channel;
	analysisSummary: string;
	analysisConcepts: string[];
	outputHook: string;
	outputKind: string;
	track: string;
	hookTemplate?: string;
	postTemplate?: PostTemplateReference;
	angleOverride?: Angle;
	lang?: OutputLanguage;
}): string {
	const brief = CHANNEL_BRIEFS[input.channel];
	const angleMenu = ANGLES.map((a) => `- ${a}: ${ANGLE_GUIDANCE[a]}`).join("\n");
	const hookHint = input.hookTemplate
		? `\nOPENER HINT (spirit, not verbatim — adapt to the topic):\n  «${input.hookTemplate}»\n`
		: "";
	const postTemplateBlock = input.postTemplate ? `\n${renderPostTemplateReference(input.postTemplate)}\n` : "";
	const angleSection = input.angleOverride
		? `\nMANDATORY ANGLE: this draft is part of a batch. You MUST set \`angle\` to "${input.angleOverride}".\nGuidance: ${ANGLE_GUIDANCE[input.angleOverride]}\n`
		: `\nEditorial angles — pick the one that best fits the source and report it as \`angle\`:\n${angleMenu}\n`;
	const langName = LANG_NAMES[input.lang ?? "en"];
	return `Target channel: ${brief.label}
Output language: ${langName}
Channel constraints:
- Length: ${brief.charLimit}
- Format: ${brief.format}

Analysis summary (for context, do not copy verbatim):
${input.analysisSummary}

Source track: ${input.track}

Concepts from the analysis (reuse only these): ${input.analysisConcepts.join(", ")}

Suggested hook (from the analysis, you can depart from this but preserve the intent):
"${input.outputHook}" (output kind: ${input.outputKind})
${hookHint}${postTemplateBlock}${angleSection}
Produce ${langName} copy fit for ${brief.label} that:
- Follows the active brand voice
- Honors the length budget strictly
- Leads with the most interesting claim
- Reflects the chosen angle in tone and structure

Use only concepts from the supplied list. Do not invent new concept tags. Concept tags stay in English (internal taxonomy).`;
}

export function buildTranslatePrompt(input: {
	channel: Channel;
	primary: string;
	sourceLang?: OutputLanguage;
	targetLang: string;
	brandVoicePreset: string;
	angle?: Angle;
}): string {
	const brief = CHANNEL_BRIEFS[input.channel];
	const angleLine = input.angle
		? `\nEditorial angle (preserve in translation): ${input.angle} — ${ANGLE_GUIDANCE[input.angle]}\n`
		: "";
	const sourceName = LANG_NAMES[input.sourceLang ?? "en"];
	const targetIsArabic = isArabicDialect(input.targetLang as OutputLanguage);
	const brandBlock = input.brandVoicePreset && targetIsArabic
		? `\nBrand language guidance:\n${input.brandVoicePreset}\n`
		: "";
	return `Target channel: ${brief.label}
Source language: ${sourceName}
Target language: ${input.targetLang}
Channel constraints:
- Length: ${brief.charLimit}
- Format: ${brief.format}
${angleLine}${brandBlock}
${sourceName} source copy:
${input.primary}

Translate the source into the target language. Preserve the intent, hook, and channel fit. Do not add claims or concept names.`;
}

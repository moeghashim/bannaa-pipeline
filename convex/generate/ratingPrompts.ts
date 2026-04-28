import type { ToolSpec } from "../analyze/providers";
import type { Angle, Channel } from "./prompts";

export const RATING_PROMPT_VERSION = "2026-04-27-a";

export const RATING_SYSTEM_PROMPT = `You score AI-education content drafts on a 0-100 scale for bannaa.co.

Each draft is rated across 4 dimensions, each worth 25 points:
- substance: does it teach something specific and useful about AI? Concrete > vague.
- hook: does the first sentence earn attention without clickbait?
- accuracy: do the claims faithfully reflect the source analysis? No invented details.
- voiceFit: does the copy match the active brand voice profile in the system context?

Hard rules:
1. Respond ONLY by calling the \`record_rating\` tool. Never respond in free text.
2. Score each dimension as an integer 0-25.
3. For each dimension, give a one-sentence reason (5-200 chars).
4. Be honest. Most drafts should land 50-80. Reserve 90+ for clearly excellent. Use <50 for drafts with concrete problems (factual error, off-brand voice, weak hook).`;

export const RATING_TOOL: ToolSpec = {
	name: "record_rating",
	description: "Score a draft on the four-dimension rubric. Must be called exactly once.",
	input_schema: {
		type: "object",
		required: [
			"substance",
			"hook",
			"accuracy",
			"voiceFit",
			"substanceReason",
			"hookReason",
			"accuracyReason",
			"voiceFitReason",
		],
		properties: {
			substance: { type: "integer", minimum: 0, maximum: 25 },
			hook: { type: "integer", minimum: 0, maximum: 25 },
			accuracy: { type: "integer", minimum: 0, maximum: 25 },
			voiceFit: { type: "integer", minimum: 0, maximum: 25 },
			substanceReason: { type: "string", minLength: 5, maxLength: 200 },
			hookReason: { type: "string", minLength: 5, maxLength: 200 },
			accuracyReason: { type: "string", minLength: 5, maxLength: 200 },
			voiceFitReason: { type: "string", minLength: 5, maxLength: 200 },
		},
	},
};

export type RatingToolOutput = {
	substance: number;
	hook: number;
	accuracy: number;
	voiceFit: number;
	substanceReason: string;
	hookReason: string;
	accuracyReason: string;
	voiceFitReason: string;
};

export function buildRatingPrompt(input: {
	channel: Channel;
	primary: string;
	angle: Angle | undefined;
	analysisSummary: string;
	concepts: string[];
}): string {
	return `Score this draft.

CHANNEL: ${input.channel}
ANGLE: ${input.angle ?? "(unset)"}

DRAFT TEXT:
"${input.primary}"

SOURCE ANALYSIS (for accuracy check):
${input.analysisSummary}

CONCEPTS used (drafts should reuse from these): ${input.concepts.join(", ")}

Score each dimension 0-25 and provide a one-sentence reason. Call \`record_rating\` exactly once.`;
}

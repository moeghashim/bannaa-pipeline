import type { ToolSpec } from "../analyze/providers";

export const CAROUSEL_PROMPT_VERSION = "2026-04-27-a";

export type SlideRole = "hook" | "concept" | "mechanism" | "example" | "payoff";

export const SLIDE_ROLES: readonly SlideRole[] = [
	"hook",
	"concept",
	"mechanism",
	"example",
	"payoff",
] as const;

export const SLIDE_ROLE_GUIDANCE: Record<SlideRole, string> = {
	hook: "First slide. One short attention-grabbing line. No setup, just the punch.",
	concept: "Define the core idea. Short. Answer: what is this?",
	mechanism: "Show how it works under the hood. Process, layers, flow.",
	example: "A concrete instance. Real names or real numbers.",
	payoff: "Final slide. Takeaway, question, or CTA that earns engagement.",
};

export function slideRolePlan(slideCount: number): SlideRole[] {
	if (slideCount <= 3) return ["hook", "concept", "payoff"];
	if (slideCount === 4) return ["hook", "concept", "example", "payoff"];
	return ["hook", "concept", "mechanism", "example", "payoff"];
}

export const CAROUSEL_SYSTEM_PROMPT = `You are the carousel-generation stage of a content pipeline for bannaa.co.

Your job is to turn an approved analysis into an Instagram feed carousel — a sequence of visually coherent slides, each with short English on-image text.

Hard rules:
1. Respond ONLY by calling the \`record_carousel\` tool. Never respond in free text.
2. Follow the active brand voice supplied in the system context. Each slide's primary text is what appears ON the image, so it must be short and punchy, not a paragraph.
3. The channelPrimary is the Instagram caption body (what the reader sees under the carousel).
4. \`styleAnchor\` describes ONLY the shared visual language (palette, composition, mood, texture). It MUST NOT mention specific subjects of any single slide, and MUST NOT request rendering text — it is the coherence vector so all slides look like siblings.
5. Each slide has its own \`imagePrompt\` in English describing only that slide's scene — subject, action, composition focal point — in 60-180 characters.
6. Reuse concept tags from the provided analysis; do not invent new ones.
7. \`orderIndex\` is 1-based and must be contiguous from 1 to the requested slideCount.
8. Each slide MUST be assigned the editorial \`role\` listed in the user prompt's plan. Match the role the plan dictates for that orderIndex; do not freelance.
9. Never include hashtags inside \`slides[].primary\`. Caption-level hashtags in \`channelPrimary\` are optional.`;

export const CAROUSEL_TOOL: ToolSpec = {
	name: "record_carousel",
	description:
		"Record a coherent IG carousel: shared styleAnchor, channel caption, and per-slide primary text + image prompt. Must be called exactly once.",
	input_schema: {
		type: "object",
		required: ["styleAnchor", "channelPrimary", "concepts", "slides"],
		properties: {
			styleAnchor: {
				type: "string",
				description: "Shared visual language: palette, composition, mood, texture. No text, no per-slide subjects. 60-200 chars.",
				minLength: 60,
				maxLength: 200,
			},
			channelPrimary: {
				type: "string",
				description: "The IG caption body in English. 150-400 chars.",
				minLength: 80,
				maxLength: 500,
			},
			concepts: {
				type: "array",
				description: "2-4 concept tags reused from the analysis.",
				items: { type: "string", minLength: 2, maxLength: 48 },
				minItems: 1,
				maxItems: 4,
			},
			slides: {
				type: "array",
				description:
					"The ordered slide list. Each slide has its English on-image text, English image prompt, and 1-based orderIndex.",
				minItems: 3,
				maxItems: 5,
				items: {
					type: "object",
					required: ["primary", "imagePrompt", "orderIndex", "role"],
					properties: {
						primary: {
							type: "string",
							description: "Short English text shown on this slide. 30-90 chars.",
							minLength: 10,
							maxLength: 120,
						},
						imagePrompt: {
							type: "string",
							description: "English description of this slide's visual only (subject + composition). 60-180 chars.",
							minLength: 30,
							maxLength: 240,
						},
						orderIndex: {
							type: "number",
							description: "1-based position in the carousel (1..slideCount).",
							minimum: 1,
							maximum: 5,
						},
						role: {
							type: "string",
							enum: SLIDE_ROLES as readonly string[],
							description: "Editorial role assigned by the plan in the user prompt.",
						},
					},
				},
			},
		},
	},
};

export type CarouselSlideOutput = {
	primary: string;
	imagePrompt: string;
	orderIndex: number;
	role: SlideRole;
};

export type CarouselToolOutput = {
	styleAnchor: string;
	channelPrimary: string;
	concepts: string[];
	slides: CarouselSlideOutput[];
};

export function buildCarouselPrompt(input: {
	slideCount: number;
	analysisSummary: string;
	analysisConcepts: string[];
	keyPoints: string[];
	track: string;
}): string {
	const plan = slideRolePlan(input.slideCount);
	const planLines = plan
		.map((role, i) => `- Slide ${i + 1} → role: ${role} — ${SLIDE_ROLE_GUIDANCE[role]}`)
		.join("\n");
	return `Target: Instagram feed carousel with exactly ${input.slideCount} slides.

Source track: ${input.track}

Analysis summary (use for context, do not copy verbatim):
${input.analysisSummary}

Key points from the analysis:
${input.keyPoints.map((k, i) => `${i + 1}. ${k}`).join("\n")}

Concepts from the analysis (reuse only these): ${input.analysisConcepts.join(", ")}

SLIDE PLAN (assign these exact roles by orderIndex):
${planLines}

Produce a coherent IG feed carousel with ${input.slideCount} slides:
- Each slide must match the role assigned in the plan above. Set \`role\` accordingly.
- The \`styleAnchor\` must describe the shared palette + composition + mood across ALL slides. Do NOT mention any specific slide subject. Do NOT ask for rendered text.
- Each slide's \`imagePrompt\` (English) describes only that slide's visual scene.
- The caption \`channelPrimary\` is a standalone IG caption body — a short paragraph that complements the carousel; it is NOT a repeat of the on-image text.

Use only concepts from the supplied list. Do not invent new concept tags.`;
}

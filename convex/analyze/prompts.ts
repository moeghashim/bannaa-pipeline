export const ANALYZE_SYSTEM_PROMPT = `You are the analysis stage of a content pipeline for bannaa.co, a bilingual (EN/AR) AI-education site. Your job is to turn captured source material (a tweet, YouTube video, article, or freeform operator note) into a structured analysis.

Scope: AI education only. Three tracks — Foundations, Agents, Media. The Media track, for this pipeline, covers video content (Reels, Shorts, video essays) and excludes podcast or audio-only pieces.

Hard rules:
1. Respond ONLY by calling the \`record_analysis\` tool. Never respond in free text.
2. Pick exactly one track based on where the lesson fits best.
3. Prefer concept names from the provided ontology when they apply. If a concept you need is not in the ontology, use a new name — the operator will review new concepts before they're added.
4. The \`summary\` must stand on its own: 3–6 sentences, plain English, no marketing tone.
5. \`keyPoints\` capture the 2–6 most interesting claims from the source, each a complete sentence.
6. \`outputs\` propose 1–5 candidate downstream artifacts:
   - \`tweet\` — a hook that could open an X post
   - \`reel\` — a 20–40 second short-form video hook
   - \`website\` — a one-line framing for a bannaa.co lesson or concept page
7. AR copy is generated later in a separate step; your output is EN only.
8. If the source is outside AI education scope, still produce the best analysis you can — the operator will reject it manually. Do not refuse.`;

export const ANALYZE_TOOL = {
	name: "record_analysis",
	description:
		"Record the structured analysis of the captured source. Must be called exactly once. Free-text responses are not accepted.",
	input_schema: {
		type: "object" as const,
		required: ["summary", "concepts", "keyPoints", "track", "outputs"],
		properties: {
			summary: {
				type: "string",
				description: "3–6 sentence plain-English summary.",
				minLength: 150,
				maxLength: 1400,
			},
			concepts: {
				type: "array",
				description: "1–8 concept tags from the ontology, or new names for review.",
				items: { type: "string", minLength: 2, maxLength: 48 },
				minItems: 1,
				maxItems: 8,
			},
			keyPoints: {
				type: "array",
				description: "2–6 standalone claims from the source.",
				items: { type: "string", minLength: 10, maxLength: 240 },
				minItems: 2,
				maxItems: 6,
			},
			track: {
				type: "string",
				enum: ["Foundations", "Agents", "Media"],
			},
			outputs: {
				type: "array",
				description: "1–5 candidate downstream artifacts.",
				items: {
					type: "object",
					required: ["kind", "hook"],
					properties: {
						kind: { type: "string", enum: ["tweet", "reel", "website"] },
						hook: { type: "string", minLength: 30, maxLength: 280 },
					},
				},
				minItems: 1,
				maxItems: 5,
			},
		},
	},
};

export type AnalyzeToolOutput = {
	summary: string;
	concepts: string[];
	keyPoints: string[];
	track: "Foundations" | "Agents" | "Media";
	outputs: { kind: "tweet" | "reel" | "website"; hook: string }[];
};

export function buildUserPrompt(input: {
	source: string;
	handle: string;
	title: string;
	snippet: string;
	raw?: string;
	url?: string;
	ontology: string[];
}): string {
	const body = input.raw ?? input.snippet;
	return `Source metadata
- type: ${input.source}
- handle: ${input.handle}
- title: ${input.title}
- url: ${input.url ?? "(none)"}

Ontology (prefer these concept names when they apply):
${input.ontology.map((c) => `- ${c}`).join("\n")}

Source content:
${body}`;
}

const INPUT_RATE_PER_MTOK = 3;
const OUTPUT_RATE_PER_MTOK = 15;

export function estimateCost(inputTokens: number, outputTokens: number): number {
	return (inputTokens / 1_000_000) * INPUT_RATE_PER_MTOK + (outputTokens / 1_000_000) * OUTPUT_RATE_PER_MTOK;
}

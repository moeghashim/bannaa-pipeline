"use node";

import OpenAI from "openai";

export const DEDUP_THRESHOLD = 0.85;
export const DEDUP_RECENT_LIMIT = 50;
export const EMBEDDING_MODEL = "text-embedding-3-small";
// $0.02 per 1M tokens as of 2026-04 — keep in sync with OpenAI pricing.
export const EMBEDDING_INPUT_COST_PER_1M = 0.02;

export type EmbeddingResult = {
	embedding: number[];
	inputTokens: number;
	cost: number;
};

export async function embedText(text: string, apiKey: string): Promise<EmbeddingResult> {
	const client = new OpenAI({ apiKey });
	const res = await client.embeddings.create({
		model: EMBEDDING_MODEL,
		input: text,
	});
	const inputTokens = res.usage?.prompt_tokens ?? 0;
	return {
		embedding: res.data[0].embedding,
		inputTokens,
		cost: (inputTokens / 1_000_000) * EMBEDDING_INPUT_COST_PER_1M,
	};
}

export function cosine(a: number[], b: number[]): number {
	if (a.length !== b.length || a.length === 0) return 0;
	let dot = 0;
	let na = 0;
	let nb = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		na += a[i] * a[i];
		nb += b[i] * b[i];
	}
	if (na === 0 || nb === 0) return 0;
	return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

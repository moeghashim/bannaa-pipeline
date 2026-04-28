"use node";

import OpenAI from "openai";

export const DEDUP_THRESHOLD = 0.85;
export const DEDUP_RECENT_LIMIT = 50;
export const EMBEDDING_MODEL = "text-embedding-3-small";

export async function embedText(text: string, apiKey: string): Promise<number[]> {
	const client = new OpenAI({ apiKey });
	const res = await client.embeddings.create({
		model: EMBEDDING_MODEL,
		input: text,
	});
	return res.data[0].embedding;
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

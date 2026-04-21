import { v } from "convex/values";
import { internalMutation, mutation } from "../_generated/server";
import { requireUser } from "../lib/requireUser";

const DEFAULT_SEED: { name: string; track: "Foundations" | "Agents" | "Media" }[] = [
	{ name: "transformer", track: "Foundations" },
	{ name: "attention", track: "Foundations" },
	{ name: "tokenizer", track: "Foundations" },
	{ name: "embedding", track: "Foundations" },
	{ name: "context window", track: "Foundations" },
	{ name: "fine-tuning", track: "Foundations" },
	{ name: "RLHF", track: "Foundations" },
	{ name: "synthetic data", track: "Foundations" },
	{ name: "distillation", track: "Foundations" },
	{ name: "evaluation", track: "Foundations" },
	{ name: "latent space", track: "Foundations" },
	{ name: "agent loop", track: "Agents" },
	{ name: "tool use", track: "Agents" },
	{ name: "orchestrator", track: "Agents" },
	{ name: "RAG", track: "Agents" },
	{ name: "long-context", track: "Agents" },
	{ name: "alignment", track: "Agents" },
	{ name: "chain-of-thought", track: "Agents" },
	{ name: "self-consistency", track: "Agents" },
	{ name: "reflection", track: "Agents" },
];

async function seedConcepts(
	ctx: { db: { query: Function; insert: Function } },
	seed: { name: string; track: "Foundations" | "Agents" | "Media" }[],
) {
	const existing = await ctx.db.query("concepts").collect();
	const existingNames = new Set(existing.map((c: { name: string }) => c.name.toLowerCase()));
	const now = Date.now();
	let inserted = 0;
	for (const c of seed) {
		if (existingNames.has(c.name.toLowerCase())) continue;
		await ctx.db.insert("concepts", {
			name: c.name,
			track: c.track,
			approved: true,
			createdAt: now,
		});
		inserted += 1;
	}
	return inserted;
}

export const seedDefaults = mutation({
	args: {},
	handler: async (ctx) => {
		await requireUser(ctx);
		const inserted = await seedConcepts(ctx, DEFAULT_SEED);
		return { inserted };
	},
});

export const seedInternal = internalMutation({
	args: {
		concepts: v.optional(
			v.array(
				v.object({
					name: v.string(),
					track: v.union(v.literal("Foundations"), v.literal("Agents"), v.literal("Media")),
				}),
			),
		),
	},
	handler: async (ctx, { concepts }) => {
		const inserted = await seedConcepts(ctx, concepts ?? DEFAULT_SEED);
		return { inserted };
	},
});

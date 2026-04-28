import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";

export const loadItem = internalQuery({
	args: { id: v.id("inboxItems") },
	handler: async (ctx, { id }) => {
		return await ctx.db.get(id);
	},
});

export const listApprovedConceptNames = internalQuery({
	args: {},
	handler: async (ctx) => {
		const rows = await ctx.db.query("concepts").withIndex("by_name").collect();
		return rows.filter((r) => r.approved).map((r) => r.name);
	},
});

export const markAnalyzing = internalMutation({
	args: { id: v.id("inboxItems") },
	handler: async (ctx, { id }) => {
		await ctx.db.patch(id, { state: "analyzing", error: undefined });
	},
});

export const recordFailure = internalMutation({
	args: {
		id: v.id("inboxItems"),
		error: v.string(),
	},
	handler: async (ctx, { id, error }) => {
		await ctx.db.patch(id, { state: "new", error });
	},
});

export const recordSuccess = internalMutation({
	args: {
		itemId: v.id("inboxItems"),
		provider: v.union(v.literal("claude"), v.literal("glm"), v.literal("openrouter"), v.literal("deepseek")),
		model: v.string(),
		runAt: v.number(),
		summary: v.string(),
		concepts: v.array(v.string()),
		keyPoints: v.array(v.string()),
		track: v.union(v.literal("Foundations"), v.literal("Agents"), v.literal("Media")),
		outputs: v.array(
			v.object({
				kind: v.union(v.literal("tweet"), v.literal("reel"), v.literal("website")),
				hook: v.string(),
			}),
		),
		inputTokens: v.number(),
		outputTokens: v.number(),
		cost: v.number(),
		promptVersion: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const runId = await ctx.db.insert("providerRuns", {
			provider: args.provider,
			model: args.model,
			purpose: "analyze",
			itemId: args.itemId,
			inputTokens: args.inputTokens,
			outputTokens: args.outputTokens,
			cost: args.cost,
			runAt: args.runAt,
			promptVersion: args.promptVersion,
		});

		await ctx.db.insert("analyses", {
			itemId: args.itemId,
			provider: args.provider,
			runAt: args.runAt,
			summary: args.summary,
			concepts: args.concepts,
			keyPoints: args.keyPoints,
			track: args.track,
			outputs: args.outputs,
			runId,
		});

		// Insert any new (non-approved) concepts for operator review.
		const existing = await ctx.db.query("concepts").collect();
		const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));
		const now = Date.now();
		for (const name of args.concepts) {
			if (!existingNames.has(name.toLowerCase())) {
				await ctx.db.insert("concepts", {
					name,
					track: args.track,
					approved: false,
					createdAt: now,
				});
				existingNames.add(name.toLowerCase());
			}
		}

		await ctx.db.patch(args.itemId, { state: "draft", error: undefined });
	},
});

export const recordAudit = internalMutation({
	args: {
		itemId: v.id("inboxItems"),
		provider: v.union(v.literal("claude"), v.literal("glm"), v.literal("openrouter"), v.literal("deepseek")),
		model: v.string(),
		inputTokens: v.number(),
		outputTokens: v.number(),
		cost: v.number(),
		error: v.string(),
		promptVersion: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const id: Id<"providerRuns"> = await ctx.db.insert("providerRuns", {
			provider: args.provider,
			model: args.model,
			purpose: "analyze",
			itemId: args.itemId,
			inputTokens: args.inputTokens,
			outputTokens: args.outputTokens,
			cost: args.cost,
			runAt: Date.now(),
			error: args.error,
			promptVersion: args.promptVersion,
		});
		return id;
	},
});

import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";

const channelValidator = v.union(
	v.literal("x"),
	v.literal("ig"),
	v.literal("ig-reel"),
	v.literal("tiktok"),
	v.literal("yt-shorts"),
	v.literal("fb-page"),
	v.literal("linkedin-page"),
);

const angleValidator = v.union(
	v.literal("explainer"),
	v.literal("news"),
	v.literal("hot_take"),
	v.literal("use_case"),
	v.literal("debunk"),
	v.literal("tutorial"),
);

const providerValidator = v.union(
	v.literal("claude"),
	v.literal("glm"),
	v.literal("openrouter"),
	v.literal("deepseek"),
);

export type DedupCandidate = {
	_id: Id<"drafts">;
	embedding: number[];
};

export const latestAnalysis = internalQuery({
	args: {},
	handler: async (ctx): Promise<Doc<"analyses"> | null> => {
		const rows = await ctx.db.query("analyses").order("desc").take(1);
		return rows[0] ?? null;
	},
});

export const listDraftsForBackfill = internalQuery({
	args: { limit: v.number() },
	handler: async (ctx, { limit }): Promise<Doc<"drafts">[]> => {
		return await ctx.db.query("drafts").withIndex("by_createdAt").order("asc").take(limit);
	},
});

export const setDraftEmbedding = internalMutation({
	args: { id: v.id("drafts"), embedding: v.array(v.float64()) },
	handler: async (ctx, { id, embedding }): Promise<void> => {
		await ctx.db.patch(id, { embedding });
	},
});

export const recordEmbeddingRun = internalMutation({
	args: {
		model: v.string(),
		itemId: v.optional(v.id("inboxItems")),
		inputTokens: v.number(),
		cost: v.number(),
		purpose: v.string(),
		brandVersion: v.optional(v.number()),
		promptVersion: v.optional(v.string()),
	},
	returns: v.id("providerRuns"),
	handler: async (ctx, args): Promise<Id<"providerRuns">> => {
		return await ctx.db.insert("providerRuns", {
			provider: "openai-embedding",
			model: args.model,
			purpose: args.purpose,
			itemId: args.itemId,
			inputTokens: args.inputTokens,
			outputTokens: 0,
			cost: args.cost,
			runAt: Date.now(),
			brandVersion: args.brandVersion,
			promptVersion: args.promptVersion,
		});
	},
});

export const listRecentDraftsForDedup = internalQuery({
	args: { channel: channelValidator, limit: v.number() },
	handler: async (ctx, { channel, limit }): Promise<DedupCandidate[]> => {
		const rows = await ctx.db
			.query("drafts")
			.withIndex("by_channel", (q) => q.eq("channel", channel))
			.order("desc")
			.take(limit);
		const out: DedupCandidate[] = [];
		for (const row of rows) {
			if (row.embedding && row.embedding.length > 0) {
				out.push({ _id: row._id, embedding: row.embedding });
			}
		}
		return out;
	},
});

export const loadAnalysis = internalQuery({
	args: { id: v.id("analyses") },
	handler: async (ctx, { id }): Promise<Doc<"analyses"> | null> => {
		return await ctx.db.get(id);
	},
});

export const insertDraft = internalMutation({
	args: {
		channel: channelValidator,
		primary: v.string(),
		chars: v.number(),
		analysisId: v.id("analyses"),
		sourceItemId: v.id("inboxItems"),
		concepts: v.array(v.string()),
		angle: v.optional(angleValidator),
		embedding: v.optional(v.array(v.float64())),
		dedupSimilarity: v.optional(v.number()),
		dedupPriorDraftId: v.optional(v.id("drafts")),
		capturedBy: v.id("users"),
		provider: providerValidator,
		model: v.string(),
		inputTokens: v.number(),
		outputTokens: v.number(),
		cost: v.number(),
		brandVersion: v.optional(v.number()),
		promptVersion: v.optional(v.string()),
	},
	returns: v.id("drafts"),
	handler: async (ctx, args): Promise<Id<"drafts">> => {
		const runId = await ctx.db.insert("providerRuns", {
			provider: args.provider,
			model: args.model,
			purpose: "generate-draft",
			itemId: args.sourceItemId,
			inputTokens: args.inputTokens,
			outputTokens: args.outputTokens,
			cost: args.cost,
			runAt: Date.now(),
			brandVersion: args.brandVersion,
			promptVersion: args.promptVersion,
		});

		return await ctx.db.insert("drafts", {
			channel: args.channel,
			primary: args.primary,
			translations: [],
			chars: args.chars,
			state: "new",
			analysisId: args.analysisId,
			sourceItemId: args.sourceItemId,
			concepts: args.concepts,
			angle: args.angle,
			embedding: args.embedding,
			dedupSimilarity: args.dedupSimilarity,
			dedupPriorDraftId: args.dedupPriorDraftId,
			capturedBy: args.capturedBy,
			createdAt: Date.now(),
			genRunId: runId,
		});
	},
});

export const recordFailedRun = internalMutation({
	args: {
		provider: providerValidator,
		model: v.string(),
		error: v.string(),
		sourceItemId: v.id("inboxItems"),
		purpose: v.optional(v.string()),
		brandVersion: v.optional(v.number()),
		promptVersion: v.optional(v.string()),
	},
	returns: v.id("providerRuns"),
	handler: async (ctx, args): Promise<Id<"providerRuns">> => {
		return await ctx.db.insert("providerRuns", {
			provider: args.provider,
			model: args.model,
			purpose: args.purpose ?? "generate-draft",
			itemId: args.sourceItemId,
			inputTokens: 0,
			outputTokens: 0,
			cost: 0,
			runAt: Date.now(),
			error: args.error,
			brandVersion: args.brandVersion,
			promptVersion: args.promptVersion,
		});
	},
});

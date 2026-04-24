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

const providerValidator = v.union(v.literal("claude"), v.literal("glm"), v.literal("openrouter"));

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
			ar: "",
			en: args.primary,
			primary: args.primary,
			translations: [],
			chars: args.chars,
			state: "new",
			analysisId: args.analysisId,
			sourceItemId: args.sourceItemId,
			concepts: args.concepts,
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
		brandVersion: v.optional(v.number()),
		promptVersion: v.optional(v.string()),
	},
	returns: v.id("providerRuns"),
	handler: async (ctx, args): Promise<Id<"providerRuns">> => {
		return await ctx.db.insert("providerRuns", {
			provider: args.provider,
			model: args.model,
			purpose: "generate-draft",
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

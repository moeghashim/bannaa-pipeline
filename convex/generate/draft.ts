"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { callProvider, defaultProvider, type ProviderId } from "../analyze/providers";
import { defaultBrandInput } from "../brand/defaults";
import { requireUser } from "../lib/requireUser";
import { renderBrandSystemPrompt } from "./brandPrompt";
import { cosine, DEDUP_RECENT_LIMIT, DEDUP_THRESHOLD, embedText } from "./embeddings";
import {
	buildDraftPrompt,
	type Channel,
	DRAFT_PROMPT_VERSION,
	DRAFT_SYSTEM_PROMPT,
	DRAFT_TOOL_EN,
	type DraftToolOutput,
} from "./prompts";

const channelValidator = v.union(
	v.literal("x"),
	v.literal("ig"),
	v.literal("ig-reel"),
	v.literal("tiktok"),
	v.literal("yt-shorts"),
	v.literal("fb-page"),
	v.literal("linkedin-page"),
);

type RunResult =
	| { ok: true; draftId: Id<"drafts">; provider: ProviderId; model: string; cost: number }
	| { ok: false; error: string };

export const fromAnalysisOutput = action({
	args: {
		analysisId: v.id("analyses"),
		channel: channelValidator,
		outputIndex: v.number(),
	},
	returns: v.union(
		v.object({
			ok: v.literal(true),
			draftId: v.id("drafts"),
			provider: v.union(v.literal("claude"), v.literal("glm"), v.literal("openrouter"), v.literal("deepseek")),
			model: v.string(),
			cost: v.number(),
		}),
		v.object({ ok: v.literal(false), error: v.string() }),
	),
	handler: async (ctx, args): Promise<RunResult> => {
		const userId = await requireUser(ctx);

		const env = {
			ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
			GLM_API_KEY: process.env.GLM_API_KEY,
			GLM_MODEL: process.env.GLM_MODEL,
			OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
			OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
			DEFAULT_ANALYZE_PROVIDER: process.env.DEFAULT_ANALYZE_PROVIDER,
		};

		const settings: Doc<"settings"> | null = await ctx.runQuery(internal.settings.doc.getInternal, {});
		const provider: ProviderId = settings?.defaultProvider ?? defaultProvider(env);
		const activeBrand = await ctx.runQuery(internal.brand.doc.getActiveInternal, {});
		const brand = activeBrand ?? defaultBrandInput(Date.now());

		const analysis = await ctx.runQuery(internal.generate.internal.loadAnalysis, { id: args.analysisId });
		if (!analysis) return { ok: false, error: "Analysis not found" };

		const output = analysis.outputs[args.outputIndex];
		if (!output) return { ok: false, error: `Output index ${args.outputIndex} not found` };

		const userPrompt = buildDraftPrompt({
			channel: args.channel as Channel,
			analysisSummary: analysis.summary,
			analysisConcepts: analysis.concepts,
			outputHook: output.hook,
			outputKind: output.kind,
			track: analysis.track,
		});

		try {
			const result = await callProvider<DraftToolOutput>({
				provider,
				systemPrompt: `${renderBrandSystemPrompt(brand, args.channel as Channel)}\n\n${DRAFT_SYSTEM_PROMPT}`,
				tool: DRAFT_TOOL_EN,
				userPrompt,
				env,
			});

			if (!result.output?.primary) {
				throw new Error("Model did not return English primary copy");
			}

			let embedding: number[] | undefined;
			let dedupSimilarity: number | undefined;
			let dedupPriorDraftId: Id<"drafts"> | undefined;
			const openaiKey = process.env.OPENAI_API_KEY;
			if (openaiKey) {
				try {
					embedding = await embedText(result.output.primary, openaiKey);
					const candidates = await ctx.runQuery(internal.generate.internal.listRecentDraftsForDedup, {
						channel: args.channel,
						limit: DEDUP_RECENT_LIMIT,
					});
					let bestSim = 0;
					let bestId: Id<"drafts"> | undefined;
					for (const c of candidates) {
						const sim = cosine(embedding, c.embedding);
						if (sim > bestSim) {
							bestSim = sim;
							bestId = c._id;
						}
					}
					if (bestId && bestSim >= DEDUP_THRESHOLD) {
						dedupSimilarity = bestSim;
						dedupPriorDraftId = bestId;
					}
				} catch {
					// Embedding is best-effort — never block draft creation on it.
				}
			}

			const draftId: Id<"drafts"> = await ctx.runMutation(internal.generate.internal.insertDraft, {
				channel: args.channel,
				primary: result.output.primary,
				chars: result.output.primary.length,
				analysisId: args.analysisId,
				sourceItemId: analysis.itemId,
				concepts: result.output.concepts ?? analysis.concepts.slice(0, 3),
				angle: result.output.angle,
				embedding,
				dedupSimilarity,
				dedupPriorDraftId,
				capturedBy: userId,
				provider: result.provider,
				model: result.model,
				inputTokens: result.inputTokens,
				outputTokens: result.outputTokens,
				cost: result.cost,
				brandVersion: brand.version,
				promptVersion: DRAFT_PROMPT_VERSION,
			});

			return {
				ok: true,
				draftId,
				provider: result.provider,
				model: result.model,
				cost: result.cost,
			};
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			await ctx.runMutation(internal.generate.internal.recordFailedRun, {
				provider,
				model: "",
				error: msg,
				sourceItemId: analysis.itemId,
				brandVersion: brand.version,
				promptVersion: DRAFT_PROMPT_VERSION,
			});
			return { ok: false, error: msg };
		}
	},
});

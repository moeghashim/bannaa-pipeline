"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { callProvider, defaultProvider, type ProviderId } from "../analyze/providers";
import { defaultBrandInput } from "../brand/defaults";
import { renderBrandSystemPrompt } from "./brandPrompt";
import type { Channel } from "./prompts";
import {
	buildRatingPrompt,
	RATING_PROMPT_VERSION,
	RATING_SYSTEM_PROMPT,
	RATING_TOOL,
	type RatingToolOutput,
} from "./ratingPrompts";

/**
 * Scores one draft on the 4×25 rubric and patches the result back onto
 * the draft. Best-effort: failures are recorded as a failed providerRun
 * row but do NOT throw, since the draft itself is already persisted.
 *
 * Scheduled by `draft.fromAnalysisOutput` immediately after the draft
 * is inserted, so the operator sees the score appear within seconds of
 * the draft landing in the queue.
 */
export const run = internalAction({
	args: { draftId: v.id("drafts") },
	handler: async (ctx, { draftId }): Promise<{ ok: boolean; rating?: number; error?: string }> => {
		const env = {
			ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
			GLM_API_KEY: process.env.GLM_API_KEY,
			GLM_MODEL: process.env.GLM_MODEL,
			OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
			OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
			DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
			DEFAULT_ANALYZE_PROVIDER: process.env.DEFAULT_ANALYZE_PROVIDER,
		};

		const settings: Doc<"settings"> | null = await ctx.runQuery(internal.settings.doc.getInternal, {});
		const provider: ProviderId = settings?.defaultProvider ?? defaultProvider(env);
		const activeBrand = await ctx.runQuery(internal.brand.doc.getActiveInternal, {});
		const brand = activeBrand ?? defaultBrandInput(Date.now());

		const loaded = await ctx.runQuery(internal.generate.internal.loadDraftWithAnalysis, { draftId });
		if (!loaded) return { ok: false, error: "Draft or analysis not found" };
		const { draft, analysis } = loaded;

		const userPrompt = buildRatingPrompt({
			channel: draft.channel as Channel,
			primary: draft.primary,
			angle: draft.angle,
			analysisSummary: analysis.summary,
			concepts: draft.concepts,
		});

		try {
			const result = await callProvider<RatingToolOutput>({
				provider,
				systemPrompt: `${renderBrandSystemPrompt(brand, draft.channel as Channel)}\n\n${RATING_SYSTEM_PROMPT}`,
				tool: RATING_TOOL,
				userPrompt,
				env,
			});
			const o = result.output;
			if (!o) throw new Error("Rating model returned empty output");
			const total = o.substance + o.hook + o.accuracy + o.voiceFit;

			await ctx.runMutation(internal.generate.internal.applyRating, {
				draftId,
				rating: total,
				breakdown: {
					substance: { score: o.substance, reason: o.substanceReason },
					hook: { score: o.hook, reason: o.hookReason },
					accuracy: { score: o.accuracy, reason: o.accuracyReason },
					voiceFit: { score: o.voiceFit, reason: o.voiceFitReason },
				},
				provider: result.provider,
				model: result.model,
				inputTokens: result.inputTokens,
				outputTokens: result.outputTokens,
				cost: result.cost,
				brandVersion: brand.version,
				promptVersion: RATING_PROMPT_VERSION,
			});
			return { ok: true, rating: total };
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			await ctx.runMutation(internal.generate.internal.recordFailedRun, {
				provider,
				model: "",
				error: msg,
				sourceItemId: draft.sourceItemId,
				purpose: "rate-draft",
				brandVersion: brand.version,
				promptVersion: RATING_PROMPT_VERSION,
			});
			return { ok: false, error: msg };
		}
	},
});

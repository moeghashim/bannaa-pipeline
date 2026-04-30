"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { callProvider, defaultProvider, type ProviderId } from "../analyze/providers";
import { defaultBrandInput } from "../brand/defaults";
import { mirrorProviderRun } from "../lib/analytics";
import { requireUser } from "../lib/requireUser";
import { renderBrandSystemPrompt } from "../generate/brandPrompt";

const PROMOTE_TEMPLATE_PROMPT_VERSION = "2026-04-30-a";

const SUGGEST_TEMPLATE_TOOL = {
	name: "suggest_post_template",
	description: "Extract a reusable post structure from a high-performing draft.",
	input_schema: {
		type: "object",
		required: ["name", "structureNotes"],
		properties: {
			name: {
				type: "string",
				description: "Short operator-facing template name, 3-8 words.",
				minLength: 3,
				maxLength: 80,
			},
			structureNotes: {
				type: "string",
				description: "Reusable structure notes. Do not copy the draft text verbatim.",
				minLength: 120,
				maxLength: 1200,
			},
		},
	},
} as const;

type SuggestResult =
	| { ok: true; name: string; structureNotes: string; provider: ProviderId; model: string; cost: number }
	| { ok: false; error: string };

export const suggestFromDraft = action({
	args: { draftId: v.id("drafts") },
	returns: v.union(
		v.object({
			ok: v.literal(true),
			name: v.string(),
			structureNotes: v.string(),
			provider: v.string(),
			model: v.string(),
			cost: v.number(),
		}),
		v.object({ ok: v.literal(false), error: v.string() }),
	),
	handler: async (ctx, args): Promise<SuggestResult> => {
		const userId = await requireUser(ctx);
		const loaded = await ctx.runQuery(internal.generate.internal.loadDraftWithAnalysis, { draftId: args.draftId });
		if (!loaded || loaded.draft.capturedBy !== userId) return { ok: false, error: "Draft not found" };
		const settings: Doc<"settings"> | null = await ctx.runQuery(internal.settings.doc.getInternal, {});
		const env = {
			ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
			GLM_API_KEY: process.env.GLM_API_KEY,
			GLM_MODEL: process.env.GLM_MODEL,
			OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
			OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
			DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
			DEFAULT_ANALYZE_PROVIDER: process.env.DEFAULT_ANALYZE_PROVIDER,
		};
		const provider: ProviderId = settings?.defaultProvider ?? defaultProvider(env);
		const brand = (await ctx.runQuery(internal.brand.doc.getActiveInternal, {})) ?? defaultBrandInput(Date.now());
		try {
			const startedAt = Date.now();
			const result = await callProvider<{ name: string; structureNotes: string }>({
				provider,
				systemPrompt: `${renderBrandSystemPrompt(brand, loaded.draft.channel)}\n\nYou extract reusable post templates. Do not preserve topical facts; preserve structure, pacing, hook mechanics, and CTA shape.`,
				tool: SUGGEST_TEMPLATE_TOOL,
				userPrompt: `Channel: ${loaded.draft.channel}
Rating: ${loaded.draft.rating ?? "unrated"}
Concepts: ${loaded.draft.concepts.join(", ")}

Draft text:
${loaded.draft.primary}

Analysis summary:
${loaded.analysis.summary}

Return a compact template name and structure notes future generations can follow without copying this draft.`,
				env,
			});
			if (!result.output?.name || !result.output.structureNotes) {
				throw new Error("Model did not return template suggestion");
			}
			const runId = await ctx.runMutation(internal.generate.internal.recordProviderRun, {
				provider: result.provider,
				model: result.model,
				inputTokens: result.inputTokens,
				outputTokens: result.outputTokens,
				cost: result.cost,
				itemId: loaded.draft.sourceItemId,
				purpose: "promote-template",
				brandVersion: brand.version,
				promptVersion: PROMOTE_TEMPLATE_PROMPT_VERSION,
			});
			await mirrorProviderRun(
				userId,
				{
					runId,
					provider: result.provider,
					model: result.model,
					purpose: "promote-template",
					itemId: loaded.draft.sourceItemId,
					inputTokens: result.inputTokens,
					outputTokens: result.outputTokens,
					cost: result.cost,
					brandVersion: brand.version,
					promptVersion: PROMOTE_TEMPLATE_PROMPT_VERSION,
				},
				Date.now() - startedAt,
				{ draft_id: loaded.draft._id, channel: loaded.draft.channel },
			);
			return {
				ok: true,
				name: result.output.name,
				structureNotes: result.output.structureNotes,
				provider: result.provider,
				model: result.model,
				cost: result.cost,
			};
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : String(err) };
		}
	},
});

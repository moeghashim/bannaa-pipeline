"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { mirrorProviderRun } from "../lib/analytics";
import { requireUser } from "../lib/requireUser";
import { ANALYZE_PROMPT_VERSION, buildUserPrompt } from "./prompts";
import {
	activeModelForProvider,
	callProvider,
	defaultProvider,
	type ProviderId,
} from "./providers";

const providerValidator = v.union(
	v.literal("claude"),
	v.literal("glm"),
	v.literal("openrouter"),
	v.literal("deepseek"),
);

type RunResult =
	| { ok: true; provider: ProviderId; model: string; cost: number }
	| { ok: false; provider: ProviderId; model: string; error: string };

export const run = action({
	args: {
		id: v.id("inboxItems"),
		provider: v.optional(providerValidator),
	},
	handler: async (ctx, args): Promise<RunResult> => {
		const userId = await requireUser(ctx);

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
		const provider: ProviderId = args.provider ?? settings?.defaultProvider ?? defaultProvider(env);
		const model = activeModelForProvider(provider, env);

		const item = await ctx.runQuery(internal.analyze.internal.loadItem, { id: args.id });
		if (!item) throw new Error("Item not found");
		if (item.state === "analyzing") {
			throw new Error("Item is already being analyzed");
		}

		await ctx.runMutation(internal.analyze.internal.markAnalyzing, { id: args.id });

		const ontology = await ctx.runQuery(internal.analyze.internal.listApprovedConceptNames, {});
		const userPrompt = buildUserPrompt({
			source: item.source,
			handle: item.handle,
			title: item.title,
			snippet: item.snippet,
			raw: item.raw,
			url: item.url,
			ontology,
		});

		try {
			const startedAt = Date.now();
			const result = await callProvider({ provider, userPrompt, env });
			validateOutput(result.output);

			const runId = await ctx.runMutation(internal.analyze.internal.recordSuccess, {
				itemId: args.id,
				provider: result.provider,
				model: result.model,
				runAt: Date.now(),
				summary: result.output.summary,
				concepts: result.output.concepts,
				keyPoints: result.output.keyPoints,
				track: result.output.track,
				outputs: result.output.outputs,
				inputTokens: result.inputTokens,
				outputTokens: result.outputTokens,
				cost: result.cost,
				promptVersion: ANALYZE_PROMPT_VERSION,
			});
			await mirrorProviderRun(
				userId,
				{
					runId,
					provider: result.provider,
					model: result.model,
					purpose: "analyze",
					itemId: args.id,
					inputTokens: result.inputTokens,
					outputTokens: result.outputTokens,
					cost: result.cost,
					brandVersion: undefined,
					promptVersion: ANALYZE_PROMPT_VERSION,
				},
				Date.now() - startedAt,
			);

			return { ok: true as const, provider: result.provider, model: result.model, cost: result.cost };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			const runId = await ctx.runMutation(internal.analyze.internal.recordAudit, {
				itemId: args.id,
				provider,
				model,
				inputTokens: 0,
				outputTokens: 0,
				cost: 0,
				error: message,
				promptVersion: ANALYZE_PROMPT_VERSION,
			});
			await mirrorProviderRun(
				userId,
				{
					runId,
					provider,
					model,
					purpose: "analyze",
					itemId: args.id,
					inputTokens: 0,
					outputTokens: 0,
					cost: 0,
					error: message,
					brandVersion: undefined,
					promptVersion: ANALYZE_PROMPT_VERSION,
				},
				0,
			);
			await ctx.runMutation(internal.analyze.internal.recordFailure, {
				id: args.id,
				error: message,
			});
			return { ok: false as const, provider, model, error: message };
		}
	},
});

function validateOutput(out: unknown): void {
	if (!out || typeof out !== "object") throw new Error("Tool output is not an object");
	const o = out as Record<string, unknown>;
	if (typeof o.summary !== "string") throw new Error("summary must be a string");
	if (!Array.isArray(o.concepts) || o.concepts.length === 0) throw new Error("concepts must be a non-empty array");
	if (!Array.isArray(o.keyPoints) || o.keyPoints.length < 2) throw new Error("keyPoints must have at least 2 items");
	if (o.track !== "Foundations" && o.track !== "Agents" && o.track !== "Media") throw new Error("track is invalid");
	if (!Array.isArray(o.outputs) || o.outputs.length === 0) throw new Error("outputs must be a non-empty array");
	for (const item of o.outputs) {
		if (!item || typeof item !== "object") throw new Error("output entry must be an object");
		const e = item as Record<string, unknown>;
		if (e.kind !== "tweet" && e.kind !== "reel" && e.kind !== "website") throw new Error("output.kind is invalid");
		if (typeof e.hook !== "string" || e.hook.length < 10) throw new Error("output.hook must be a string");
	}
}

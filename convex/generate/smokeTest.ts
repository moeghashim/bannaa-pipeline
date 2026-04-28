"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { callProvider, type ProviderId } from "../analyze/providers";
import { defaultBrandInput } from "../brand/defaults";
import { renderBrandSystemPrompt } from "./brandPrompt";
import {
	ANGLES,
	buildDraftPrompt,
	type Channel,
	DRAFT_SYSTEM_PROMPT,
	DRAFT_TOOL_EN,
	type DraftToolOutput,
} from "./prompts";

const ALL_PROVIDERS: ProviderId[] = ["claude", "glm", "openrouter", "deepseek"];

const channelValidator = v.union(
	v.literal("x"),
	v.literal("ig"),
	v.literal("ig-reel"),
	v.literal("tiktok"),
	v.literal("yt-shorts"),
	v.literal("fb-page"),
	v.literal("linkedin-page"),
);

const providerValidator = v.union(
	v.literal("claude"),
	v.literal("glm"),
	v.literal("openrouter"),
	v.literal("deepseek"),
);

type ProviderProbeResult = {
	provider: ProviderId;
	ok: boolean;
	model?: string;
	angle?: string;
	angleValid?: boolean;
	chars?: number;
	cost?: number;
	error?: string;
};

/**
 * Smoke-tests every text provider against the new `angle` enum in
 * `record_draft`. Reads no secrets, writes no rows — just calls each
 * provider once and reports whether it returned a well-formed
 * DraftToolOutput.
 *
 * Run via: npx convex run generate/smokeTest:smokeAngleEnum
 */
export const smokeAngleEnum = internalAction({
	args: {
		analysisId: v.optional(v.id("analyses")),
		outputIndex: v.optional(v.number()),
		channel: v.optional(channelValidator),
		providers: v.optional(v.array(providerValidator)),
	},
	handler: async (ctx, args): Promise<{ analysisId: string; results: ProviderProbeResult[] }> => {
		const analysis = args.analysisId
			? await ctx.runQuery(internal.generate.internal.loadAnalysis, { id: args.analysisId })
			: await ctx.runQuery(internal.generate.internal.latestAnalysis, {});
		if (!analysis) {
			throw new Error("No analyses found — capture and analyze at least one inbox item first.");
		}
		const outputIndex = args.outputIndex ?? 0;
		const output = analysis.outputs[outputIndex];
		if (!output) {
			throw new Error(`Analysis ${analysis._id} has no output at index ${outputIndex}`);
		}

		const channel: Channel = (args.channel as Channel | undefined) ?? "x";
		const providers = args.providers ?? ALL_PROVIDERS;
		const brand = defaultBrandInput(Date.now());

		const env = {
			ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
			GLM_API_KEY: process.env.GLM_API_KEY,
			GLM_MODEL: process.env.GLM_MODEL,
			OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
			OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
			DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
			DEFAULT_ANALYZE_PROVIDER: process.env.DEFAULT_ANALYZE_PROVIDER,
		};

		const userPrompt = buildDraftPrompt({
			channel,
			analysisSummary: analysis.summary,
			analysisConcepts: analysis.concepts,
			outputHook: output.hook,
			outputKind: output.kind,
			track: analysis.track,
		});
		const systemPrompt = `${renderBrandSystemPrompt(brand, channel)}\n\n${DRAFT_SYSTEM_PROMPT}`;

		const results: ProviderProbeResult[] = [];
		for (const provider of providers) {
			try {
				const r = await callProvider<DraftToolOutput>({
					provider,
					systemPrompt,
					tool: DRAFT_TOOL_EN,
					userPrompt,
					env,
				});
				const angle = r.output?.angle as string | undefined;
				const angleValid = angle ? (ANGLES as readonly string[]).includes(angle) : false;
				results.push({
					provider,
					ok: Boolean(r.output?.primary) && angleValid,
					model: r.model,
					angle,
					angleValid,
					chars: r.output?.primary?.length,
					cost: r.cost,
				});
			} catch (err) {
				results.push({
					provider,
					ok: false,
					error: err instanceof Error ? err.message : String(err),
				});
			}
		}

		return { analysisId: analysis._id, results };
	},
});

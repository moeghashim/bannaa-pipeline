"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { callProvider, defaultProvider, type ProviderId } from "../analyze/providers";
import { requireUser } from "../lib/requireUser";
import {
	buildCarouselPrompt,
	CAROUSEL_SYSTEM_PROMPT,
	CAROUSEL_TOOL,
	type CarouselToolOutput,
} from "./carouselPrompts";

const MIN_SLIDES = 3;
const MAX_SLIDES = 5;
const DEFAULT_SLIDES = 3;

type RunResult =
	| { ok: true; draftId: Id<"drafts">; slideCount: number; provider: ProviderId; model: string; cost: number }
	| { ok: false; error: string };

function clampSlideCount(requested: number | undefined): number {
	const n = requested ?? DEFAULT_SLIDES;
	if (n < MIN_SLIDES) return MIN_SLIDES;
	if (n > MAX_SLIDES) return MAX_SLIDES;
	return Math.round(n);
}

function sanitizeSlides(
	raw: CarouselToolOutput["slides"],
	expected: number,
): CarouselToolOutput["slides"] {
	// Some providers return unordered or off-by-one orderIndex. Sort by the
	// index they returned, then renumber 1..expected so the carousel is
	// always contiguous and 1-based regardless of model behaviour.
	const sorted = [...raw].sort((a, b) => a.orderIndex - b.orderIndex).slice(0, expected);
	return sorted.map((s, i) => ({ ...s, orderIndex: i + 1 }));
}

export const fromAnalysis = action({
	args: {
		analysisId: v.id("analyses"),
		slideCount: v.optional(v.number()),
	},
	returns: v.union(
		v.object({
			ok: v.literal(true),
			draftId: v.id("drafts"),
			slideCount: v.number(),
			provider: v.union(v.literal("claude"), v.literal("glm"), v.literal("openrouter")),
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

		const slideCount = clampSlideCount(args.slideCount);

		const settings: Doc<"settings"> | null = await ctx.runQuery(internal.settings.doc.getInternal, {});
		const provider: ProviderId = settings?.defaultProvider ?? defaultProvider(env);

		const analysis: Doc<"analyses"> | null = await ctx.runQuery(internal.generate.internal.loadAnalysis, {
			id: args.analysisId,
		});
		if (!analysis) return { ok: false, error: "Analysis not found" };

		const userPrompt = buildCarouselPrompt({
			slideCount,
			analysisSummary: analysis.summary,
			analysisConcepts: analysis.concepts,
			keyPoints: analysis.keyPoints,
			track: analysis.track,
		});

		try {
			const result = await callProvider<CarouselToolOutput>({
				provider,
				systemPrompt: CAROUSEL_SYSTEM_PROMPT,
				tool: CAROUSEL_TOOL,
				userPrompt,
				env,
			});

			const out = result.output;
			if (!out?.styleAnchor || !out?.channelAr || !out?.channelEn) {
				throw new Error("Model did not return styleAnchor + channelAr + channelEn");
			}
			if (!Array.isArray(out.slides) || out.slides.length < MIN_SLIDES) {
				throw new Error(`Model returned only ${out.slides?.length ?? 0} slides, need ${slideCount}`);
			}

			const slides = sanitizeSlides(out.slides, slideCount);

			const draftId: Id<"drafts"> = await ctx.runMutation(
				internal.generate.carouselInternal.insertCarouselDraft,
				{
					channelAr: out.channelAr,
					channelEn: out.channelEn,
					chars: out.channelAr.length,
					analysisId: args.analysisId,
					sourceItemId: analysis.itemId,
					concepts: out.concepts ?? analysis.concepts.slice(0, 3),
					capturedBy: userId,
					styleAnchor: out.styleAnchor,
					provider: result.provider,
					model: result.model,
					inputTokens: result.inputTokens,
					outputTokens: result.outputTokens,
					cost: result.cost,
					slides,
				},
			);

			return {
				ok: true,
				draftId,
				slideCount: slides.length,
				provider: result.provider,
				model: result.model,
				cost: result.cost,
			};
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			await ctx.runMutation(internal.generate.carouselInternal.recordFailedCarouselRun, {
				provider,
				model: "",
				error: msg,
				sourceItemId: analysis.itemId,
			});
			return { ok: false, error: msg };
		}
	},
});

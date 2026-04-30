"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { callProvider, defaultProvider, type ProviderId } from "../analyze/providers";
import { defaultBrandInput } from "../brand/defaults";
import { mirrorProviderRun } from "../lib/analytics";
import { requireUser } from "../lib/requireUser";
import { renderBrandSystemPrompt } from "./brandPrompt";
import {
	buildCarouselPrompt,
	buildCarouselSystemPrompt,
	CAROUSEL_PROMPT_VERSION,
	CAROUSEL_TOOL,
	type CarouselToolOutput,
	slideRolePlan,
} from "./carouselPrompts";
import type { OutputLanguage } from "./languages";

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
	// always contiguous and 1-based regardless of model behaviour. Also
	// re-apply the canonical role plan in case the model freelanced — the
	// plan is the source of truth, not the model's choice.
	const sorted = [...raw].sort((a, b) => a.orderIndex - b.orderIndex).slice(0, expected);
	const plan = slideRolePlan(expected);
	return sorted.map((s, i) => ({ ...s, orderIndex: i + 1, role: plan[i] }));
}

export const fromAnalysis = action({
	args: {
		analysisId: v.id("analyses"),
		slideCount: v.optional(v.number()),
		postTemplateId: v.optional(v.id("postTemplates")),
	},
	returns: v.union(
		v.object({
			ok: v.literal(true),
			draftId: v.id("drafts"),
			slideCount: v.number(),
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
			DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
			DEFAULT_ANALYZE_PROVIDER: process.env.DEFAULT_ANALYZE_PROVIDER,
		};

		const slideCount = clampSlideCount(args.slideCount);

		const settings: Doc<"settings"> | null = await ctx.runQuery(internal.settings.doc.getInternal, {});
		const provider: ProviderId = settings?.defaultProvider ?? defaultProvider(env);
		const lang: OutputLanguage = settings?.defaultPrimaryLanguage ?? "en";
		const activeBrand = await ctx.runQuery(internal.brand.doc.getActiveInternal, {});
		const brand = activeBrand ?? defaultBrandInput(Date.now());

		const analysis: Doc<"analyses"> | null = await ctx.runQuery(internal.generate.internal.loadAnalysis, {
			id: args.analysisId,
		});
		if (!analysis) return { ok: false, error: "Analysis not found" };

		const postTemplate = args.postTemplateId
			? await ctx.runQuery(internal.postTemplates.internal.load, { id: args.postTemplateId })
			: null;
		if (args.postTemplateId && !postTemplate) return { ok: false, error: "Template not found" };
		if (postTemplate && postTemplate.channel !== "ig") {
			return { ok: false, error: `Template is for ${postTemplate.channel}, not ig` };
		}

		const userPrompt = buildCarouselPrompt({
			slideCount,
			analysisSummary: analysis.summary,
			analysisConcepts: analysis.concepts,
			keyPoints: analysis.keyPoints,
			track: analysis.track,
			postTemplate: postTemplate
				? { name: postTemplate.name, structureNotes: postTemplate.structureNotes }
				: undefined,
			lang,
		});

		try {
			const startedAt = Date.now();
			const result = await callProvider<CarouselToolOutput>({
				provider,
				systemPrompt: `${renderBrandSystemPrompt(brand, "ig")}\n\n${buildCarouselSystemPrompt(lang)}`,
				tool: CAROUSEL_TOOL,
				userPrompt,
				env,
			});

			const out = result.output;
			if (!out?.styleAnchor || !out?.channelPrimary) {
				throw new Error("Model did not return styleAnchor + channelPrimary");
			}
			if (!Array.isArray(out.slides) || out.slides.length < MIN_SLIDES) {
				throw new Error(`Model returned only ${out.slides?.length ?? 0} slides, need ${slideCount}`);
			}

			const slides = sanitizeSlides(out.slides, slideCount);

			const inserted = await ctx.runMutation(
				internal.generate.carouselInternal.insertCarouselDraft,
				{
					channelPrimary: out.channelPrimary,
					primaryLang: lang,
					chars: out.channelPrimary.length,
					analysisId: args.analysisId,
					sourceItemId: analysis.itemId,
					concepts: out.concepts ?? analysis.concepts.slice(0, 3),
					capturedBy: userId,
					styleAnchor: out.styleAnchor,
					postTemplateId: args.postTemplateId,
					provider: result.provider,
					model: result.model,
					inputTokens: result.inputTokens,
					outputTokens: result.outputTokens,
					cost: result.cost,
					slides,
					brandVersion: brand.version,
					promptVersion: CAROUSEL_PROMPT_VERSION,
				},
			);
			const draftId: Id<"drafts"> = inserted.draftId;
			await mirrorProviderRun(
				userId,
				{
					runId: inserted.runId,
					provider: result.provider,
					model: result.model,
					purpose: "generate-carousel",
					itemId: analysis.itemId,
					inputTokens: result.inputTokens,
					outputTokens: result.outputTokens,
					cost: result.cost,
					brandVersion: brand.version,
					promptVersion: CAROUSEL_PROMPT_VERSION,
				},
				Date.now() - startedAt,
				{
					draft_id: draftId,
					channel: "ig",
					slide_count: slides.length,
					primary_lang: lang,
					template_id: args.postTemplateId ?? null,
				},
			);
			if (args.postTemplateId) {
				await ctx.runMutation(internal.postTemplates.internal.incrementUsage, {
					id: args.postTemplateId,
				});
				await ctx.scheduler.runAfter(0, internal.analytics.events.captureEvent, {
					distinctId: userId,
					event: "template.used",
					properties: {
						template_id: args.postTemplateId,
						draft_id: draftId,
						channel: "ig",
						provider: result.provider,
						model: result.model,
					},
				});
			}

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
			const runId = await ctx.runMutation(internal.generate.carouselInternal.recordFailedCarouselRun, {
				provider,
				model: "",
				error: msg,
				sourceItemId: analysis.itemId,
				brandVersion: brand.version,
				promptVersion: CAROUSEL_PROMPT_VERSION,
			});
			await mirrorProviderRun(
				userId,
				{
					runId,
					provider,
					model: "",
					purpose: "generate-carousel",
					itemId: analysis.itemId,
					inputTokens: 0,
					outputTokens: 0,
					cost: 0,
					error: msg,
					brandVersion: brand.version,
					promptVersion: CAROUSEL_PROMPT_VERSION,
				},
				0,
				{ channel: "ig", slide_count: slideCount, template_id: args.postTemplateId ?? null },
			);
			return { ok: false, error: msg };
		}
	},
});

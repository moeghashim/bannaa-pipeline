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
import { cosine, DEDUP_RECENT_LIMIT, DEDUP_THRESHOLD, embedText, EMBEDDING_MODEL } from "./embeddings";
import type { OutputLanguage } from "./languages";
import {
	buildDraftPrompt,
	buildDraftSystemPrompt,
	buildTightenPrompt,
	type Channel,
	DRAFT_PROMPT_VERSION,
	DRAFT_TOOL,
	type DraftToolOutput,
	MAX_CHARS_BY_CHANNEL,
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

const angleValidator = v.union(
	v.literal("explainer"),
	v.literal("news"),
	v.literal("hot_take"),
	v.literal("use_case"),
	v.literal("debunk"),
	v.literal("tutorial"),
);

type RunResult =
	| { ok: true; draftId: Id<"drafts">; provider: ProviderId; model: string; cost: number }
	| { ok: false; error: string };

export const fromAnalysisOutput = action({
	args: {
		analysisId: v.id("analyses"),
		channel: channelValidator,
		outputIndex: v.number(),
		angleOverride: v.optional(angleValidator),
		postTemplateId: v.optional(v.id("postTemplates")),
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
			DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
			DEFAULT_ANALYZE_PROVIDER: process.env.DEFAULT_ANALYZE_PROVIDER,
		};

		const settings: Doc<"settings"> | null = await ctx.runQuery(internal.settings.doc.getInternal, {});
		const provider: ProviderId = settings?.defaultProvider ?? defaultProvider(env);
		const lang: OutputLanguage = settings?.defaultPrimaryLanguage ?? "en";
		const activeBrand = await ctx.runQuery(internal.brand.doc.getActiveInternal, {});
		const brand = activeBrand ?? defaultBrandInput(Date.now());

		const analysis = await ctx.runQuery(internal.generate.internal.loadAnalysis, { id: args.analysisId });
		if (!analysis) return { ok: false, error: "Analysis not found" };

		const output = analysis.outputs[args.outputIndex];
		if (!output) return { ok: false, error: `Output index ${args.outputIndex} not found` };

		const postTemplate = args.postTemplateId
			? await ctx.runQuery(internal.postTemplates.internal.load, { id: args.postTemplateId })
			: null;
		if (args.postTemplateId && !postTemplate) return { ok: false, error: "Template not found" };
		if (postTemplate && postTemplate.channel !== args.channel) {
			return { ok: false, error: `Template is for ${postTemplate.channel}, not ${args.channel}` };
		}

		const hookTemplate = await ctx.runQuery(internal.generate.hookTemplates.pickForChannel, {
			channel: args.channel,
		});

		const userPrompt = buildDraftPrompt({
			channel: args.channel as Channel,
			analysisSummary: analysis.summary,
			analysisConcepts: analysis.concepts,
			outputHook: output.hook,
			outputKind: output.kind,
			track: analysis.track,
			hookTemplate: hookTemplate?.pattern,
			postTemplate: postTemplate
				? { name: postTemplate.name, structureNotes: postTemplate.structureNotes }
				: undefined,
			angleOverride: args.angleOverride,
			lang,
		});

		const systemPrompt = `${renderBrandSystemPrompt(brand, args.channel as Channel)}\n\n${buildDraftSystemPrompt(lang)}`;

		try {
			const startedAt = Date.now();
			const firstResult = await callProvider<DraftToolOutput>({
				provider,
				systemPrompt,
				tool: DRAFT_TOOL,
				userPrompt,
				env,
			});

			if (!firstResult.output?.primary) {
				throw new Error("Model did not return primary copy");
			}

			let result = firstResult;
			const maxChars = MAX_CHARS_BY_CHANNEL[args.channel as Channel];
			if (firstResult.output.primary.length > maxChars) {
				try {
					const retry = await callProvider<DraftToolOutput>({
						provider,
						systemPrompt,
						tool: DRAFT_TOOL,
						userPrompt: buildTightenPrompt({
							channel: args.channel as Channel,
							previous: firstResult.output.primary,
							angle: firstResult.output.angle,
							concepts: firstResult.output.concepts ?? analysis.concepts.slice(0, 3),
							maxChars,
							lang,
						}),
						env,
					});
					if (retry.output?.primary && retry.output.primary.length <= maxChars) {
						result = {
							...retry,
							inputTokens: firstResult.inputTokens + retry.inputTokens,
							outputTokens: firstResult.outputTokens + retry.outputTokens,
							cost: firstResult.cost + retry.cost,
						};
					}
				} catch {
					// Tightening is best-effort; keep the original on retry failure.
				}
			}

			let embedding: number[] | undefined;
			let dedupSimilarity: number | undefined;
			let dedupPriorDraftId: Id<"drafts"> | undefined;
			const openaiKey = process.env.OPENAI_API_KEY;
			if (openaiKey) {
				try {
					const embedStartedAt = Date.now();
					const embedResult = await embedText(result.output.primary, openaiKey);
					embedding = embedResult.embedding;
					const embeddingRunId = await ctx.runMutation(internal.generate.internal.recordEmbeddingRun, {
						model: EMBEDDING_MODEL,
						itemId: analysis.itemId,
						inputTokens: embedResult.inputTokens,
						cost: embedResult.cost,
						purpose: "dedup-draft",
						brandVersion: brand.version,
						promptVersion: DRAFT_PROMPT_VERSION,
					});
					await mirrorProviderRun(
						userId,
						{
							runId: embeddingRunId,
							provider: "openai-embedding",
							model: EMBEDDING_MODEL,
							purpose: "dedup-draft",
							itemId: analysis.itemId,
							inputTokens: embedResult.inputTokens,
							outputTokens: 0,
							cost: embedResult.cost,
							brandVersion: brand.version,
							promptVersion: DRAFT_PROMPT_VERSION,
						},
						Date.now() - embedStartedAt,
					);
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

			const inserted = await ctx.runMutation(internal.generate.internal.insertDraft, {
				channel: args.channel,
				primary: result.output.primary,
				primaryLang: lang,
				chars: result.output.primary.length,
				analysisId: args.analysisId,
				sourceItemId: analysis.itemId,
				concepts: result.output.concepts ?? analysis.concepts.slice(0, 3),
				angle: args.angleOverride ?? result.output.angle,
				embedding,
				dedupSimilarity,
				dedupPriorDraftId,
				postTemplateId: args.postTemplateId,
				capturedBy: userId,
				provider: result.provider,
				model: result.model,
				inputTokens: result.inputTokens,
				outputTokens: result.outputTokens,
				cost: result.cost,
				brandVersion: brand.version,
				promptVersion: DRAFT_PROMPT_VERSION,
			});
			const draftId: Id<"drafts"> = inserted.draftId;
			await mirrorProviderRun(
				userId,
				{
					runId: inserted.runId,
					provider: result.provider,
					model: result.model,
					purpose: "generate-draft",
					itemId: analysis.itemId,
					inputTokens: result.inputTokens,
					outputTokens: result.outputTokens,
					cost: result.cost,
					brandVersion: brand.version,
					promptVersion: DRAFT_PROMPT_VERSION,
				},
				Date.now() - startedAt,
				{
					draft_id: draftId,
					channel: args.channel,
					primary_lang: lang,
					template_id: args.postTemplateId ?? null,
				},
			);

			if (hookTemplate) {
				await ctx.runMutation(internal.generate.hookTemplates.incrementUsage, {
					id: hookTemplate._id,
				});
			}
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
						channel: args.channel,
						provider: result.provider,
						model: result.model,
					},
				});
			}

			// Score the draft asynchronously. Failure is non-fatal — the
			// draft is already saved; the score just stays undefined.
			await ctx.scheduler.runAfter(0, internal.generate.rating.run, { draftId });

			return {
				ok: true,
				draftId,
				provider: result.provider,
				model: result.model,
				cost: result.cost,
			};
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			const runId = await ctx.runMutation(internal.generate.internal.recordFailedRun, {
				provider,
				model: "",
				error: msg,
				sourceItemId: analysis.itemId,
				brandVersion: brand.version,
				promptVersion: DRAFT_PROMPT_VERSION,
			});
			await mirrorProviderRun(
				userId,
				{
					runId,
					provider,
					model: "",
					purpose: "generate-draft",
					itemId: analysis.itemId,
					inputTokens: 0,
					outputTokens: 0,
					cost: 0,
					error: msg,
					brandVersion: brand.version,
					promptVersion: DRAFT_PROMPT_VERSION,
				},
				0,
				{ channel: args.channel, template_id: args.postTemplateId ?? null },
			);
			return { ok: false, error: msg };
		}
	},
});

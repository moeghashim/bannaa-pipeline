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
import type { OutputLanguage } from "./languages";
import {
	buildTranslatePrompt,
	type Channel,
	TRANSLATE_PROMPT_VERSION,
	TRANSLATE_TOOL,
	type TranslateToolOutput,
} from "./prompts";
import { outputLanguageValidator } from "./languages";

type TranslationResult =
	| {
			ok: true;
			lang: Exclude<OutputLanguage, "en">;
			text: string;
			chars: number;
			runId: Id<"providerRuns">;
			provider: ProviderId;
			model: string;
			cost: number;
	  }
	| { ok: false; error: string };

export const generateTranslation = action({
	args: { draftId: v.id("drafts"), targetLang: outputLanguageValidator },
	returns: v.union(
		v.object({
			ok: v.literal(true),
			lang: outputLanguageValidator,
			text: v.string(),
			chars: v.number(),
			runId: v.id("providerRuns"),
			provider: v.union(v.literal("claude"), v.literal("glm"), v.literal("openrouter"), v.literal("deepseek")),
			model: v.string(),
			cost: v.number(),
		}),
		v.object({ ok: v.literal(false), error: v.string() }),
	),
	handler: async (ctx, { draftId, targetLang }): Promise<TranslationResult> => {
		const userId = await requireUser(ctx);
		if (targetLang === "en") {
			return { ok: false, error: "English is the source language; pick a non-English target" };
		}
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
		const loaded = await ctx.runQuery(internal.generate.translateInternal.loadDraftWithAnalysis, { draftId });
		if (!loaded) return { ok: false, error: "Draft or analysis not found" };
		const { draft } = loaded;
		const primary = draft.primary.trim();
		if (!primary) return { ok: false, error: "Draft has no primary copy" };
		const sourceLang: OutputLanguage = (draft.primaryLang as OutputLanguage | undefined) ?? "en";
		if (sourceLang === targetLang) {
			return { ok: false, error: `Draft is already in ${targetLang}; pick a different target` };
		}

		// Brand voice presets are Arabic-dialect-specific. Apply them only
		// when the target is one of the AR dialects; otherwise rely on the
		// brand system prompt to carry the voice.
		const targetIsArabic = targetLang === "ar-msa" || targetLang === "ar-saudi" || targetLang === "ar-egy";
		const voicePreset = targetIsArabic
			? (brand.tone.arPresets[targetLang] ?? brand.tone.arPresets[brand.tone.activeArPreset] ?? "")
			: "";

		try {
			const startedAt = Date.now();
			const result = await callProvider<TranslateToolOutput>({
				provider,
				systemPrompt: `${renderBrandSystemPrompt(brand, draft.channel as Channel)}\n\nTranslate the primary copy into the requested output language. Respond only with the translation tool.`,
				tool: TRANSLATE_TOOL,
				userPrompt: buildTranslatePrompt({
					channel: draft.channel as Channel,
					primary,
					sourceLang,
					targetLang,
					brandVoicePreset: voicePreset,
					angle: draft.angle,
				}),
				env,
			});
			if (!result.output?.text) throw new Error("Model did not return translated text");
			const text = result.output.text.trim();
			const chars = result.output.chars || text.length;
			const runId = await ctx.runMutation(internal.generate.translateInternal.saveDraftTranslation, {
				draftId,
				lang: targetLang,
				text,
				chars,
				provider: result.provider,
				model: result.model,
				inputTokens: result.inputTokens,
				outputTokens: result.outputTokens,
				cost: result.cost,
				brandVersion: brand.version,
				promptVersion: TRANSLATE_PROMPT_VERSION,
			});
			await mirrorProviderRun(
				userId,
				{
					runId,
					provider: result.provider,
					model: result.model,
					purpose: "generate-translation",
					itemId: draft.sourceItemId,
					inputTokens: result.inputTokens,
					outputTokens: result.outputTokens,
					cost: result.cost,
					brandVersion: brand.version,
					promptVersion: TRANSLATE_PROMPT_VERSION,
				},
				Date.now() - startedAt,
				{
					draft_id: draftId,
					channel: draft.channel,
					source_lang: sourceLang,
					target_lang: targetLang,
				},
			);
			if (draft.mediaKind === "carousel") {
				const slides = await ctx.runQuery(internal.generate.translateInternal.listSlidesForDraft, { draftId });
				for (const slide of slides) {
					const slidePrimary = slide.primary.trim();
					if (!slidePrimary) continue;
					const slideSourceLang: OutputLanguage =
						(slide.primaryLang as OutputLanguage | undefined) ?? sourceLang;
					const slideResult = await callProvider<TranslateToolOutput>({
						provider,
						systemPrompt: `${renderBrandSystemPrompt(brand, draft.channel as Channel)}\n\nTranslate a short carousel slide into the requested output language. Respond only with the translation tool.`,
						tool: TRANSLATE_TOOL,
						userPrompt: buildTranslatePrompt({
							channel: draft.channel as Channel,
							primary: slidePrimary,
							sourceLang: slideSourceLang,
							targetLang,
							brandVoicePreset: voicePreset,
							angle: draft.angle,
						}),
						env,
					});
					if (slideResult.output?.text) {
						const slideText = slideResult.output.text.trim();
						await ctx.runMutation(internal.generate.translateInternal.saveSlideTranslation, {
							slideId: slide._id,
							lang: targetLang,
							text: slideText,
							chars: slideResult.output.chars || slideText.length,
							genRunId: runId,
						});
					}
				}
			}
			return { ok: true, lang: targetLang, text, chars, runId, provider: result.provider, model: result.model, cost: result.cost };
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			const runId = await ctx.runMutation(internal.generate.translateInternal.recordFailedTranslation, {
				draftId,
				provider,
				model: "",
				error: msg,
				brandVersion: brand.version,
				promptVersion: TRANSLATE_PROMPT_VERSION,
			});
			await mirrorProviderRun(
				userId,
				{
					runId,
					provider,
					model: "",
					purpose: "generate-translation",
					itemId: draft.sourceItemId,
					inputTokens: 0,
					outputTokens: 0,
					cost: 0,
					error: msg,
					brandVersion: brand.version,
					promptVersion: TRANSLATE_PROMPT_VERSION,
				},
				0,
				{
					draft_id: draftId,
					channel: draft.channel,
					source_lang: sourceLang,
					target_lang: targetLang,
				},
			);
			return { ok: false, error: msg };
		}
	},
});

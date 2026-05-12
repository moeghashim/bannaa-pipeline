"use node";

// Single-image baked-text generation (replaces composite.ts / satori overlay).
//
// Given a single-image draft with a ready base asset, calls the image-edit
// endpoint with the base PNG + a text+chrome prompt so the model bakes the
// caption + brand chrome directly on top of the operator-approved base
// image. Inserted asset carries `overlaidFrom = base._id` so
// `firstReadyByDraft` prefers it over the base.
//
// Used to re-generate the scene from scratch alongside the text — that meant
// the overlay's underlying scene drifted from the base. Switching to
// /v1/images/edits keeps the underlying scene pixel-locked to whatever the
// operator approved.
//
// Provider stays gpt-image (the only edit-capable + Arabic-fluent backend
// today). MODEL is operator-tunable via settings.overlayModel.

import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { action } from "../../_generated/server";
import { defaultBrandInput } from "../../brand/defaults";
import { mirrorProviderRun } from "../../lib/analytics";
import { requireUser } from "../../lib/requireUser";
import {
	LANG_LABELS,
	type OutputLanguage,
	outputLanguageValidator,
} from "../languages";
import { callImageProviderEdit, type ImageProvider, type ImageProviderEnv } from "./providers";

const BAKED_PROVIDER: ImageProvider = "gpt-image";
const BAKED_MODEL_DEFAULT = "gpt-image-2";
export const BAKED_PROMPT_VERSION = "2026-04-29-c";

type BakedResult =
	| { ok: true; assetId: Id<"mediaAssets">; cost: number; model: string }
	| { ok: false; error: string };

function buildBakedPrompt(input: {
	text: string;
	languageLabel: string;
	channel: string;
	brand: Pick<Doc<"brands">, "design">;
}): string {
	const design = input.brand.design;
	const chipCorner = design.layout.chipPosition === "top-left" ? "Top-left" : "Top-right";
	const footerCorner = design.layout.footerPosition === "bottom-left" ? "Bottom-left" : "Bottom-right";
	// Edit-mode prompt: model receives the base PNG via the multipart `image`
	// field, so we do NOT redescribe the scene. We tell it to preserve the
	// underlying image and only add the text + chrome listed below.
	return [
		"Edit this image. Preserve the entire underlying scene exactly — do not regenerate, recolor, recompose, or alter the existing illustration. Only add the text overlays, chip marks, footer, and gradient described below.",
		"",
		"Text overlays — render all four EXACTLY as specified, preserving every character literally:",
		"",
		`1. ${chipCorner} chip, ${design.typography.mono} uppercase, ~20px, ${design.palette.background} at 70% opacity, margin ${design.layout.margins}px:`,
		`   ${design.logoChipText} · ${input.channel.toUpperCase()}`,
		"",
		`2. Opposite top chip, ${design.typography.mono} uppercase, ~20px, ${design.palette.background} at 70% opacity:`,
		`   ${input.languageLabel}`,
		"",
		`3. ${input.languageLabel} caption block in the lower portion of the image, visually aligned for the selected language, ${design.typography.heading} bold display, ~64px, color ${design.palette.background} with a soft dark drop-shadow for legibility. Render the text glyph-for-glyph verbatim — do NOT paraphrase, translate, or omit characters:`,
		`   ${input.text}`,
		"",
		`4. ${footerCorner} footer, ${design.typography.mono} ~22px, ${design.palette.background} at 75% opacity, margin ${design.layout.margins}px:`,
		`   ⎯ ${design.footerText}`,
		"",
		"Add a subtle bottom-to-top dark gradient behind the caption block so the letters stay legible regardless of what the scene is.",
		"",
		"Output: same square composition as the input image with only the four overlays + gradient added. Do not add any other text, captions, or UI chrome.",
	].join("\n");
}

export const bakedForDraft = action({
	args: {
		draftId: v.id("drafts"),
		targetLang: v.optional(outputLanguageValidator),
	},
	returns: v.union(
		v.object({
			ok: v.literal(true),
			assetId: v.id("mediaAssets"),
			cost: v.number(),
			model: v.string(),
		}),
		v.object({ ok: v.literal(false), error: v.string() }),
	),
	handler: async (ctx, { draftId, targetLang }): Promise<BakedResult> => {
		const userId = await requireUser(ctx);

		const env: ImageProviderEnv = {
			GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
			OPENAI_API_KEY: process.env.OPENAI_API_KEY,
			GROK_API_KEY: process.env.GROK_API_KEY,
			IDEOGRAM_API_KEY: process.env.IDEOGRAM_API_KEY,
			OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
			OPENROUTER_IMAGE_MODEL: process.env.OPENROUTER_IMAGE_MODEL,
		};
		const activeBrand = await ctx.runQuery(internal.brand.doc.getActiveInternal, {});
		const brand = activeBrand ?? defaultBrandInput(Date.now());

		// Operator-tunable model — falls through to the hardcoded baseline
		// if the operator hasn't set one in Settings. Provider stays fixed
		// (only gpt-image's edit endpoint is wired today).
		const settings: Doc<"settings"> | null = await ctx.runQuery(internal.settings.doc.getInternal, {});
		const model = settings?.overlayModel ?? BAKED_MODEL_DEFAULT;

		const loaded: { draft: Doc<"drafts">; analysis: Doc<"analyses"> } | null = await ctx.runQuery(
			internal.generate.image.internal.loadDraftWithAnalysis,
			{ id: draftId },
		);
		if (!loaded) return { ok: false, error: "draft or analysis not found" };
		const { draft, analysis } = loaded;

		const base: Doc<"mediaAssets"> | null = await ctx.runQuery(
			internal.mediaAssets.list.firstBaseReady,
			{ draftId },
		);
		if (!base) return { ok: false, error: "no ready base image" };
		if (!base.storageId) return { ok: false, error: "base image has no storageId" };

		const fallback: OutputLanguage = draft.primaryLang ?? "en";
		const lang: OutputLanguage = targetLang ?? fallback;
		const prompt = buildBakedPrompt({
			text: textForLanguage(draft, lang),
			languageLabel: LANG_LABELS[lang],
			channel: draft.channel,
			brand,
		});

		try {
			const startedAt = Date.now();
			// Pull the base PNG so the edit endpoint operates on the exact
			// bytes the operator approved — that's what makes the overlay
			// scene identical to the base scene.
			const baseBlob = await ctx.storage.get(base.storageId);
			if (!baseBlob) return { ok: false, error: "base storage blob missing" };
			const baseBytes = new Uint8Array(await baseBlob.arrayBuffer());

			const result = await callImageProviderEdit({
				provider: BAKED_PROVIDER,
				prompt,
				model,
				env,
				inputImage: baseBytes,
			});
			const blob = new Blob([result.bytes as BlobPart], { type: "image/png" });
			const storageId: Id<"_storage"> = await ctx.storage.store(blob);

			const runId: Id<"providerRuns"> = await ctx.runMutation(
				internal.generate.image.internal.recordImageRun,
				{
					provider: BAKED_PROVIDER,
					model,
					purpose: "bake-single-image",
					cost: result.cost,
					sourceItemId: analysis.itemId,
					brandVersion: brand.version,
					promptVersion: BAKED_PROMPT_VERSION,
				},
			);
			await mirrorProviderRun(
				userId,
				{
					runId,
					provider: BAKED_PROVIDER,
					model,
					purpose: "bake-single-image",
					itemId: analysis.itemId,
					inputTokens: 0,
					outputTokens: 0,
					cost: result.cost,
					brandVersion: brand.version,
					promptVersion: BAKED_PROMPT_VERSION,
				},
				Date.now() - startedAt,
				{
					draft_id: draftId,
					channel: draft.channel,
					base_asset_id: base._id,
					target_lang: lang,
				},
			);

			const assetId: Id<"mediaAssets"> = await ctx.runMutation(
				internal.generate.image.internal.insertBakedAsset,
				{
					draftId,
					overlaidFrom: base._id,
					storageId,
					width: result.width,
					height: result.height,
					provider: BAKED_PROVIDER,
					model,
					prompt,
					orderIndex: 0,
					genRunId: runId,
				},
			);

			return { ok: true, assetId, cost: result.cost, model };
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`[bakedForDraft] failed: ${msg}`);
			const runId = await ctx.runMutation(internal.generate.image.internal.recordImageRun, {
				provider: BAKED_PROVIDER,
				model,
				purpose: "bake-single-image",
				cost: 0,
				error: msg,
				sourceItemId: analysis.itemId,
				brandVersion: brand.version,
				promptVersion: BAKED_PROMPT_VERSION,
			});
			await mirrorProviderRun(
				userId,
				{
					runId,
					provider: BAKED_PROVIDER,
					model,
					purpose: "bake-single-image",
					itemId: analysis.itemId,
					inputTokens: 0,
					outputTokens: 0,
					cost: 0,
					error: msg,
					brandVersion: brand.version,
					promptVersion: BAKED_PROMPT_VERSION,
				},
				0,
				{
					draft_id: draftId,
					channel: draft.channel,
					base_asset_id: base._id,
					target_lang: lang,
				},
			);
			return { ok: false, error: msg };
		}
	},
});

function textForLanguage(draft: Doc<"drafts">, lang: OutputLanguage): string {
	const draftLang = draft.primaryLang ?? "en";
	if (lang === draftLang) return draft.primary;
	if (lang === "en" && !draft.primaryLang) return draft.primary;
	const translation = draft.translations?.find((t) => t.lang === lang);
	if (translation) return translation.text;
	throw new Error(`No ${lang} copy exists for this draft`);
}

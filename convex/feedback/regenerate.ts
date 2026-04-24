"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { action, type ActionCtx } from "../_generated/server";
import { callProvider, defaultProvider, type ProviderId, type ToolSpec } from "../analyze/providers";
import { defaultBrandInput } from "../brand/defaults";
import { renderBrandSystemPrompt } from "../generate/brandPrompt";
import { CAROUSEL_PROMPT_VERSION, CAROUSEL_SYSTEM_PROMPT } from "../generate/carouselPrompts";
import {
	buildDraftPrompt,
	type Channel,
	DRAFT_PROMPT_VERSION,
	DRAFT_SYSTEM_PROMPT,
	DRAFT_TOOL_EN,
	type DraftToolOutput,
} from "../generate/prompts";
import { IMAGE_PROMPT_VERSION } from "../generate/image/prompts";
import { callImageProvider, type ImageProvider, type ImageProviderEnv } from "../generate/image/providers";
import { requireUser } from "../lib/requireUser";
import { TEXT_FEEDBACK_TAGS, MEDIA_FEEDBACK_TAGS } from "./tags";

const targetKindValidator = v.union(v.literal("draft"), v.literal("mediaAsset"), v.literal("carouselSlide"));

type TargetKind = "draft" | "mediaAsset" | "carouselSlide";
type CarouselSlideRegenerationOutput = {
	primary: string;
	imagePrompt: string;
	concepts: string[];
};
type Result =
	| { ok: true; runId: Id<"providerRuns">; feedbackId: Id<"feedback"> }
	| { ok: false; error: string };

const CAROUSEL_SLIDE_TOOL: ToolSpec = {
	name: "record_carousel_slide",
	description: "Record regenerated English on-image text and image prompt for one carousel slide.",
	input_schema: {
		type: "object",
		required: ["primary", "imagePrompt", "concepts"],
		properties: {
			primary: {
				type: "string",
				description: "Short English text shown on this slide. 30-90 chars.",
				minLength: 10,
				maxLength: 120,
			},
			imagePrompt: {
				type: "string",
				description: "English visual prompt for this slide only. 60-180 chars.",
				minLength: 30,
				maxLength: 240,
			},
			concepts: {
				type: "array",
				description: "1-4 concept tags reused from the analysis.",
				items: { type: "string", minLength: 2, maxLength: 48 },
				minItems: 1,
				maxItems: 4,
			},
		},
	},
};

function feedbackBlock(tags: string[], note: string | undefined): string {
	return [
		"Prior feedback:",
		`Last attempt was rated down for: ${tags.length ? tags.join(", ") : "(no tags supplied)"}.`,
		`Operator note: ${note?.trim() || "(none)"}.`,
		"Fix these before anything else.",
	].join("\n");
}

function cleanTags(targetKind: TargetKind, tags: string[]): string[] {
	const allowed = targetKind === "mediaAsset" ? MEDIA_FEEDBACK_TAGS : TEXT_FEEDBACK_TAGS;
	const allowedSet = new Set<string>(allowed);
	return [...new Set(tags)].filter((tag) => allowedSet.has(tag));
}

function priorRunForDraft(draft: Doc<"drafts">): Id<"providerRuns"> {
	return draft.genRunId;
}

export const regenerateWithFeedback = action({
	args: {
		draftId: v.id("drafts"),
		targetKind: targetKindValidator,
		targetId: v.string(),
		tags: v.array(v.string()),
		note: v.optional(v.string()),
	},
	returns: v.union(
		v.object({ ok: v.literal(true), runId: v.id("providerRuns"), feedbackId: v.id("feedback") }),
		v.object({ ok: v.literal(false), error: v.string() }),
	),
	handler: async (ctx, args): Promise<Result> => {
		const userId = await requireUser(ctx);
		const tags = cleanTags(args.targetKind, args.tags);
		if (args.targetKind === "mediaAsset") {
			return await regenerateMedia(ctx, args.targetId as Id<"mediaAssets">, args.draftId, tags, args.note, userId);
		}
		if (args.targetKind === "carouselSlide") {
			return await regenerateCarouselSlide(
				ctx,
				args.targetId as Id<"carouselSlides">,
				args.draftId,
				tags,
				args.note,
				userId,
			);
		}
		return await regenerateDraft(ctx, args.draftId, args.targetKind, args.targetId, tags, args.note, userId);
	},
});

function textProviderEnv() {
	return {
		ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
		GLM_API_KEY: process.env.GLM_API_KEY,
		GLM_MODEL: process.env.GLM_MODEL,
		OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
		OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
		DEFAULT_ANALYZE_PROVIDER: process.env.DEFAULT_ANALYZE_PROVIDER,
	};
}

async function regenerateDraft(
	ctx: ActionCtx,
	draftId: Id<"drafts">,
	targetKind: TargetKind,
	targetId: string,
	tags: string[],
	note: string | undefined,
	userId: Id<"users">,
): Promise<Result> {
	const env = textProviderEnv();
	const settings: Doc<"settings"> | null = await ctx.runQuery(internal.settings.doc.getInternal, {});
	const provider: ProviderId = settings?.defaultProvider ?? defaultProvider(env);
	const loaded = await ctx.runQuery(internal.feedback.internal.loadDraftTarget, { draftId });
	if (!loaded) return { ok: false, error: "Draft or analysis not found" };
	const { draft, analysis } = loaded;
	const activeBrand = await ctx.runQuery(internal.brand.doc.getActiveInternal, {});
	const brand = activeBrand ?? defaultBrandInput(Date.now());
	const output = analysis.outputs[0];
	const prompt = [
		feedbackBlock(tags, note),
		"",
		buildDraftPrompt({
			channel: draft.channel as Channel,
			analysisSummary: analysis.summary,
			analysisConcepts: analysis.concepts,
			outputHook: output?.hook ?? draft.primary,
			outputKind: output?.kind ?? "tweet",
			track: analysis.track,
		}),
	].join("\n");

	try {
		const result = await callProvider<DraftToolOutput>({
			provider,
			systemPrompt: `${renderBrandSystemPrompt(brand, draft.channel as Channel)}\n\n${DRAFT_SYSTEM_PROMPT}`,
			tool: DRAFT_TOOL_EN,
			userPrompt: prompt,
			env,
		});
		if (!result.output?.primary) throw new Error("Model did not return English primary copy");
		const runId = await ctx.runMutation(internal.feedback.internal.saveDraftRegeneration, {
			draftId,
			primary: result.output.primary,
			concepts: result.output.concepts ?? draft.concepts,
			provider: result.provider,
			model: result.model,
			inputTokens: result.inputTokens,
			outputTokens: result.outputTokens,
			cost: result.cost,
			brandVersion: brand.version,
			promptVersion: DRAFT_PROMPT_VERSION,
		});
		const feedbackId = await ctx.runMutation(internal.feedback.internal.recordRegenerationFeedback, {
			targetKind,
			targetId,
			draftId,
			tags,
			note,
			authorId: userId,
			runId,
			priorRunId: priorRunForDraft(draft),
		});
		return { ok: true, runId, feedbackId };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}

async function regenerateCarouselSlide(
	ctx: ActionCtx,
	slideId: Id<"carouselSlides">,
	draftId: Id<"drafts">,
	tags: string[],
	note: string | undefined,
	userId: Id<"users">,
): Promise<Result> {
	const env = textProviderEnv();
	const settings: Doc<"settings"> | null = await ctx.runQuery(internal.settings.doc.getInternal, {});
	const provider: ProviderId = settings?.defaultProvider ?? defaultProvider(env);
	const loaded = await ctx.runQuery(internal.feedback.internal.loadCarouselSlideTarget, { slideId });
	if (!loaded) return { ok: false, error: "Carousel slide, draft, or analysis not found" };
	if (loaded.draft._id !== draftId) return { ok: false, error: "Carousel slide does not belong to draft" };
	const { slide, draft, analysis } = loaded;
	const activeBrand = await ctx.runQuery(internal.brand.doc.getActiveInternal, {});
	const brand = activeBrand ?? defaultBrandInput(Date.now());
	const prompt = [
		feedbackBlock(tags, note),
		"",
		`Regenerate only slide ${slide.orderIndex} for this existing Instagram carousel.`,
		`Keep the shared style anchor: ${draft.styleAnchor ?? "(none)"}`,
		`Previous slide text: ${slide.primary}`,
		`Previous slide image prompt: ${slide.imagePrompt}`,
		"",
		"Analysis summary:",
		analysis.summary,
		"",
		"Key points:",
		analysis.keyPoints.map((point, index) => `${index + 1}. ${point}`).join("\n"),
		"",
		`Concepts from the analysis (reuse only these): ${analysis.concepts.join(", ")}`,
		"",
		"Return one replacement slide. Do not regenerate the caption or other slides.",
	].join("\n");

	try {
		const result = await callProvider<CarouselSlideRegenerationOutput>({
			provider,
			systemPrompt: `${renderBrandSystemPrompt(brand, "ig")}\n\n${CAROUSEL_SYSTEM_PROMPT}`,
			tool: CAROUSEL_SLIDE_TOOL,
			userPrompt: prompt,
			env,
		});
		if (!result.output?.primary || !result.output.imagePrompt) {
			throw new Error("Model did not return carousel slide copy and image prompt");
		}
		const runId = await ctx.runMutation(internal.feedback.internal.saveCarouselSlideRegeneration, {
			slideId,
			primary: result.output.primary,
			imagePrompt: result.output.imagePrompt,
			concepts: result.output.concepts ?? draft.concepts,
			provider: result.provider,
			model: result.model,
			inputTokens: result.inputTokens,
			outputTokens: result.outputTokens,
			cost: result.cost,
			brandVersion: brand.version,
			promptVersion: CAROUSEL_PROMPT_VERSION,
		});
		const feedbackId = await ctx.runMutation(internal.feedback.internal.recordRegenerationFeedback, {
			targetKind: "carouselSlide",
			targetId: slideId,
			draftId,
			tags,
			note,
			authorId: userId,
			runId,
			priorRunId: slide.genRunId ?? draft.genRunId,
		});
		return { ok: true, runId, feedbackId };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}

async function regenerateMedia(
	ctx: ActionCtx,
	assetId: Id<"mediaAssets">,
	draftId: Id<"drafts">,
	tags: string[],
	note: string | undefined,
	userId: Id<"users">,
): Promise<Result> {
	const loaded = await ctx.runQuery(internal.feedback.internal.loadMediaTarget, { assetId });
	if (!loaded) return { ok: false, error: "Media asset not found" };
	const { asset, analysis } = loaded;
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
	const prompt = `${feedbackBlock(tags, note)}\n\nPrevious generation prompt:\n${asset.prompt}`;
	const provider = asset.provider as ImageProvider;
	const pendingId = await ctx.runMutation(internal.generate.image.internal.insertPendingAsset, {
		draftId,
		provider,
		model: asset.model,
		prompt,
		orderIndex: asset.orderIndex,
	});
	try {
		const result = await callImageProvider({ provider, model: asset.model, prompt, env });
		const blob = new Blob([result.bytes as BlobPart], { type: "image/png" });
		const storageId = await ctx.storage.store(blob);
		const runId = await ctx.runMutation(internal.feedback.internal.recordImageRegenerationRun, {
			provider,
			model: asset.model,
			cost: result.cost,
			sourceItemId: analysis.itemId,
			brandVersion: brand.version,
			promptVersion: IMAGE_PROMPT_VERSION,
		});
		await ctx.runMutation(internal.generate.image.internal.completeAsset, {
			assetId: pendingId,
			storageId,
			width: result.width,
			height: result.height,
			genRunId: runId,
		});
		const feedbackId = await ctx.runMutation(internal.feedback.internal.recordRegenerationFeedback, {
			targetKind: "mediaAsset",
			targetId: assetId,
			draftId,
			tags,
			note,
			authorId: userId,
			runId,
			priorRunId: asset.genRunId ?? runId,
		});
		return { ok: true, runId, feedbackId };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		const runId = await ctx.runMutation(internal.feedback.internal.recordImageRegenerationRun, {
			provider,
			model: asset.model,
			cost: 0,
			sourceItemId: analysis.itemId,
			brandVersion: brand.version,
			promptVersion: IMAGE_PROMPT_VERSION,
			error: msg,
		});
		await ctx.runMutation(internal.generate.image.internal.failAsset, {
			assetId: pendingId,
			error: msg,
			genRunId: runId,
		});
		return { ok: false, error: msg };
	}
}

"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { activeModelForProvider, callProvider, defaultProvider, type ProviderId } from "../analyze/providers";
import { defaultBrandInput } from "../brand/defaults";
import { BAKED_PROMPT_VERSION } from "../generate/image/bakedAction";
import { callImageProvider, type ImageProviderEnv } from "../generate/image/providers";
import { renderBrandSystemPrompt } from "../generate/brandPrompt";
import {
	buildDraftPrompt,
	type Channel,
	DRAFT_PROMPT_VERSION,
	DRAFT_SYSTEM_PROMPT,
	DRAFT_TOOL_EN,
	type DraftToolOutput,
} from "../generate/prompts";
import { requireUser } from "../lib/requireUser";

const channelValidator = v.union(
	v.literal("x"),
	v.literal("ig"),
	v.literal("ig-reel"),
	v.literal("tiktok"),
	v.literal("yt-shorts"),
	v.literal("fb-page"),
	v.literal("linkedin-page"),
);

const BAKED_MODEL = "gpt-image-2";

const SAMPLE_ANALYSIS = {
	summary:
		"AI tools are shifting from passive assistants into agentic systems that plan, use tools, check their work, and hand results back to humans for approval. The practical lesson is to design tight review loops instead of chasing full autonomy.",
	concepts: ["agent loop", "human review", "tool use", "evals"],
	outputHook: "The best AI agents are not autonomous. They are accountable.",
	outputKind: "tweet",
	track: "Agents",
};

type PreviewDraftResult =
	| {
			ok: true;
			primary: string;
			concepts: string[];
			provider: ProviderId;
			model: string;
			cost: number;
	  }
	| { ok: false; error: string };

type BakedPreviewResult =
	| {
			ok: true;
			url: string | null;
			storageId: Id<"_storage">;
			cached: boolean;
			cost: number;
			model: string;
	  }
	| { ok: false; error: string };

function previewBakedPrompt(brand: Doc<"brands">): string {
	const design = brand.design;
	return [
		"Produce a single square 1080x1080 sample social slide that previews this brand design.",
		"Use an abstract AI-education scene with warm architectural negative space.",
		`Style guide: ${design.imageStyleGuide}`,
		`Palette: primary ${design.palette.primary}, accent ${design.palette.accent}, neutral ${design.palette.neutral}, background ${design.palette.background}, text ${design.palette.text}.`,
		"",
		"Render these overlays exactly:",
		`1. Top-left chip: ${design.logoChipText} · IG, ${design.typography.mono}, ${design.palette.background} at 70% opacity.`,
		`2. Top-right chip: AR, ${design.typography.mono}, ${design.palette.background} at 70% opacity.`,
		`3. Bottom sample caption: وكيل ذكي يحتاج حلقة مراجعة واضحة, ${design.typography.heading}, ${design.palette.background}, aligned for the selected language.`,
		`4. Bottom-left footer: ⎯ ${design.footerText}, ${design.typography.mono}, ${design.palette.background} at 75% opacity.`,
		"Do not add any other text.",
	].join("\n");
}

async function hashDesign(brand: Doc<"brands">): Promise<string> {
	const payload = JSON.stringify({ design: brand.design, version: brand.version });
	const bytes = new TextEncoder().encode(payload);
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export const previewDraft = action({
	args: { channel: channelValidator },
	returns: v.union(
		v.object({
			ok: v.literal(true),
			primary: v.string(),
			concepts: v.array(v.string()),
			provider: v.union(v.literal("claude"), v.literal("glm"), v.literal("openrouter"), v.literal("deepseek")),
			model: v.string(),
			cost: v.number(),
		}),
		v.object({ ok: v.literal(false), error: v.string() }),
	),
	handler: async (ctx, { channel }): Promise<PreviewDraftResult> => {
		await requireUser(ctx);
		const env = {
			ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
			GLM_API_KEY: process.env.GLM_API_KEY,
			GLM_MODEL: process.env.GLM_MODEL,
			OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
			OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
			DEFAULT_ANALYZE_PROVIDER: process.env.DEFAULT_ANALYZE_PROVIDER,
		};
		const settings: Doc<"settings"> | null = await ctx.runQuery(internal.settings.doc.getInternal, {});
		const provider: ProviderId = settings?.defaultProvider ?? defaultProvider(env);
		const model = activeModelForProvider(provider, env);
		const activeBrand = await ctx.runQuery(internal.brand.doc.getActiveInternal, {});
		const brand = activeBrand ?? defaultBrandInput(Date.now());
		const typedChannel = channel as Channel;

		const userPrompt = buildDraftPrompt({
			channel: typedChannel,
			analysisSummary: SAMPLE_ANALYSIS.summary,
			analysisConcepts: SAMPLE_ANALYSIS.concepts,
			outputHook: SAMPLE_ANALYSIS.outputHook,
			outputKind: SAMPLE_ANALYSIS.outputKind,
			track: SAMPLE_ANALYSIS.track,
		});

		try {
			const result = await callProvider<DraftToolOutput>({
				provider,
				systemPrompt: `${renderBrandSystemPrompt(brand, typedChannel)}\n\n${DRAFT_SYSTEM_PROMPT}`,
				tool: DRAFT_TOOL_EN,
				userPrompt,
				env,
			});
			if (!result.output?.primary) throw new Error("Model did not return English primary copy");
			await ctx.runMutation(internal.brand.previewInternal.recordPreviewRun, {
				provider: result.provider,
				model: result.model,
				purpose: "brand-preview-draft",
				inputTokens: result.inputTokens,
				outputTokens: result.outputTokens,
				cost: result.cost,
				brandVersion: brand.version,
				promptVersion: DRAFT_PROMPT_VERSION,
			});
			return {
				ok: true,
				primary: result.output.primary,
				concepts: result.output.concepts ?? [],
				provider: result.provider,
				model: result.model,
				cost: result.cost,
			};
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			await ctx.runMutation(internal.brand.previewInternal.recordPreviewRun, {
				provider,
				model,
				purpose: "brand-preview-draft",
				inputTokens: 0,
				outputTokens: 0,
				cost: 0,
				error: msg,
				brandVersion: brand.version,
				promptVersion: DRAFT_PROMPT_VERSION,
			});
			return { ok: false, error: msg };
		}
	},
});

export const previewBakedImage = action({
	args: {},
	returns: v.union(
		v.object({
			ok: v.literal(true),
			url: v.union(v.string(), v.null()),
			storageId: v.id("_storage"),
			cached: v.boolean(),
			cost: v.number(),
			model: v.string(),
		}),
		v.object({ ok: v.literal(false), error: v.string() }),
	),
	handler: async (ctx): Promise<BakedPreviewResult> => {
		await requireUser(ctx);
		const activeBrand = await ctx.runQuery(internal.brand.doc.getActiveInternal, {});
		if (!activeBrand) return { ok: false, error: "Active brand is not initialized" };

		const hash = await hashDesign(activeBrand);
		const cached = await ctx.runQuery(internal.brand.previewInternal.getCachedBakedPreview, {
			brandId: activeBrand._id,
			hash,
		});
		if (cached) {
			return {
				ok: true,
				url: cached.url,
				storageId: cached.storageId,
				cached: true,
				cost: 0,
				model: BAKED_MODEL,
			};
		}

		const env: ImageProviderEnv = {
			GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
			OPENAI_API_KEY: process.env.OPENAI_API_KEY,
			GROK_API_KEY: process.env.GROK_API_KEY,
			IDEOGRAM_API_KEY: process.env.IDEOGRAM_API_KEY,
			OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
			OPENROUTER_IMAGE_MODEL: process.env.OPENROUTER_IMAGE_MODEL,
		};
		const prompt = previewBakedPrompt(activeBrand);

		try {
			const result = await callImageProvider({
				provider: "gpt-image",
				model: BAKED_MODEL,
				prompt,
				env,
			});
			const blob = new Blob([result.bytes as BlobPart], { type: "image/png" });
			const storageId: Id<"_storage"> = await ctx.storage.store(blob);
			await ctx.runMutation(internal.brand.previewInternal.insertBakedPreview, {
				brandId: activeBrand._id,
				hash,
				storageId,
			});
			await ctx.runMutation(internal.brand.previewInternal.recordPreviewRun, {
				provider: "gpt-image",
				model: BAKED_MODEL,
				purpose: "brand-preview-baked-image",
				inputTokens: 0,
				outputTokens: 0,
				cost: result.cost,
				brandVersion: activeBrand.version,
				promptVersion: BAKED_PROMPT_VERSION,
			});
			const url = await ctx.storage.getUrl(storageId);
			return { ok: true, url, storageId, cached: false, cost: result.cost, model: BAKED_MODEL };
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			await ctx.runMutation(internal.brand.previewInternal.recordPreviewRun, {
				provider: "gpt-image",
				model: BAKED_MODEL,
				purpose: "brand-preview-baked-image",
				inputTokens: 0,
				outputTokens: 0,
				cost: 0,
				error: msg,
				brandVersion: activeBrand.version,
				promptVersion: BAKED_PROMPT_VERSION,
			});
			return { ok: false, error: msg };
		}
	},
});

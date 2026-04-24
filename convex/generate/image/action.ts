import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { action } from "../../_generated/server";
import { defaultBrandInput } from "../../brand/defaults";
import { requireUser } from "../../lib/requireUser";
import type { Channel } from "../prompts";
import { buildImagePrompt, IMAGE_PROMPT_VERSION, isVideoChannel } from "./prompts";
import { callImageProvider, defaultImageModel, type ImageProvider, type ImageProviderEnv } from "./providers";

const imageProviderValidator = v.union(
	v.literal("nano-banana"),
	v.literal("gpt-image"),
	v.literal("grok"),
	v.literal("ideogram"),
	v.literal("openrouter"),
);

type RunResult =
	| { ok: true; assetId: Id<"mediaAssets">; provider: ImageProvider; model: string; cost: number }
	| { ok: false; error: string };

const DEFAULT_IMAGE_PROVIDER: ImageProvider = "nano-banana";

export const generateForDraft = action({
	args: {
		draftId: v.id("drafts"),
		provider: v.optional(imageProviderValidator),
	},
	returns: v.union(
		v.object({
			ok: v.literal(true),
			assetId: v.id("mediaAssets"),
			provider: imageProviderValidator,
			model: v.string(),
			cost: v.number(),
		}),
		v.object({ ok: v.literal(false), error: v.string() }),
	),
	handler: async (ctx, args): Promise<RunResult> => {
		await requireUser(ctx);

		const env: ImageProviderEnv = {
			GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
			OPENAI_API_KEY: process.env.OPENAI_API_KEY,
			GROK_API_KEY: process.env.GROK_API_KEY,
			IDEOGRAM_API_KEY: process.env.IDEOGRAM_API_KEY,
			OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
			OPENROUTER_IMAGE_MODEL: process.env.OPENROUTER_IMAGE_MODEL,
		};

		const settings: Doc<"settings"> | null = await ctx.runQuery(internal.settings.doc.getInternal, {});
		const provider: ImageProvider =
			args.provider ?? settings?.defaultImageProvider ?? DEFAULT_IMAGE_PROVIDER;
		const activeBrand = await ctx.runQuery(internal.brand.doc.getActiveInternal, {});
		const brand = activeBrand ?? defaultBrandInput(Date.now());

		const loaded: { draft: Doc<"drafts">; analysis: Doc<"analyses"> } | null = await ctx.runQuery(
			internal.generate.image.internal.loadDraftWithAnalysis,
			{ id: args.draftId },
		);
		if (!loaded) return { ok: false, error: "Draft or its analysis not found" };
		const { draft, analysis } = loaded;

		if (isVideoChannel(draft.channel as Channel)) {
			return {
				ok: false,
				error: "image generation not supported for video channels",
			};
		}

		const model = defaultImageModel(provider, env);
		const prompt = buildImagePrompt({
			channel: draft.channel as Channel,
			analysisSummary: analysis.summary,
			analysisConcepts: analysis.concepts,
			primary: draft.primary,
			track: analysis.track,
			brand,
		});

		const assetId: Id<"mediaAssets"> = await ctx.runMutation(
			internal.generate.image.internal.insertPendingAsset,
			{
				draftId: args.draftId,
				provider,
				model,
				prompt,
				orderIndex: 0,
			},
		);

		try {
			const result = await callImageProvider({ provider, prompt, model, env });

			// V8 actions can call ctx.storage.store.
			const bytes = result.bytes;
			const blob = new Blob([bytes as BlobPart], { type: "image/png" });
			const storageId: Id<"_storage"> = await ctx.storage.store(blob);

			const runId: Id<"providerRuns"> = await ctx.runMutation(
				internal.generate.image.internal.recordImageRun,
				{
					provider,
					model,
					purpose: "generate-image",
					cost: result.cost,
					sourceItemId: analysis.itemId,
					brandVersion: brand.version,
					promptVersion: IMAGE_PROMPT_VERSION,
				},
			);

			await ctx.runMutation(internal.generate.image.internal.completeAsset, {
				assetId,
				storageId,
				width: result.width,
				height: result.height,
				genRunId: runId,
			});

			await ctx.runMutation(internal.generate.image.internal.patchDraftMedia, {
				draftId: args.draftId,
				mediaKind: "single-image",
				imageProvider: provider,
				imageModel: model,
			});

			return { ok: true, assetId, provider, model, cost: result.cost };
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			const runId: Id<"providerRuns"> = await ctx.runMutation(
				internal.generate.image.internal.recordImageRun,
				{
					provider,
					model,
					purpose: "generate-image",
					cost: 0,
					sourceItemId: analysis.itemId,
					error: msg,
					brandVersion: brand.version,
					promptVersion: IMAGE_PROMPT_VERSION,
				},
			);
			await ctx.runMutation(internal.generate.image.internal.failAsset, {
				assetId,
				error: msg,
				genRunId: runId,
			});
			return { ok: false, error: msg };
		}
	},
});

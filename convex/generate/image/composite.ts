"use node";

// HyperFrames overlay composite action (Phase 2 · B.4).
//
// Takes the first ready *base* mediaAsset on a draft, burns the AR copy on
// top using satori + resvg-wasm, and stores the result as a sibling asset
// row keyed by `overlaidFrom = baseAssetId`. No providerRun is recorded —
// the compositor is local compute with no API cost.
//
// Runs in the **Node runtime** (not V8): satori depends on
// yoga-wasm-base64-esm which loads its wasm via `import.meta.url`, and the
// Convex V8 runtime doesn't support `import.meta`. Moving this file to Node
// is the cleanest fix — nothing outside composite.ts +
// compositeCarouselAction.ts imports hyperframes.ts, so there's no
// cross-runtime leak into http.ts or other V8-pinned modules.

import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { action } from "../../_generated/server";
import { requireUser } from "../../lib/requireUser";
import { composite } from "./hyperframes";

type OverlayResult =
	| { ok: true; assetId: Id<"mediaAssets"> }
	| { ok: false; error: string };

export const overlayForDraft = action({
	args: { draftId: v.id("drafts") },
	returns: v.union(
		v.object({ ok: v.literal(true), assetId: v.id("mediaAssets") }),
		v.object({ ok: v.literal(false), error: v.string() }),
	),
	handler: async (ctx, { draftId }): Promise<OverlayResult> => {
		await requireUser(ctx);

		const loaded: { draft: Doc<"drafts">; analysis: Doc<"analyses"> } | null = await ctx.runQuery(
			internal.generate.image.internal.loadDraftWithAnalysis,
			{ id: draftId },
		);
		if (!loaded) return { ok: false, error: "Draft or its analysis not found" };
		const { draft } = loaded;

		const base: Doc<"mediaAssets"> | null = await ctx.runQuery(
			internal.mediaAssets.list.firstBaseReady,
			{ draftId },
		);
		if (!base || !base.storageId) return { ok: false, error: "no ready base image" };

		const blob = await ctx.storage.get(base.storageId);
		if (!blob) return { ok: false, error: "base image storage blob missing" };
		const baseBytes = new Uint8Array(await blob.arrayBuffer());

		let pngBytes: Uint8Array;
		try {
			pngBytes = await composite({
				baseImage: baseBytes,
				ar: draft.ar,
				channel: draft.channel,
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return { ok: false, error: `composite failed: ${msg}` };
		}

		const storageId: Id<"_storage"> = await ctx.storage.store(
			new Blob([pngBytes as BlobPart], { type: "image/png" }),
		);

		const model = `${base.provider}+satori`;
		const assetId: Id<"mediaAssets"> = await ctx.runMutation(
			internal.generate.image.internal.insertCompositeAsset,
			{
				draftId,
				overlaidFrom: base._id,
				storageId,
				width: 1080,
				height: 1080,
				model,
			},
		);

		return { ok: true, assetId };
	},
});

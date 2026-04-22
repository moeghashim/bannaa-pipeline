"use node";

// Multi-slide HyperFrames overlay (Phase 2 · B.3).
//
// Composites every ready base asset on a carousel draft with its own AR
// on-image text (from carouselSlides, matched by orderIndex). The top-right
// chip shows N/M slide position instead of the single-image "AR" marker.
// Sibling composites are stored as mediaAssets rows with overlaidFrom set
// and the same orderIndex as the base — `slidesForDraft` will then prefer
// the composite per slot.
//
// Runs in the **Node runtime** — see composite.ts for why (satori's yoga
// dependency needs import.meta, which V8 doesn't expose).

import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { action } from "../../_generated/server";
import { requireUser } from "../../lib/requireUser";
import { composite } from "./hyperframes";

type OverlayResult =
	| { ok: true; composited: number; failed: number }
	| { ok: false; error: string };

export const overlayCarouselForDraft = action({
	args: { draftId: v.id("drafts") },
	returns: v.union(
		v.object({ ok: v.literal(true), composited: v.number(), failed: v.number() }),
		v.object({ ok: v.literal(false), error: v.string() }),
	),
	handler: async (ctx, { draftId }): Promise<OverlayResult> => {
		await requireUser(ctx);

		const loaded: {
			draft: Doc<"drafts">;
			slides: Doc<"carouselSlides">[];
			baseAssets: Doc<"mediaAssets">[];
		} | null = await ctx.runQuery(internal.generate.carouselInternal.loadCarouselForOverlay, { draftId });
		if (!loaded) return { ok: false, error: "carousel draft not found" };
		const { draft, slides, baseAssets } = loaded;

		if (draft.mediaKind !== "carousel") return { ok: false, error: "draft is not a carousel" };
		if (baseAssets.length === 0) return { ok: false, error: "no ready base images" };

		const slidesByIndex = new Map<number, Doc<"carouselSlides">>();
		for (const s of slides) slidesByIndex.set(s.orderIndex, s);

		const slideTotal = Math.max(slides.length, baseAssets.length);

		let composited = 0;
		let failed = 0;

		for (const base of baseAssets) {
			const slide = slidesByIndex.get(base.orderIndex);
			if (!slide || !base.storageId) {
				failed += 1;
				continue;
			}
			const blob = await ctx.storage.get(base.storageId);
			if (!blob) {
				failed += 1;
				continue;
			}
			const baseBytes = new Uint8Array(await blob.arrayBuffer());

			try {
				const pngBytes = await composite({
					baseImage: baseBytes,
					ar: slide.ar,
					channel: draft.channel,
					slideIndex: base.orderIndex,
					slideTotal,
				});

				const storageId: Id<"_storage"> = await ctx.storage.store(
					new Blob([pngBytes as BlobPart], { type: "image/png" }),
				);
				const model = `${base.provider}+satori`;
				await ctx.runMutation(internal.generate.image.internal.insertCompositeAsset, {
					draftId,
					overlaidFrom: base._id,
					storageId,
					width: 1080,
					height: 1080,
					model,
					orderIndex: base.orderIndex,
				});
				composited += 1;
			} catch {
				failed += 1;
			}
		}

		return { ok: true, composited, failed };
	},
});

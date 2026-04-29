"use node";

// Operator-facing action that schedules one draft through Postiz.
//
// Flow:
//   1. Load draft, validate it's approvable (state == "approved")
//   2. Resolve channel → Postiz provider + settings via channelMatrix
//   3. Load mediaAssets for the draft; pick composite or base based on
//      `selection` (which mirrors the UI's base/overlay toggle at send-time)
//   4. Upload each asset to Postiz /upload in order
//   5. POST /posts with the scheduled date + media refs + AR copy
//   6. Stamp postizPostId + postizStatus="scheduled" on the draft
//
// Returns a discriminated union so the UI can show a red pill with the
// reason on failure instead of a generic toast. The draft's own
// postizError field is also set on failure for post-hoc debugging.

import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { action } from "../_generated/server";
import {
	type LegacyOutputLanguage,
	transitionalOutputLanguageValidator,
} from "../generate/languages";
import { requireUser } from "../lib/requireUser";
import { resolvePublishTarget } from "./channelMatrix";
import { schedulePost, uploadMedia } from "./postiz";

const publishLanguageValidator = transitionalOutputLanguageValidator;

type ScheduleResult =
	| { ok: true; postizPostId: string; scheduledAt: number }
	| { ok: false; error: string };

export const scheduleDraft = action({
	args: {
		draftId: v.id("drafts"),
		scheduledAt: v.number(),
		selection: v.union(v.literal("base"), v.literal("overlay")),
		publishLang: publishLanguageValidator,
		integrationId: v.string(),
	},
	returns: v.union(
		v.object({ ok: v.literal(true), postizPostId: v.string(), scheduledAt: v.number() }),
		v.object({ ok: v.literal(false), error: v.string() }),
	),
	handler: async (ctx, { draftId, scheduledAt, selection, publishLang, integrationId }): Promise<ScheduleResult> => {
		await requireUser(ctx);

		const draft: Doc<"drafts"> | null = await ctx.runQuery(
			internal.publish.internal.loadDraftForPublish,
			{ draftId },
		);
		if (!draft) return { ok: false, error: "Draft not found" };
		if (draft.state !== "approved") {
			return { ok: false, error: `Draft must be approved before scheduling (state=${draft.state})` };
		}
		if (draft.postizStatus && draft.postizStatus !== "failed") {
			return {
				ok: false,
				error: `Draft is already ${draft.postizStatus} — cancel before rescheduling`,
			};
		}

		const target = resolvePublishTarget(draft.channel, draft.mediaKind ?? "text");
		if (!target.ok) return { ok: false, error: target.reason };

		// Collect mediaAssets for the draft. We want the operator's
		// selection (base vs overlay) in orderIndex order. Grouping by
		// orderIndex + picking base-or-overlay per slot keeps the carousel
		// order deterministic even when retries interleaved the inserts.
		const assets: Doc<"mediaAssets">[] = await ctx.runQuery(
			internal.mediaAssets.listInternal.readyForDraft,
			{ draftId },
		);
		if (assets.length === 0) {
			return { ok: false, error: "No ready media — generate images first" };
		}
		const byIndex = new Map<number, Doc<"mediaAssets">[]>();
		for (const a of assets) {
			const arr = byIndex.get(a.orderIndex) ?? [];
			arr.push(a);
			byIndex.set(a.orderIndex, arr);
		}
		const slots: Doc<"mediaAssets">[] = [];
		for (const idx of [...byIndex.keys()].sort((a, b) => a - b)) {
			const group = byIndex.get(idx);
			if (!group) continue;
			const composite = group.find((a) => a.overlaidFrom);
			const base = group.find((a) => !a.overlaidFrom);
			const pick = selection === "overlay" ? (composite ?? base) : (base ?? composite);
			if (pick) slots.push(pick);
		}
		if (slots.length === 0) {
			return {
				ok: false,
				error: `No ${selection} assets ready for this draft — switch selection or generate first`,
			};
		}

		// Upload each slot sequentially. Postiz's /upload handles one file
		// per call; we could parallelise but sequential keeps the log tidy
		// and Postiz has modest rate limits on their public API.
		const uploaded: Array<{ id: string; path: string }> = [];
		for (const [i, asset] of slots.entries()) {
			if (!asset.storageId) {
				return { ok: false, error: `Slot ${i + 1} has no storage blob` };
			}
			const blob = await ctx.storage.get(asset.storageId);
			if (!blob) {
				return { ok: false, error: `Slot ${i + 1} storage blob missing` };
			}
			const bytes = new Uint8Array(await blob.arrayBuffer());
			const r = await uploadMedia({
				bytes,
				contentType: "image/png",
				filename: `${draftId}-${selection}-${i + 1}.png`,
			});
			if (!r.ok) {
				return { ok: false, error: `Upload slot ${i + 1}: ${r.error}` };
			}
			uploaded.push({ id: r.id, path: r.path });
		}

		const posted = await schedulePost({
			integrationId,
			text: textForLanguage(draft, publishLang),
			media: uploaded,
			scheduledAt,
			settings: target.settings,
		});
		if (!posted.ok) return { ok: false, error: posted.error };

		await ctx.runMutation(internal.publish.internal.markScheduled, {
			draftId,
			scheduledAt,
			publishSelection: selection,
			publishLang,
			publishIntegrationId: integrationId,
			postizPostId: posted.postId,
		});

		return { ok: true, postizPostId: posted.postId, scheduledAt };
	},
});

function textForLanguage(draft: Doc<"drafts">, lang: LegacyOutputLanguage): string {
	const draftLang = draft.primaryLang ?? "en";
	if (lang === draftLang) return draft.primary;
	if (lang === "en" && !draft.primaryLang) return draft.primary;
	const translation = draft.translations?.find((t) => t.lang === lang);
	if (translation) return translation.text;
	throw new Error(`No ${lang} copy exists for this draft`);
}

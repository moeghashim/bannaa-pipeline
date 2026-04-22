import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalQuery, query } from "../_generated/server";
import { requireUser } from "../lib/requireUser";

export const forDraft = query({
	args: { draftId: v.id("drafts") },
	handler: async (ctx, { draftId }): Promise<Doc<"mediaAssets">[]> => {
		await requireUser(ctx);
		return await ctx.db
			.query("mediaAssets")
			.withIndex("by_draft", (q) => q.eq("draftId", draftId))
			.collect();
	},
});

export const forDrafts = query({
	args: { draftIds: v.array(v.id("drafts")) },
	handler: async (ctx, { draftIds }): Promise<Record<string, Doc<"mediaAssets">[]>> => {
		await requireUser(ctx);
		const out: Record<string, Doc<"mediaAssets">[]> = {};
		for (const draftId of draftIds) {
			const rows = await ctx.db
				.query("mediaAssets")
				.withIndex("by_draft", (q) => q.eq("draftId", draftId))
				.collect();
			out[draftId as unknown as string] = rows;
		}
		return out;
	},
});

export const firstReadyByDraft = query({
	args: { draftId: v.id("drafts") },
	handler: async (ctx, { draftId }): Promise<Doc<"mediaAssets"> | null> => {
		await requireUser(ctx);
		const rows = await ctx.db
			.query("mediaAssets")
			.withIndex("by_draft", (q) => q.eq("draftId", draftId))
			.collect();
		rows.sort((a, b) => a.orderIndex - b.orderIndex);
		// Prefer a ready composite (overlaid) over a ready base — so the operator
		// sees the final publishable image once B.4 has run. Fall back to the
		// first ready base if no composite exists.
		const readyComposite = rows.find((r) => r.state === "ready" && r.overlaidFrom);
		if (readyComposite) return readyComposite;
		const readyBase = rows.find((r) => r.state === "ready" && !r.overlaidFrom);
		if (readyBase) return readyBase;
		const generating = rows.find((r) => r.state === "generating");
		if (generating) return generating;
		return rows[0] ?? null;
	},
});

export const baseReadyByDraft = query({
	args: { draftId: v.id("drafts") },
	handler: async (ctx, { draftId }): Promise<Doc<"mediaAssets"> | null> => {
		await requireUser(ctx);
		const rows = await ctx.db
			.query("mediaAssets")
			.withIndex("by_draft", (q) => q.eq("draftId", draftId))
			.collect();
		rows.sort((a, b) => a.orderIndex - b.orderIndex);
		return rows.find((r) => r.state === "ready" && !r.overlaidFrom) ?? null;
	},
});

export const firstBaseReady = internalQuery({
	args: { draftId: v.id("drafts") },
	handler: async (ctx, { draftId }): Promise<Doc<"mediaAssets"> | null> => {
		const rows = await ctx.db
			.query("mediaAssets")
			.withIndex("by_draft", (q) => q.eq("draftId", draftId))
			.collect();
		rows.sort((a, b) => a.orderIndex - b.orderIndex);
		return rows.find((r) => r.state === "ready" && !r.overlaidFrom) ?? null;
	},
});

// B.3 carousel: one ordered mediaAsset per slot, preferring a composite when
// one exists. `firstReadyByDraft` stays untouched so the single-image path
// behaves exactly as before.
export const slidesForDraft = query({
	args: { draftId: v.id("drafts") },
	handler: async (ctx, { draftId }): Promise<Doc<"mediaAssets">[]> => {
		await requireUser(ctx);
		const rows = await ctx.db
			.query("mediaAssets")
			.withIndex("by_draft", (q) => q.eq("draftId", draftId))
			.collect();

		const byIndex = new Map<number, Doc<"mediaAssets">[]>();
		for (const r of rows) {
			if (r.state !== "ready") continue;
			const arr = byIndex.get(r.orderIndex) ?? [];
			arr.push(r);
			byIndex.set(r.orderIndex, arr);
		}

		const slots: Doc<"mediaAssets">[] = [];
		const indices = [...byIndex.keys()].sort((a, b) => a - b);
		for (const idx of indices) {
			const group = byIndex.get(idx);
			if (!group) continue;
			const composite = group.find((a) => a.overlaidFrom);
			slots.push(composite ?? group[0]!);
		}
		return slots;
	},
});

// Base-only variant for the base/overlay toggle on carousel cards.
export const slidesBaseForDraft = query({
	args: { draftId: v.id("drafts") },
	handler: async (ctx, { draftId }): Promise<Doc<"mediaAssets">[]> => {
		await requireUser(ctx);
		const rows = await ctx.db
			.query("mediaAssets")
			.withIndex("by_draft", (q) => q.eq("draftId", draftId))
			.collect();
		return rows
			.filter((r) => r.state === "ready" && !r.overlaidFrom)
			.sort((a, b) => a.orderIndex - b.orderIndex);
	},
});

// All mediaAssets for a carousel draft, including generating/failed rows —
// used by the UI to show per-slot progress ("2/3 generating, 1 failed").
export const slidesStatusForDraft = query({
	args: { draftId: v.id("drafts") },
	handler: async (ctx, { draftId }): Promise<Doc<"mediaAssets">[]> => {
		await requireUser(ctx);
		const rows = await ctx.db
			.query("mediaAssets")
			.withIndex("by_draft", (q) => q.eq("draftId", draftId))
			.collect();
		return rows.sort((a, b) => a.orderIndex - b.orderIndex);
	},
});

// Re-export so the generated api knows about this helper type too.
export type MediaAssetDoc = Doc<"mediaAssets">;
export type MediaAssetId = Id<"mediaAssets">;

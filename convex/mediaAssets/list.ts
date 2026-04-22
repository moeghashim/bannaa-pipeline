import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
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
		const ready = rows.find((r) => r.state === "ready");
		if (ready) return ready;
		const generating = rows.find((r) => r.state === "generating");
		if (generating) return generating;
		return rows[0] ?? null;
	},
});

// Re-export so the generated api knows about this helper type too.
export type MediaAssetDoc = Doc<"mediaAssets">;
export type MediaAssetId = Id<"mediaAssets">;

import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";

export const load = internalQuery({
	args: { id: v.id("postTemplates") },
	returns: v.union(
		v.null(),
		v.object({
			_id: v.id("postTemplates"),
			name: v.string(),
			channel: v.union(
				v.literal("x"),
				v.literal("ig"),
				v.literal("ig-reel"),
				v.literal("tiktok"),
				v.literal("yt-shorts"),
				v.literal("fb-page"),
				v.literal("linkedin-page"),
			),
			structureNotes: v.string(),
			usageCount: v.number(),
		}),
	),
	handler: async (ctx, args) => {
		const row: Doc<"postTemplates"> | null = await ctx.db.get(args.id);
		if (!row) return null;
		return {
			_id: row._id,
			name: row.name,
			channel: row.channel,
			structureNotes: row.structureNotes,
			usageCount: row.usageCount,
		};
	},
});

export const incrementUsage = internalMutation({
	args: { id: v.id("postTemplates") },
	returns: v.null(),
	handler: async (ctx, args): Promise<null> => {
		const row = await ctx.db.get(args.id);
		if (!row) return null;
		await ctx.db.patch(args.id, {
			usageCount: row.usageCount + 1,
			lastUsedAt: Date.now(),
			updatedAt: Date.now(),
		});
		return null;
	},
});

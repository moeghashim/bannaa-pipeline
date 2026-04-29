// Internal mutations the publish action + webhook use to stamp publish
// state onto a draft. Kept separate from drafts/mutate.ts because those
// are public-facing and auth-gated on the operator — these run inside
// actions (already auth-checked at their boundary) and inside the webhook
// handler (auth-less, gated by the Postiz signature check).

import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";
import { transitionalOutputLanguageValidator } from "../generate/languages";

export const loadDraftForPublish = internalQuery({
	args: { draftId: v.id("drafts") },
	handler: async (ctx, { draftId }): Promise<Doc<"drafts"> | null> => {
		return await ctx.db.get(draftId);
	},
});

export const markScheduled = internalMutation({
	args: {
		draftId: v.id("drafts"),
		scheduledAt: v.number(),
		publishSelection: v.union(v.literal("base"), v.literal("overlay")),
		publishLang: transitionalOutputLanguageValidator,
		publishIntegrationId: v.string(),
		postizPostId: v.string(),
	},
	handler: async (ctx, args): Promise<void> => {
		const row = await ctx.db.get(args.draftId);
		if (!row) throw new Error("Draft not found");
		await ctx.db.patch(args.draftId, {
			scheduled: args.scheduledAt,
			publishSelection: args.publishSelection,
			publishLang: args.publishLang,
			publishIntegrationId: args.publishIntegrationId,
			postizPostId: args.postizPostId,
			postizStatus: "scheduled",
			postizError: undefined,
		});
	},
});

export const markPublished = internalMutation({
	args: {
		postizPostId: v.string(),
		permalink: v.optional(v.string()),
	},
	handler: async (ctx, { postizPostId, permalink }): Promise<boolean> => {
		// Look up by Postiz post id, not by draft id — the webhook only
		// knows the Postiz id.
		const row = await ctx.db
			.query("drafts")
			.withIndex("by_postizPostId", (q) => q.eq("postizPostId", postizPostId))
			.unique();
		if (!row) return false;
		await ctx.db.patch(row._id, {
			state: "published",
			postizStatus: "published",
			postizPermalink: permalink,
			postizError: undefined,
		});
		return true;
	},
});

export const markFailed = internalMutation({
	args: {
		postizPostId: v.string(),
		error: v.string(),
	},
	handler: async (ctx, { postizPostId, error }): Promise<boolean> => {
		const row = await ctx.db
			.query("drafts")
			.withIndex("by_postizPostId", (q) => q.eq("postizPostId", postizPostId))
			.unique();
		if (!row) return false;
		await ctx.db.patch(row._id, {
			postizStatus: "failed",
			postizError: error,
		});
		return true;
	},
});

export const markPublishing = internalMutation({
	args: { postizPostId: v.string() },
	handler: async (ctx, { postizPostId }): Promise<boolean> => {
		const row = await ctx.db
			.query("drafts")
			.withIndex("by_postizPostId", (q) => q.eq("postizPostId", postizPostId))
			.unique();
		if (!row) return false;
		await ctx.db.patch(row._id, { postizStatus: "publishing" });
		return true;
	},
});

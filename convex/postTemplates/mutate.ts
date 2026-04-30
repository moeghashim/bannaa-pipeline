import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { mutation } from "../_generated/server";
import { requireUser } from "../lib/requireUser";
import { channelValidator } from "./validators";

export const createFromDraft = mutation({
	args: {
		draftId: v.id("drafts"),
		name: v.string(),
		structureNotes: v.string(),
		exampleText: v.optional(v.string()),
	},
	returns: v.id("postTemplates"),
	handler: async (ctx, args): Promise<Id<"postTemplates">> => {
		const userId = await requireUser(ctx);
		const draft = await ctx.db.get(args.draftId);
		if (!draft) throw new Error("Draft not found");
		if (draft.capturedBy !== userId) throw new Error("Draft not found");
		const now = Date.now();
		const latestMetric = await ctx.db
			.query("postMetrics")
			.withIndex("by_draft_capturedAt", (q) => q.eq("draftId", args.draftId))
			.order("desc")
			.take(1);
		const templateId = await ctx.db.insert("postTemplates", {
			name: args.name.trim(),
			channel: draft.channel,
			sourceDraftId: draft._id,
			structureNotes: args.structureNotes.trim(),
			exampleText: args.exampleText?.trim() || draft.primary.slice(0, 800),
			createdBy: userId,
			createdAt: now,
			updatedAt: now,
			usageCount: 0,
			sourceRating: draft.rating,
			sourceViews: latestMetric[0]?.views,
		});
		await ctx.scheduler.runAfter(0, internal.analytics.events.captureEvent, {
			distinctId: userId,
			event: "template.created",
			properties: {
				template_id: templateId,
				source_draft_id: draft._id,
				channel: draft.channel,
				rating: draft.rating ?? null,
				views: latestMetric[0]?.views ?? null,
			},
		});
		return templateId;
	},
});

export const update = mutation({
	args: {
		id: v.id("postTemplates"),
		name: v.string(),
		structureNotes: v.string(),
		channel: channelValidator,
	},
	returns: v.null(),
	handler: async (ctx, args): Promise<null> => {
		const userId = await requireUser(ctx);
		const row = await ctx.db.get(args.id);
		if (!row || row.createdBy !== userId) throw new Error("Template not found");
		await ctx.db.patch(args.id, {
			name: args.name.trim(),
			structureNotes: args.structureNotes.trim(),
			channel: args.channel,
			updatedAt: Date.now(),
		});
		return null;
	},
});

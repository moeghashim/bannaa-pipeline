"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { capture } from "../lib/analytics";

const scalarValidator = v.union(v.string(), v.number(), v.boolean(), v.null());

const analyticsEventValidator = v.union(
	v.literal("provider.run.completed"),
	v.literal("provider.run.failed"),
	v.literal("draft.rated"),
	v.literal("feedback.submitted"),
	v.literal("publish.scheduled"),
	v.literal("publish.failed"),
	v.literal("post.metrics.captured"),
	v.literal("template.created"),
	v.literal("template.used"),
	v.literal("view_changed"),
	v.literal("palette_opened"),
	v.literal("analysis_promoted"),
	v.literal("draft_approved"),
);

export const captureEvent = internalAction({
	args: {
		distinctId: v.string(),
		event: analyticsEventValidator,
		properties: v.optional(v.record(v.string(), scalarValidator)),
	},
	handler: async (_ctx, args): Promise<void> => {
		await capture(args.distinctId, args.event, args.properties);
	},
});

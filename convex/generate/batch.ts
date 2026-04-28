"use node";

import { v } from "convex/values";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { requireUser } from "../lib/requireUser";
import { angleSlotPlan } from "./prompts";

const channelValidator = v.union(
	v.literal("x"),
	v.literal("ig"),
	v.literal("ig-reel"),
	v.literal("tiktok"),
	v.literal("yt-shorts"),
	v.literal("fb-page"),
	v.literal("linkedin-page"),
);

const MAX_BATCH = 8;

type BatchItemResult =
	| { ok: true; angle: string; draftId: Id<"drafts"> }
	| { ok: false; angle: string; error: string };

/**
 * Spawns N drafts on one channel from one analysis, each with a
 * distinct editorial angle drawn from `angleSlotPlan`. Each item is an
 * independent `fromAnalysisOutput` call — failures are isolated, and
 * dedup runs against earlier siblings as they land.
 *
 * Practical use: when an analysis is rich enough to support multiple
 * takes (a launch, a paper drop, a contrarian topic), spawn 4-6 X
 * posts at once and let the rating layer + operator triage prune.
 */
export const fromAnalysis = action({
	args: {
		analysisId: v.id("analyses"),
		channel: channelValidator,
		count: v.number(),
		outputIndex: v.optional(v.number()),
	},
	returns: v.object({
		requested: v.number(),
		results: v.array(
			v.union(
				v.object({
					ok: v.literal(true),
					angle: v.string(),
					draftId: v.id("drafts"),
				}),
				v.object({
					ok: v.literal(false),
					angle: v.string(),
					error: v.string(),
				}),
			),
		),
	}),
	handler: async (ctx, args): Promise<{ requested: number; results: BatchItemResult[] }> => {
		await requireUser(ctx);
		const count = Math.max(1, Math.min(Math.round(args.count), MAX_BATCH));
		const plan = angleSlotPlan(count);
		const outputIndex = args.outputIndex ?? 0;

		// Run sequentially so each new draft sees its earlier siblings in
		// the dedup window. Parallel would race the embeddings/dedup query.
		const results: BatchItemResult[] = [];
		for (const angle of plan) {
			try {
				const r = await ctx.runAction(api.generate.draft.fromAnalysisOutput, {
					analysisId: args.analysisId,
					channel: args.channel,
					outputIndex,
					angleOverride: angle,
				});
				if (r.ok) {
					results.push({ ok: true, angle, draftId: r.draftId });
				} else {
					results.push({ ok: false, angle, error: r.error });
				}
			} catch (err) {
				results.push({
					ok: false,
					angle,
					error: err instanceof Error ? err.message : String(err),
				});
			}
		}
		return { requested: count, results };
	},
});


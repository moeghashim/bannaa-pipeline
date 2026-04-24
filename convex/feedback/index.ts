import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, type MutationCtx, query } from "../_generated/server";
import { requireUser } from "../lib/requireUser";
import { MEDIA_FEEDBACK_TAGS, TEXT_FEEDBACK_TAGS } from "./tags";

const targetKindValidator = v.union(v.literal("draft"), v.literal("mediaAsset"), v.literal("carouselSlide"));
const ratingValidator = v.union(v.literal("up"), v.literal("down"), v.literal("neutral"));

type TargetKind = "draft" | "mediaAsset" | "carouselSlide";
type Rating = "up" | "down" | "neutral";
type FeedbackSummary = {
	up: number;
	down: number;
	neutral: number;
	topTags: Array<{ tag: string; count: number }>;
	regenerateRate: number;
	approvalRate: number;
};

async function targetContext(
	ctx: MutationCtx,
	targetKind: TargetKind,
	targetId: string,
): Promise<{
	draftId: Id<"drafts">;
	run: Doc<"providerRuns">;
	provider: string;
	model: string;
	brandVersion?: number;
	promptVersion?: string;
}> {
	if (targetKind === "draft") {
		const draft = await ctx.db.get(targetId as Id<"drafts">);
		if (!draft) throw new Error("Draft not found");
		const run = await ctx.db.get(draft.genRunId);
		if (!run) throw new Error("Draft provider run not found");
		return {
			draftId: draft._id,
			run,
			provider: run.provider,
			model: run.model,
			brandVersion: run.brandVersion,
			promptVersion: run.promptVersion,
		};
	}
	if (targetKind === "mediaAsset") {
		const asset = await ctx.db.get(targetId as Id<"mediaAssets">);
		if (!asset) throw new Error("Media asset not found");
		if (!asset.genRunId) throw new Error("Media asset has no provider run");
		const run = await ctx.db.get(asset.genRunId);
		if (!run) throw new Error("Media provider run not found");
		return {
			draftId: asset.draftId,
			run,
			provider: run.provider,
			model: run.model,
			brandVersion: run.brandVersion,
			promptVersion: run.promptVersion,
		};
	}
	const slide = await ctx.db.get(targetId as Id<"carouselSlides">);
	if (!slide) throw new Error("Carousel slide not found");
	const draft = await ctx.db.get(slide.draftId);
	if (!draft) throw new Error("Draft not found");
	const run = await ctx.db.get(slide.genRunId ?? draft.genRunId);
	if (!run) throw new Error("Draft provider run not found");
	return {
		draftId: draft._id,
		run,
		provider: run.provider,
		model: run.model,
		brandVersion: run.brandVersion,
		promptVersion: run.promptVersion,
	};
}

function validateTags(targetKind: TargetKind, tags: string[]): string[] {
	const allowed = targetKind === "draft" || targetKind === "carouselSlide" ? TEXT_FEEDBACK_TAGS : MEDIA_FEEDBACK_TAGS;
	const allowedSet = new Set<string>(allowed);
	return [...new Set(tags)].filter((tag) => allowedSet.has(tag));
}

export const rate = mutation({
	args: {
		targetKind: targetKindValidator,
		targetId: v.string(),
		rating: ratingValidator,
		tags: v.optional(v.array(v.string())),
		note: v.optional(v.string()),
		priorRunId: v.optional(v.id("providerRuns")),
	},
	handler: async (ctx, args): Promise<Id<"feedback">> => {
		const authorId = await requireUser(ctx);
		const context = await targetContext(ctx, args.targetKind, args.targetId);
		const existing = await ctx.db
			.query("feedback")
			.withIndex("by_target", (q) => q.eq("targetKind", args.targetKind).eq("targetId", args.targetId))
			.collect();
		const mine = existing.find((row) => row.authorId === authorId);
		const patch = {
			draftId: context.draftId,
			rating: args.rating,
			tags: validateTags(args.targetKind, args.tags ?? []),
			note: args.note,
			authorId,
			createdAt: Date.now(),
			brandVersion: context.brandVersion,
			promptVersion: context.promptVersion,
			provider: context.provider,
			model: context.model,
			runId: context.run._id,
			priorRunId: args.priorRunId,
		};
		if (mine) {
			await ctx.db.patch(mine._id, patch);
			return mine._id;
		}
		return await ctx.db.insert("feedback", {
			targetKind: args.targetKind,
			targetId: args.targetId,
			...patch,
		});
	},
});

export const forTarget = query({
	args: { targetKind: targetKindValidator, targetId: v.string() },
	handler: async (ctx, args): Promise<Doc<"feedback">[]> => {
		await requireUser(ctx);
		const rows = await ctx.db
			.query("feedback")
			.withIndex("by_target", (q) => q.eq("targetKind", args.targetKind).eq("targetId", args.targetId))
			.collect();
		return rows.sort((a, b) => b.createdAt - a.createdAt);
	},
});

function summarize(rows: Doc<"feedback">[]): FeedbackSummary {
	const out: FeedbackSummary = { up: 0, down: 0, neutral: 0, topTags: [], regenerateRate: 0, approvalRate: 0 };
	const tags = new Map<string, number>();
	let regenerate = 0;
	for (const row of rows) {
		out[row.rating] += 1;
		if (row.priorRunId) regenerate += 1;
		for (const tag of row.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1);
	}
	const total = out.up + out.down + out.neutral;
	out.approvalRate = total ? out.up / total : 0;
	out.regenerateRate = total ? regenerate / total : 0;
	out.topTags = [...tags.entries()]
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, 5);
	return out;
}

export const summaryByBrand = query({
	args: { brandVersion: v.optional(v.number()), since: v.optional(v.number()) },
	handler: async (ctx, args): Promise<FeedbackSummary> => {
		await requireUser(ctx);
		const rows = await ctx.db.query("feedback").collect();
		return summarize(
			rows.filter(
				(row) =>
					(args.brandVersion === undefined || row.brandVersion === args.brandVersion) &&
					(args.since === undefined || row.createdAt >= args.since),
			),
		);
	},
});

export const summaryByPrompt = query({
	args: { promptVersion: v.string(), since: v.optional(v.number()) },
	handler: async (ctx, args): Promise<FeedbackSummary> => {
		await requireUser(ctx);
		const rows = await ctx.db.query("feedback").collect();
		return summarize(
			rows.filter(
				(row) =>
					row.promptVersion === args.promptVersion && (args.since === undefined || row.createdAt >= args.since),
			),
		);
	},
});

"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, type ActionCtx, internalAction } from "../_generated/server";
import { capture } from "../lib/analytics";
import { requireUser } from "../lib/requireUser";
import { refreshXTokenIfNeeded } from "../x/tokens";
import { extractTweetIdFromPermalink, fetchXPostMetrics, type XPostMetrics } from "./x";

const MAX_METRIC_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type Account = {
	_id: Id<"xAccounts">;
	userId: Id<"users">;
	xUserId: string;
	xHandle: string;
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
	autoSync?: boolean;
};

type EligibleDraft = {
	_id: Id<"drafts">;
	channel: "x";
	capturedBy: Id<"users">;
	createdAt: number;
	scheduled?: number;
	postizPermalink?: string;
	rating?: number;
	genRunId: Id<"providerRuns">;
	postTemplateId?: Id<"postTemplates">;
};

type PollSummary = {
	eligible: number;
	withTweetId: number;
	captured: number;
	skipped: number;
};

async function captureMetricSnapshot(
	ctx: ActionCtx,
	draft: EligibleDraft,
	metric: XPostMetrics,
	capturedAt: number,
): Promise<void> {
	const publishedAt = draft.scheduled ?? draft.createdAt;
	const postAgeHours = Math.max(0, Math.round(((capturedAt - publishedAt) / (60 * 60 * 1000)) * 10) / 10);
	await ctx.runMutation(internal.metrics.internal.insertSnapshot, {
		draftId: draft._id,
		channel: draft.channel,
		sourcePostId: metric.sourcePostId,
		capturedAt,
		postAgeHours,
		views: metric.views,
		likes: metric.likes,
		comments: metric.comments,
		shares: metric.shares,
		saves: metric.saves,
	});
	const run = await ctx.runQuery(internal.metrics.internal.loadProviderRun, { id: draft.genRunId });
	await capture(String(draft.capturedBy), "post.metrics.captured", {
		draft_id: draft._id,
		channel: draft.channel,
		source_post_id: metric.sourcePostId,
		views: metric.views ?? null,
		likes: metric.likes,
		comments: metric.comments,
		shares: metric.shares,
		saves: metric.saves ?? null,
		age_hours: postAgeHours,
		provider: run?.provider ?? null,
		model: run?.model ?? null,
		template_id: draft.postTemplateId ?? null,
		rating: draft.rating ?? null,
		prompt_version: run?.promptVersion ?? null,
		brand_version: run?.brandVersion ?? null,
	});
}

async function pollForAccounts(ctx: ActionCtx, accounts: Account[]): Promise<PollSummary> {
	const now = Date.now();
	const drafts = await ctx.runQuery(internal.metrics.internal.listPublishedXDrafts, {
		now,
		maxAgeMs: MAX_METRIC_AGE_MS,
	});
	const draftsByUser = new Map<string, Array<EligibleDraft & { sourcePostId: string }>>();
	let withTweetId = 0;

	for (const draft of drafts) {
		const sourcePostId = extractTweetIdFromPermalink(draft.postizPermalink);
		if (!sourcePostId) continue;
		withTweetId += 1;
		const key = String(draft.capturedBy);
		const group = draftsByUser.get(key) ?? [];
		group.push({ ...draft, sourcePostId });
		draftsByUser.set(key, group);
	}

	let captured = 0;
	for (const account of accounts) {
		const userDrafts = draftsByUser.get(String(account.userId));
		if (!userDrafts || userDrafts.length === 0) continue;
		const accessToken = await refreshXTokenIfNeeded(ctx, account);
		const metrics = await fetchXPostMetrics(
			accessToken,
			userDrafts.map((draft) => draft.sourcePostId),
		);
		for (const draft of userDrafts) {
			const metric = metrics.get(draft.sourcePostId);
			if (!metric) continue;
			await captureMetricSnapshot(ctx, draft, metric, now);
			captured += 1;
		}
	}

	return {
		eligible: drafts.length,
		withTweetId,
		captured,
		skipped: Math.max(0, drafts.length - captured),
	};
}

export const pollAll = internalAction({
	args: {},
	returns: v.null(),
	handler: async (ctx): Promise<null> => {
		const accounts = await ctx.runQuery(internal.x.accounts.listAll, {});
		try {
			await pollForAccounts(ctx, accounts);
		} catch (err) {
			console.warn("Post metrics poll failed", {
				message: err instanceof Error ? err.message : String(err),
			});
		}
		return null;
	},
});

export const pollNow = internalAction({
	args: {},
	returns: v.object({
		eligible: v.number(),
		withTweetId: v.number(),
		captured: v.number(),
		skipped: v.number(),
	}),
	handler: async (ctx): Promise<PollSummary> => {
		const accounts = await ctx.runQuery(internal.x.accounts.listAll, {});
		return await pollForAccounts(ctx, accounts);
	},
});

export const pollMine = action({
	args: {},
	returns: v.object({
		eligible: v.number(),
		withTweetId: v.number(),
		captured: v.number(),
		skipped: v.number(),
	}),
	handler: async (ctx): Promise<PollSummary> => {
		const userId = await requireUser(ctx);
		const accounts = await ctx.runQuery(internal.x.accounts.listAll, {});
		const account = accounts.find((candidate) => candidate.userId === userId);
		if (!account) throw new Error("X account not connected");
		return await pollForAccounts(ctx, [account]);
	},
});

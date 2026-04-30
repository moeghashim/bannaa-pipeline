"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { type ActionCtx, internalAction } from "../_generated/server";
import { capture } from "../lib/analytics";
import { listIntegrations } from "../publish/postiz";
import { fetchPostizIntegrationMetrics } from "./postiz";

const WINDOW_DAYS = 30;

type PollSummary = {
	integrations: number;
	captured: number;
	failed: number;
};

async function pollIntegrations(): Promise<
	Array<Awaited<ReturnType<typeof fetchPostizIntegrationMetrics>>>
> {
	const integrations = await listIntegrations();
	if (!integrations.ok) throw new Error(integrations.error);
	const active = integrations.integrations.filter((integration) => !integration.disabled);
	const snapshots = [];
	for (const integration of active) {
		snapshots.push(
			await fetchPostizIntegrationMetrics({
				integrationId: integration.id,
				provider: integration.providerIdentifier,
				name: integration.name,
				windowDays: WINDOW_DAYS,
			}),
		);
	}
	return snapshots;
}

async function runPoll(ctx: ActionCtx): Promise<PollSummary> {
	const capturedAt = Date.now();
	const snapshots = await pollIntegrations();
	let captured = 0;
	let failed = 0;
	for (const snapshot of snapshots) {
		try {
			await ctx.runMutation(internal.metrics.postizInternal.insertIntegrationSnapshot, {
				...snapshot,
				capturedAt,
			});
			await capture("postiz-integration-metrics", "postiz.integration.metrics.captured", {
				integration_id: snapshot.integrationId,
				provider: snapshot.provider,
				name: snapshot.name,
				window_days: snapshot.windowDays,
				views: snapshot.views ?? null,
				likes: snapshot.likes ?? null,
				comments: snapshot.comments ?? null,
				shares: snapshot.shares ?? null,
				saves: snapshot.saves ?? null,
				followers: snapshot.followers ?? null,
				reach: snapshot.reach ?? null,
				raw_metric_count: snapshot.rawMetricCount,
				attribution: "integration_level",
			});
			captured += 1;
		} catch (err) {
			failed += 1;
			console.warn("Postiz integration metrics snapshot failed", {
				integrationId: snapshot.integrationId,
				provider: snapshot.provider,
				message: err instanceof Error ? err.message : String(err),
			});
		}
	}
	return { integrations: snapshots.length, captured, failed };
}

export const pollAll = internalAction({
	args: {},
	returns: v.null(),
	handler: async (ctx): Promise<null> => {
		try {
			await runPoll(ctx);
		} catch (err) {
			console.warn("Postiz integration metrics poll failed", {
				message: err instanceof Error ? err.message : String(err),
			});
		}
		return null;
	},
});

export const pollNow = internalAction({
	args: {},
	returns: v.object({
		integrations: v.number(),
		captured: v.number(),
		failed: v.number(),
	}),
	handler: async (ctx): Promise<PollSummary> => await runPoll(ctx),
});

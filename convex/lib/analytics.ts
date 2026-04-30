"use node";

import type { Doc, Id } from "../_generated/dataModel";

type AnalyticsScalar = string | number | boolean | null;
export type AnalyticsProperties = Record<string, AnalyticsScalar>;

export type AnalyticsEvent =
	| "provider.run.completed"
	| "provider.run.failed"
	| "draft.rated"
	| "feedback.submitted"
	| "publish.scheduled"
	| "publish.failed"
	| "post.metrics.captured"
	| "template.created"
	| "template.used"
	| "view_changed"
	| "palette_opened"
	| "analysis_promoted"
	| "draft_approved";

export type ProviderRunMirror = Pick<
	Doc<"providerRuns">,
	| "provider"
	| "model"
	| "purpose"
	| "itemId"
	| "inputTokens"
	| "outputTokens"
	| "cost"
	| "error"
	| "brandVersion"
	| "promptVersion"
> & {
	runId?: Id<"providerRuns">;
};

function getPostHogConfig(): { key: string; host: string } | null {
	const key = process.env.POSTHOG_API_KEY;
	if (!key) return null;
	return {
		key,
		host: (process.env.POSTHOG_HOST ?? "https://us.i.posthog.com").replace(/\/$/, ""),
	};
}

function sanitizeValue(value: AnalyticsScalar): AnalyticsScalar {
	if (typeof value !== "string") return value;
	return value.length > 256 ? `${value.slice(0, 253)}...` : value;
}

function sanitizeProperties(properties: AnalyticsProperties | undefined): AnalyticsProperties | undefined {
	if (!properties) return undefined;
	const out: AnalyticsProperties = {};
	for (const [key, value] of Object.entries(properties)) {
		out[key] = sanitizeValue(value);
	}
	return out;
}

export async function capture(
	distinctId: string,
	event: AnalyticsEvent,
	properties?: AnalyticsProperties,
): Promise<void> {
	const config = getPostHogConfig();
	if (!config) return;
	try {
		const response = await fetch(`${config.host}/capture/`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				api_key: config.key,
				distinct_id: distinctId,
				event,
				properties: sanitizeProperties(properties),
			}),
		});
		if (!response.ok) {
			console.warn("PostHog capture failed", {
				event,
				status: response.status,
				body: (await response.text()).slice(0, 256),
			});
		}
	} catch (err) {
		// Analytics must never break the operator workflow.
		console.warn("PostHog capture error", {
			event,
			message: err instanceof Error ? err.message : String(err),
		});
	}
}

export async function mirrorProviderRun(
	distinctId: string,
	row: ProviderRunMirror,
	durationMs: number,
	extraProperties?: AnalyticsProperties,
): Promise<void> {
	await capture(distinctId, row.error ? "provider.run.failed" : "provider.run.completed", {
		run_id: row.runId ?? null,
		provider: row.provider,
		model: row.model,
		purpose: row.purpose,
		item_id: row.itemId ?? null,
		input_tokens: row.inputTokens,
		output_tokens: row.outputTokens,
		cost: row.cost,
		duration_ms: durationMs,
		error: row.error ?? null,
		brand_version: row.brandVersion ?? null,
		prompt_version: row.promptVersion ?? null,
		...extraProperties,
	});
}

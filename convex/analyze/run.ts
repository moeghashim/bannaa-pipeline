"use node";

import Anthropic from "@anthropic-ai/sdk";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import { requireUser } from "../lib/requireUser";
import {
	ANALYZE_SYSTEM_PROMPT,
	ANALYZE_TOOL,
	type AnalyzeToolOutput,
	buildUserPrompt,
	estimateCost,
} from "./prompts";

const MODEL = "claude-sonnet-4-6";

export const run = action({
	args: { id: v.id("inboxItems") },
	handler: async (ctx, { id }) => {
		await requireUser(ctx);

		const apiKey = process.env.ANTHROPIC_API_KEY;
		if (!apiKey) {
			throw new Error("ANTHROPIC_API_KEY is not configured in Convex env");
		}

		const item = await ctx.runQuery(internal.analyze.internal.loadItem, { id });
		if (!item) throw new Error("Item not found");
		if (item.state === "analyzing") {
			throw new Error("Item is already being analyzed");
		}

		await ctx.runMutation(internal.analyze.internal.markAnalyzing, { id });

		const ontology = await ctx.runQuery(internal.analyze.internal.listApprovedConceptNames, {});
		const userPrompt = buildUserPrompt({
			source: item.source,
			handle: item.handle,
			title: item.title,
			snippet: item.snippet,
			raw: item.raw,
			url: item.url,
			ontology,
		});

		const client = new Anthropic({ apiKey });

		let inputTokens = 0;
		let outputTokens = 0;

		try {
			const message = await client.messages.create({
				model: MODEL,
				max_tokens: 2048,
				system: ANALYZE_SYSTEM_PROMPT,
				tools: [ANALYZE_TOOL],
				tool_choice: { type: "tool", name: ANALYZE_TOOL.name },
				messages: [{ role: "user", content: userPrompt }],
			});

			inputTokens = message.usage.input_tokens;
			outputTokens = message.usage.output_tokens;

			const toolUse = message.content.find((c) => c.type === "tool_use" && c.name === ANALYZE_TOOL.name);
			if (!toolUse || toolUse.type !== "tool_use") {
				throw new Error("Model did not call record_analysis tool");
			}

			const out = toolUse.input as AnalyzeToolOutput;
			validateOutput(out);

			const cost = estimateCost(inputTokens, outputTokens);

			await ctx.runMutation(internal.analyze.internal.recordSuccess, {
				itemId: id,
				provider: "claude",
				model: MODEL,
				runAt: Date.now(),
				summary: out.summary,
				concepts: out.concepts,
				keyPoints: out.keyPoints,
				track: out.track,
				outputs: out.outputs,
				inputTokens,
				outputTokens,
				cost,
			});

			return { ok: true as const, cost };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			const cost = estimateCost(inputTokens, outputTokens);
			await ctx.runMutation(internal.analyze.internal.recordAudit, {
				itemId: id,
				model: MODEL,
				inputTokens,
				outputTokens,
				cost,
				error: message,
			});
			await ctx.runMutation(internal.analyze.internal.recordFailure, {
				id,
				error: message,
			});
			return { ok: false as const, error: message };
		}
	},
});

function validateOutput(out: unknown): asserts out is AnalyzeToolOutput {
	if (!out || typeof out !== "object") throw new Error("Tool output is not an object");
	const o = out as Record<string, unknown>;
	if (typeof o.summary !== "string") throw new Error("summary must be a string");
	if (!Array.isArray(o.concepts) || o.concepts.length === 0) throw new Error("concepts must be a non-empty array");
	if (!Array.isArray(o.keyPoints) || o.keyPoints.length < 2) throw new Error("keyPoints must have at least 2 items");
	if (o.track !== "Foundations" && o.track !== "Agents" && o.track !== "Media") throw new Error("track is invalid");
	if (!Array.isArray(o.outputs) || o.outputs.length === 0) throw new Error("outputs must be a non-empty array");
	for (const item of o.outputs) {
		if (!item || typeof item !== "object") throw new Error("output entry must be an object");
		const e = item as Record<string, unknown>;
		if (e.kind !== "tweet" && e.kind !== "reel" && e.kind !== "website") throw new Error("output.kind is invalid");
		if (typeof e.hook !== "string" || e.hook.length < 10) throw new Error("output.hook must be a string");
	}
}

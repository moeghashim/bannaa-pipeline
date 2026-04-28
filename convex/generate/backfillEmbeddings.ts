"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { embedText, EMBEDDING_MODEL } from "./embeddings";

type BackfillReport = {
	totalScanned: number;
	missing: number;
	processed: number;
	errors: number;
	dryRun: boolean;
};

/**
 * Embeds the `primary` text of every draft that doesn't yet have one,
 * so dedup has a comparison set going forward. Idempotent: drafts that
 * already have an embedding are skipped.
 *
 * Run via:
 *   npx convex run generate/backfillEmbeddings:run '{"dryRun":true}'
 *   npx convex run generate/backfillEmbeddings:run
 *
 * Cost: ~$0.000002 per draft (text-embedding-3-small).
 */
export const run = internalAction({
	args: {
		limit: v.optional(v.number()),
		dryRun: v.optional(v.boolean()),
	},
	handler: async (ctx, { limit = 500, dryRun = false }): Promise<BackfillReport> => {
		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) throw new Error("OPENAI_API_KEY is not configured in Convex env");

		const drafts = await ctx.runQuery(internal.generate.internal.listDraftsForBackfill, { limit });
		const missing = drafts.filter((d) => !d.embedding || d.embedding.length === 0);

		if (dryRun) {
			return {
				totalScanned: drafts.length,
				missing: missing.length,
				processed: 0,
				errors: 0,
				dryRun: true,
			};
		}

		let processed = 0;
		let errors = 0;
		for (const d of missing) {
			try {
				const r = await embedText(d.primary, apiKey);
				await ctx.runMutation(internal.generate.internal.setDraftEmbedding, {
					id: d._id,
					embedding: r.embedding,
				});
				await ctx.runMutation(internal.generate.internal.recordEmbeddingRun, {
					model: EMBEDDING_MODEL,
					itemId: d.sourceItemId,
					inputTokens: r.inputTokens,
					cost: r.cost,
					purpose: "backfill-embedding",
				});
				processed += 1;
			} catch {
				errors += 1;
			}
		}

		return {
			totalScanned: drafts.length,
			missing: missing.length,
			processed,
			errors,
			dryRun: false,
		};
	},
});

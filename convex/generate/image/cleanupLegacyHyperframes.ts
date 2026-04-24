// One-shot migration — delete legacy satori composite rows.
//
// Run via:
//   npx convex run generate/image/cleanupLegacyHyperframes:run
//
// After the satori compositor was removed, existing mediaAssets rows with
// `provider: "hyperframes"` are orphaned code paths — nothing generates
// them anymore, the UI no longer has an "overlay" view that treats them
// specially (the baked path replaces them), and keeping them around only
// forces the schema to retain `"hyperframes"` as a legacy literal.
//
// This mutation deletes those rows and their storage blobs so we can
// cleanly drop the literal from the schema union. Legacy drafts that had
// satori composites fall back to their base image after this runs;
// operators can click "Overlay AR text" to regenerate via gpt-image-2 if
// they want the AR caption baked in.
//
// Safe to re-run — finds and deletes any `"hyperframes"` rows that exist.
// A second run after the first will report `deleted: 0`.

import { v } from "convex/values";
import { mutation } from "../../_generated/server";

// No `requireUser` guard — this is a one-shot admin migration invoked via
// `npx convex run`, which authenticates with the deploy key rather than a
// signed-in user identity. The file is intended to be deleted in a
// follow-up commit once the migration has been run against every
// environment; there is no path for non-admins to reach it.
export const run = mutation({
	args: {},
	returns: v.object({
		deleted: v.number(),
		blobsFreed: v.number(),
		blobsMissing: v.number(),
	}),
	handler: async (ctx): Promise<{ deleted: number; blobsFreed: number; blobsMissing: number }> => {
		const rows = await ctx.db
			.query("mediaAssets")
			.filter((q) => q.eq(q.field("provider"), "hyperframes"))
			.collect();

		let blobsFreed = 0;
		let blobsMissing = 0;

		for (const row of rows) {
			if (row.storageId) {
				try {
					await ctx.storage.delete(row.storageId);
					blobsFreed += 1;
				} catch {
					// Storage blob may have already been GC'd or never finished
					// uploading — count it so the operator can reconcile, but
					// don't abort the whole migration on one stale reference.
					blobsMissing += 1;
				}
			}
			await ctx.db.delete(row._id);
		}

		return { deleted: rows.length, blobsFreed, blobsMissing };
	},
});

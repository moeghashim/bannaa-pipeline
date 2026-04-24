// One-shot migration.
//
// Run via:
//   npx convex run migrations/seedBrand:run
//
// Safe to re-run: if an active brand already exists, this returns it without
// inserting a duplicate.

import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { defaultBrandInput } from "../brand/defaults";

export const run = mutation({
	args: {},
	returns: v.object({ inserted: v.boolean(), brandId: v.id("brands") }),
	handler: async (ctx) => {
		const existing = await ctx.db
			.query("brands")
			.withIndex("by_active", (q) => q.eq("isActive", true))
			.first();
		if (existing) return { inserted: false, brandId: existing._id };

		const now = Date.now();
		const brand = defaultBrandInput(now);
		const brandId = await ctx.db.insert("brands", brand);
		await ctx.db.insert("brandVersions", {
			brandId,
			version: brand.version,
			tone: brand.tone,
			design: brand.design,
			note: "Seeded from the pre-brand-config defaults.",
			publishedAt: now,
		});
		return { inserted: true, brandId };
	},
});

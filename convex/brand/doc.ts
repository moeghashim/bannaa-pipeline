import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalQuery, mutation, query } from "../_generated/server";
import { requireUser } from "../lib/requireUser";
import { defaultBrandInput } from "./defaults";
import { brandDesignValidator, brandToneValidator } from "./validators";

async function readActiveBrand(ctx: QueryCtx | MutationCtx): Promise<Doc<"brands"> | null> {
	return await ctx.db
		.query("brands")
		.withIndex("by_active", (q) => q.eq("isActive", true))
		.first();
}

async function insertDefaultBrand(ctx: MutationCtx, now: number): Promise<Id<"brands">> {
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
	return brandId;
}

export const getActive = query({
	args: {},
	handler: async (ctx): Promise<Doc<"brands"> | null> => {
		await requireUser(ctx);
		return await readActiveBrand(ctx);
	},
});

export const getActiveInternal = internalQuery({
	args: {},
	handler: async (ctx): Promise<Doc<"brands"> | null> => await readActiveBrand(ctx),
});

export const ensureActive = mutation({
	args: {},
	returns: v.id("brands"),
	handler: async (ctx): Promise<Id<"brands">> => {
		await requireUser(ctx);
		const active = await readActiveBrand(ctx);
		if (active) return active._id;
		return await insertDefaultBrand(ctx, Date.now());
	},
});

export const updateActive = mutation({
	args: {
		name: v.optional(v.string()),
		tone: v.optional(brandToneValidator),
		design: v.optional(brandDesignValidator),
	},
	returns: v.id("brands"),
	handler: async (ctx, args): Promise<Id<"brands">> => {
		await requireUser(ctx);
		let active = await readActiveBrand(ctx);
		if (!active) {
			const id = await insertDefaultBrand(ctx, Date.now());
			active = await ctx.db.get(id);
			if (!active) throw new Error("Failed to create active brand");
		}

		await ctx.db.patch(active._id, {
			...(args.name === undefined ? {} : { name: args.name }),
			...(args.tone === undefined ? {} : { tone: args.tone }),
			...(args.design === undefined ? {} : { design: args.design }),
			updatedAt: Date.now(),
		});
		return active._id;
	},
});

export const publishVersion = mutation({
	args: { note: v.optional(v.string()) },
	returns: v.number(),
	handler: async (ctx, { note }): Promise<number> => {
		await requireUser(ctx);
		let active = await readActiveBrand(ctx);
		if (!active) {
			const id = await insertDefaultBrand(ctx, Date.now());
			active = await ctx.db.get(id);
			if (!active) throw new Error("Failed to create active brand");
		}

		const nextVersion = active.version + 1;
		const now = Date.now();
		await ctx.db.insert("brandVersions", {
			brandId: active._id,
			version: nextVersion,
			tone: active.tone,
			design: active.design,
			note,
			publishedAt: now,
		});
		await ctx.db.patch(active._id, { version: nextVersion, updatedAt: now });
		return nextVersion;
	},
});

export const listVersions = query({
	args: {},
	handler: async (ctx): Promise<Doc<"brandVersions">[]> => {
		await requireUser(ctx);
		const active = await readActiveBrand(ctx);
		if (!active) return [];
		const rows = await ctx.db
			.query("brandVersions")
			.withIndex("by_brand", (q) => q.eq("brandId", active._id))
			.collect();
		return rows.sort((a, b) => b.version - a.version);
	},
});

export const listVersionsSummary = query({
	args: {},
	handler: async (ctx) => {
		await requireUser(ctx);
		const runs = await ctx.db.query("providerRuns").withIndex("by_runAt").collect();
		const byVersion = new Map<number, { brandVersion: number; runs: number; cost: number; lastRunAt: number }>();
		for (const run of runs) {
			if (run.brandVersion === undefined) continue;
			const current = byVersion.get(run.brandVersion) ?? {
				brandVersion: run.brandVersion,
				runs: 0,
				cost: 0,
				lastRunAt: 0,
			};
			current.runs += 1;
			current.cost += run.cost;
			current.lastRunAt = Math.max(current.lastRunAt, run.runAt);
			byVersion.set(run.brandVersion, current);
		}
		return [...byVersion.values()].sort((a, b) => b.brandVersion - a.brandVersion);
	},
});

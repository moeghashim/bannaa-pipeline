import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalQuery, mutation, query } from "../_generated/server";
import { requireUser } from "../lib/requireUser";

const providerValidator = v.union(v.literal("claude"), v.literal("glm"), v.literal("openrouter"));

// Settings only exposes generation providers. "hyperframes" is a compositor,
// never a default generator, so it is intentionally absent from this union.
const imageProviderValidator = v.union(
	v.literal("nano-banana"),
	v.literal("gpt-image"),
	v.literal("grok"),
	v.literal("ideogram"),
	v.literal("openrouter"),
);

const outputLanguageValidator = v.union(
	v.literal("ar-khaleeji"),
	v.literal("ar-msa"),
	v.literal("ar-levantine"),
);

const SETTINGS_SINGLETON = "app";

async function readSettings(ctx: QueryCtx | MutationCtx): Promise<Doc<"settings"> | null> {
	const rows = await ctx.db
		.query("settings")
		.withIndex("by_key", (q) => q.eq("key", SETTINGS_SINGLETON))
		.collect();
	return rows[0] ?? null;
}

export const get = query({
	args: {},
	handler: async (ctx) => {
		await requireUser(ctx);
		return await readSettings(ctx);
	},
});

export const setDefaultProvider = mutation({
	args: { provider: providerValidator },
	handler: async (ctx, { provider }) => {
		await requireUser(ctx);
		const existing = await readSettings(ctx);
		if (existing) {
			await ctx.db.patch(existing._id, { defaultProvider: provider, updatedAt: Date.now() });
			return;
		}
		await ctx.db.insert("settings", {
			key: SETTINGS_SINGLETON,
			defaultProvider: provider,
			outputLanguages: ["ar-khaleeji"],
			updatedAt: Date.now(),
		});
	},
});

export const setDefaultImageProvider = mutation({
	args: { provider: imageProviderValidator },
	handler: async (ctx, { provider }) => {
		await requireUser(ctx);
		const existing = await readSettings(ctx);
		if (existing) {
			await ctx.db.patch(existing._id, { defaultImageProvider: provider, updatedAt: Date.now() });
			return;
		}
		await ctx.db.insert("settings", {
			key: SETTINGS_SINGLETON,
			defaultProvider: "glm",
			defaultImageProvider: provider,
			outputLanguages: ["ar-khaleeji"],
			updatedAt: Date.now(),
		});
	},
});

export const setOutputLanguages = mutation({
	args: { languages: v.array(outputLanguageValidator) },
	handler: async (ctx, { languages }) => {
		await requireUser(ctx);
		const deduped = [...new Set(languages)];
		const existing = await readSettings(ctx);
		if (existing) {
			await ctx.db.patch(existing._id, { outputLanguages: deduped, updatedAt: Date.now() });
			return;
		}
		await ctx.db.insert("settings", {
			key: SETTINGS_SINGLETON,
			defaultProvider: "glm",
			outputLanguages: deduped,
			updatedAt: Date.now(),
		});
	},
});

export const getInternal = internalQuery({
	args: {},
	returns: v.union(
		v.object({
			_id: v.id("settings"),
			_creationTime: v.number(),
			key: v.string(),
			defaultProvider: providerValidator,
			defaultImageProvider: v.optional(imageProviderValidator),
			outputLanguages: v.optional(v.array(outputLanguageValidator)),
			updatedAt: v.number(),
		}),
		v.null(),
	),
	handler: async (ctx): Promise<Doc<"settings"> | null> => await readSettings(ctx),
});

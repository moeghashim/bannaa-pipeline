import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalQuery, mutation, query } from "../_generated/server";
import { outputLanguageValidator as canonicalLangValidator } from "../generate/languages";
import { requireUser } from "../lib/requireUser";

const providerValidator = v.union(
	v.literal("claude"),
	v.literal("glm"),
	v.literal("openrouter"),
	v.literal("deepseek"),
);

// Settings only exposes generation providers. "hyperframes" is a compositor,
// never a default generator, so it is intentionally absent from this union.
const imageProviderValidator = v.union(
	v.literal("nano-banana"),
	v.literal("gpt-image"),
	v.literal("grok"),
	v.literal("ideogram"),
	v.literal("openrouter"),
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
			defaultPrimaryLanguage: "en",
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
			defaultPrimaryLanguage: "en",
			updatedAt: Date.now(),
		});
	},
});

// Overlay model (the model used by the image-edit step that bakes
// caption + brand chrome on top of the base). Provider stays gpt-image
// because that is the only edit-capable backend we have wired today;
// only the model string is operator-tunable so we can roll forward
// (gpt-image-2 → gpt-image-3) without redeploying. Empty string clears
// the override and falls back to the hardcoded default at read-time.
export const setOverlayModel = mutation({
	args: { model: v.string() },
	handler: async (ctx, { model }) => {
		await requireUser(ctx);
		const trimmed = model.trim();
		const value = trimmed.length === 0 ? undefined : trimmed;
		const existing = await readSettings(ctx);
		if (existing) {
			await ctx.db.patch(existing._id, { overlayModel: value, updatedAt: Date.now() });
			return;
		}
		await ctx.db.insert("settings", {
			key: SETTINGS_SINGLETON,
			defaultProvider: "glm",
			overlayModel: value,
			defaultPrimaryLanguage: "en",
			updatedAt: Date.now(),
		});
	},
});

export const setDefaultPrimaryLanguage = mutation({
	args: { language: canonicalLangValidator },
	handler: async (ctx, { language }) => {
		await requireUser(ctx);
		const existing = await readSettings(ctx);
		if (existing) {
			await ctx.db.patch(existing._id, {
				defaultPrimaryLanguage: language,
				updatedAt: Date.now(),
			});
			return;
		}
		await ctx.db.insert("settings", {
			key: SETTINGS_SINGLETON,
			defaultProvider: "glm",
			defaultPrimaryLanguage: language,
			updatedAt: Date.now(),
		});
	},
});

export const setTranslationTargets = mutation({
	args: { languages: v.array(canonicalLangValidator) },
	handler: async (ctx, { languages }) => {
		await requireUser(ctx);
		const deduped = [...new Set(languages)];
		const existing = await readSettings(ctx);
		if (existing) {
			await ctx.db.patch(existing._id, {
				translationTargets: deduped,
				updatedAt: Date.now(),
			});
			return;
		}
		await ctx.db.insert("settings", {
			key: SETTINGS_SINGLETON,
			defaultProvider: "glm",
			defaultPrimaryLanguage: "en",
			translationTargets: deduped,
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
			overlayModel: v.optional(v.string()),
			defaultPrimaryLanguage: v.optional(canonicalLangValidator),
			translationTargets: v.optional(v.array(canonicalLangValidator)),
			updatedAt: v.number(),
		}),
		v.null(),
	),
	handler: async (ctx): Promise<Doc<"settings"> | null> => await readSettings(ctx),
});

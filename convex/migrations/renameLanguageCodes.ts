// One-shot migration to rename legacy language codes to the canonical set.
//
// Run via:
//   npx convex run migrations/renameLanguageCodes:run '{"dryRun": true}'
//   npx convex run migrations/renameLanguageCodes:run
//
// Behaviour:
//   - drafts.publishLang:        "ar-khaleeji" → "ar-saudi"; "ar-levantine" → "ar-msa"
//   - drafts.translations[].lang: same; "ar-levantine" rows are dropped (regen-able)
//   - carouselSlides.translations[].lang: same as drafts
//   - settings.outputLanguages: cleared (field is superseded by defaultPrimaryLanguage)
//   - settings.defaultPrimaryLanguage: set to "en" if missing
//   - brands.tone.arPresets: rekey "ar-khaleeji" → "ar-saudi"; drop "ar-levantine"
//   - brands.tone.activeArPreset: rewrite legacy values
//
// Safe to re-run: each step is idempotent (it checks before writing).

import { v } from "convex/values";
import { mutation } from "../_generated/server";

type Counts = {
	draftsPublishLang: number;
	draftsTranslationsRekeyed: number;
	draftsTranslationsDropped: number;
	carouselTranslationsRekeyed: number;
	carouselTranslationsDropped: number;
	settingsCleared: number;
	settingsDefaulted: number;
	brandsRekeyed: number;
};

export const run = mutation({
	args: { dryRun: v.optional(v.boolean()) },
	returns: v.object({
		dryRun: v.boolean(),
		counts: v.object({
			draftsPublishLang: v.number(),
			draftsTranslationsRekeyed: v.number(),
			draftsTranslationsDropped: v.number(),
			carouselTranslationsRekeyed: v.number(),
			carouselTranslationsDropped: v.number(),
			settingsCleared: v.number(),
			settingsDefaulted: v.number(),
			brandsRekeyed: v.number(),
		}),
	}),
	handler: async (ctx, { dryRun }) => {
		const counts: Counts = {
			draftsPublishLang: 0,
			draftsTranslationsRekeyed: 0,
			draftsTranslationsDropped: 0,
			carouselTranslationsRekeyed: 0,
			carouselTranslationsDropped: 0,
			settingsCleared: 0,
			settingsDefaulted: 0,
			brandsRekeyed: 0,
		};

		const drafts = await ctx.db.query("drafts").collect();
		for (const draft of drafts) {
			const patch: Partial<typeof draft> = {};
			const pLang = draft.publishLang as string | undefined;
			if (pLang === "ar-khaleeji") {
				patch.publishLang = "ar-saudi";
				counts.draftsPublishLang += 1;
			} else if (pLang === "ar-levantine") {
				patch.publishLang = "ar-msa";
				counts.draftsPublishLang += 1;
			}
			if (draft.translations && draft.translations.length > 0) {
				const next = [];
				let touched = false;
				for (const t of draft.translations) {
					const tLang = t.lang as string;
					if (tLang === "ar-khaleeji") {
						next.push({ ...t, lang: "ar-saudi" as const });
						counts.draftsTranslationsRekeyed += 1;
						touched = true;
					} else if (tLang === "ar-levantine") {
						counts.draftsTranslationsDropped += 1;
						touched = true;
					} else {
						next.push(t);
					}
				}
				if (touched) patch.translations = next;
			}
			if (Object.keys(patch).length > 0 && !dryRun) {
				await ctx.db.patch(draft._id, patch);
			}
		}

		const slides = await ctx.db.query("carouselSlides").collect();
		for (const slide of slides) {
			if (!slide.translations || slide.translations.length === 0) continue;
			const next = [];
			let touched = false;
			for (const t of slide.translations) {
				const tLang = t.lang as string;
				if (tLang === "ar-khaleeji") {
					next.push({ ...t, lang: "ar-saudi" as const });
					counts.carouselTranslationsRekeyed += 1;
					touched = true;
				} else if (tLang === "ar-levantine") {
					counts.carouselTranslationsDropped += 1;
					touched = true;
				} else {
					next.push(t);
				}
			}
			if (touched && !dryRun) {
				await ctx.db.patch(slide._id, { translations: next });
			}
		}

		const settingsRows = await ctx.db.query("settings").collect();
		for (const s of settingsRows) {
			const patch: Partial<typeof s> = {};
			const legacyOutputLanguages = (s as Record<string, unknown>).outputLanguages;
			if (legacyOutputLanguages !== undefined) {
				(patch as Record<string, unknown>).outputLanguages = undefined;
				counts.settingsCleared += 1;
			}
			if (s.defaultPrimaryLanguage === undefined) {
				patch.defaultPrimaryLanguage = "en";
				counts.settingsDefaulted += 1;
			}
			if (Object.keys(patch).length > 0 && !dryRun) {
				await ctx.db.patch(s._id, patch);
			}
		}

		const brands = await ctx.db.query("brands").collect();
		for (const brand of brands) {
			const presets = brand.tone.arPresets ?? {};
			const nextPresets: Record<string, string> = {};
			let touched = false;
			for (const [key, value] of Object.entries(presets)) {
				if (key === "ar-khaleeji") {
					nextPresets["ar-saudi"] = value;
					touched = true;
				} else if (key === "ar-levantine") {
					touched = true;
				} else {
					nextPresets[key] = value;
				}
			}
			let activePreset = brand.tone.activeArPreset;
			if (activePreset === "ar-khaleeji") {
				activePreset = "ar-saudi";
				touched = true;
			} else if (activePreset === "ar-levantine") {
				activePreset = "ar-msa";
				touched = true;
			}
			if (touched) {
				counts.brandsRekeyed += 1;
				if (!dryRun) {
					await ctx.db.patch(brand._id, {
						tone: { ...brand.tone, arPresets: nextPresets, activeArPreset: activePreset },
					});
				}
			}
		}

		return { dryRun: dryRun === true, counts };
	},
});

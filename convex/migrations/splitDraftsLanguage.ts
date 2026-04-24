// One-shot migration.
//
// Run via:
//   npx convex run migrations/splitDraftsLanguage:run
//
// Safe to re-run: it only patches rows missing the new overlap fields.

import { v } from "convex/values";
import { mutation } from "../_generated/server";

export const run = mutation({
	args: {},
	returns: v.object({ draftsUpdated: v.number(), slidesUpdated: v.number() }),
	handler: async (ctx) => {
		let draftsUpdated = 0;
		const drafts = await ctx.db.query("drafts").collect();
		for (const draft of drafts) {
			const patch: {
				primary?: string;
				translations?: NonNullable<typeof draft.translations>;
			} = {};
			if (!draft.primary) patch.primary = draft.en;
			if (!draft.translations && draft.ar.trim()) {
				patch.translations = [
					{
						lang: "ar-khaleeji",
						text: draft.ar,
						chars: draft.ar.length,
						genRunId: draft.genRunId,
						createdAt: draft.createdAt,
					},
				];
			}
			if (Object.keys(patch).length > 0) {
				await ctx.db.patch(draft._id, patch);
				draftsUpdated += 1;
			}
		}

		let slidesUpdated = 0;
		const slides = await ctx.db.query("carouselSlides").collect();
		for (const slide of slides) {
			if (slide.primary || slide.translations || !slide.ar.trim()) continue;
			const draft = await ctx.db.get(slide.draftId);
			if (!draft) continue;
			await ctx.db.patch(slide._id, {
				primary: slide.ar,
				translations: [
					{
						lang: "ar-khaleeji",
						text: slide.ar,
						chars: slide.ar.length,
						genRunId: draft.genRunId,
						createdAt: slide.createdAt,
					},
				],
			});
			slidesUpdated += 1;
		}

		return { draftsUpdated, slidesUpdated };
	},
});

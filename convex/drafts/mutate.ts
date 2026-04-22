import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireUser } from "../lib/requireUser";

export const approve = mutation({
	args: { id: v.id("drafts") },
	handler: async (ctx, { id }) => {
		await requireUser(ctx);
		const row = await ctx.db.get(id);
		if (!row) throw new Error("Draft not found");
		await ctx.db.patch(id, { state: "approved" });
	},
});

export const reject = mutation({
	args: { id: v.id("drafts") },
	handler: async (ctx, { id }) => {
		await requireUser(ctx);
		const row = await ctx.db.get(id);
		if (!row) throw new Error("Draft not found");
		await ctx.db.patch(id, { state: "rejected" });
	},
});

export const reopen = mutation({
	args: { id: v.id("drafts") },
	handler: async (ctx, { id }) => {
		await requireUser(ctx);
		const row = await ctx.db.get(id);
		if (!row) throw new Error("Draft not found");
		await ctx.db.patch(id, { state: "new" });
	},
});

// Updates the Khaleeji-AR copy in place. Rejected once the draft has
// been scheduled — Postiz already holds a copy of the text, and silently
// diverging the local draft from what's queued to publish is worse than
// forcing the operator to unschedule first. `chars` is recalculated
// here so the draft card's char counter stays in sync without needing
// the UI to do double bookkeeping.
export const updateAr = mutation({
	args: { id: v.id("drafts"), ar: v.string() },
	handler: async (ctx, { id, ar }) => {
		await requireUser(ctx);
		const row = await ctx.db.get(id);
		if (!row) throw new Error("Draft not found");
		if (row.postizStatus && row.postizStatus !== "failed") {
			throw new Error(`Cannot edit AR while post is ${row.postizStatus} — unschedule first`);
		}
		const trimmed = ar.trim();
		if (!trimmed) throw new Error("AR copy cannot be empty");
		await ctx.db.patch(id, { ar: trimmed, chars: trimmed.length });
	},
});

// Clears Postiz scheduling state on a draft. Called when the operator
// cancels a scheduled post (UI button) or when we need to retry after a
// Postiz-side failure. This does NOT cancel the post on Postiz's side —
// the caller is responsible for that (curl DELETE or Postiz dashboard).
// The draft's approval state is preserved so rescheduling is one click.
export const unschedule = mutation({
	args: { id: v.id("drafts") },
	handler: async (ctx, { id }) => {
		await requireUser(ctx);
		const row = await ctx.db.get(id);
		if (!row) throw new Error("Draft not found");
		await ctx.db.patch(id, {
			scheduled: undefined,
			publishSelection: undefined,
			publishIntegrationId: undefined,
			postizPostId: undefined,
			postizStatus: undefined,
			postizPermalink: undefined,
			postizError: undefined,
		});
	},
});

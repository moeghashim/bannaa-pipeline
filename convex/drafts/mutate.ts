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

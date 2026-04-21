import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireUser } from "../lib/requireUser";

export const reject = mutation({
	args: { id: v.id("inboxItems") },
	handler: async (ctx, { id }) => {
		await requireUser(ctx);
		const item = await ctx.db.get(id);
		if (!item) throw new Error("Item not found");
		await ctx.db.patch(id, { state: "rejected", error: undefined });
	},
});

export const reopen = mutation({
	args: { id: v.id("inboxItems") },
	handler: async (ctx, { id }) => {
		await requireUser(ctx);
		const item = await ctx.db.get(id);
		if (!item) throw new Error("Item not found");
		await ctx.db.patch(id, { state: "new", error: undefined });
	},
});

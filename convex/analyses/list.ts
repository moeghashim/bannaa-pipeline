import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireUser } from "../lib/requireUser";

export const list = query({
	args: {},
	handler: async (ctx) => {
		await requireUser(ctx);
		const rows = await ctx.db.query("analyses").collect();
		return rows.sort((a, b) => b.runAt - a.runAt);
	},
});

export const forItem = query({
	args: { itemId: v.id("inboxItems") },
	handler: async (ctx, { itemId }) => {
		await requireUser(ctx);
		const rows = await ctx.db
			.query("analyses")
			.withIndex("by_itemId", (q) => q.eq("itemId", itemId))
			.collect();
		return rows.sort((a, b) => b.runAt - a.runAt)[0] ?? null;
	},
});

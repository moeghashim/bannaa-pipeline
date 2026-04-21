import { query } from "../_generated/server";
import { requireUser } from "../lib/requireUser";

export const list = query({
	args: {},
	handler: async (ctx) => {
		await requireUser(ctx);
		const rows = await ctx.db.query("concepts").withIndex("by_name").collect();
		return rows;
	},
});

export const approved = query({
	args: {},
	handler: async (ctx) => {
		await requireUser(ctx);
		const rows = await ctx.db.query("concepts").collect();
		return rows.filter((r) => r.approved);
	},
});

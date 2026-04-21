import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireUser } from "../lib/requireUser";

export const get = query({
	args: { id: v.id("inboxItems") },
	handler: async (ctx, { id }) => {
		await requireUser(ctx);
		return await ctx.db.get(id);
	},
});

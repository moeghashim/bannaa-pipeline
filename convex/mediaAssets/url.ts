import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireUser } from "../lib/requireUser";

export const resolveUrl = query({
	args: { storageId: v.id("_storage") },
	handler: async (ctx, { storageId }): Promise<string | null> => {
		await requireUser(ctx);
		return await ctx.storage.getUrl(storageId);
	},
});

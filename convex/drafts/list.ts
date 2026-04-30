import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireUser } from "../lib/requireUser";

export const list = query({
	args: {
		channel: v.optional(
			v.union(
				v.literal("all"),
				v.literal("x"),
				v.literal("ig"),
				v.literal("ig-reel"),
				v.literal("tiktok"),
				v.literal("yt-shorts"),
				v.literal("fb-page"),
				v.literal("linkedin-page"),
			),
		),
	},
	handler: async (ctx, args) => {
		await requireUser(ctx);
		const channel = args.channel ?? "all";
		const all = await ctx.db.query("drafts").withIndex("by_createdAt").order("desc").collect();
		const rows = all.filter((r) => r.state !== "rejected");
		if (channel === "all") return rows;
		return rows.filter((r) => r.channel === channel);
	},
});

export const counts = query({
	args: {},
	handler: async (ctx) => {
		await requireUser(ctx);
		const all = await ctx.db.query("drafts").collect();
		const rows = all.filter((r) => r.state !== "rejected");
		const out: Record<string, number> = {
			total: rows.length,
			x: 0,
			ig: 0,
			"ig-reel": 0,
			tiktok: 0,
			"yt-shorts": 0,
			"fb-page": 0,
			"linkedin-page": 0,
		};
		for (const r of rows) {
			out[r.channel] = (out[r.channel] ?? 0) + 1;
		}
		return out;
	},
});

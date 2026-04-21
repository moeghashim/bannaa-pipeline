import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireUser } from "../lib/requireUser";

export const list = query({
	args: {
		state: v.optional(
			v.union(
				v.literal("all"),
				v.literal("new"),
				v.literal("analyzing"),
				v.literal("draft"),
				v.literal("approved"),
				v.literal("rejected"),
				v.literal("published"),
			),
		),
		source: v.optional(
			v.union(
				v.literal("all"),
				v.literal("x"),
				v.literal("youtube"),
				v.literal("article"),
				v.literal("manual"),
			),
		),
	},
	handler: async (ctx, args) => {
		await requireUser(ctx);
		const state = args.state ?? "all";
		const source = args.source ?? "all";

		const rows = await ctx.db.query("inboxItems").withIndex("by_captured").order("desc").collect();

		return rows.filter((r) => {
			if (state !== "all" && r.state !== state) return false;
			if (source !== "all" && r.source !== source) return false;
			return true;
		});
	},
});

export const counts = query({
	args: {},
	handler: async (ctx) => {
		await requireUser(ctx);
		const rows = await ctx.db.query("inboxItems").collect();
		const out: Record<string, number> = {
			total: rows.length,
			new: 0,
			analyzing: 0,
			draft: 0,
			approved: 0,
			rejected: 0,
			published: 0,
		};
		for (const r of rows) {
			out[r.state] = (out[r.state] ?? 0) + 1;
		}
		return out;
	},
});

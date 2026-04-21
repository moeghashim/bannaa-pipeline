import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";

const TTL_MS = 10 * 60 * 1000; // 10 minutes

export const create = internalMutation({
	args: {
		state: v.string(),
		codeVerifier: v.string(),
		userId: v.id("users"),
	},
	returns: v.id("xOauthState"),
	handler: async (ctx, args): Promise<Id<"xOauthState">> => {
		return await ctx.db.insert("xOauthState", {
			state: args.state,
			codeVerifier: args.codeVerifier,
			userId: args.userId,
			createdAt: Date.now(),
		});
	},
});

export const consume = internalQuery({
	args: { state: v.string() },
	returns: v.union(
		v.object({
			_id: v.id("xOauthState"),
			codeVerifier: v.string(),
			userId: v.id("users"),
		}),
		v.null(),
	),
	handler: async (
		ctx,
		{ state },
	): Promise<{
		_id: Id<"xOauthState">;
		codeVerifier: string;
		userId: Id<"users">;
	} | null> => {
		const row: Doc<"xOauthState"> | null = await ctx.db
			.query("xOauthState")
			.withIndex("by_state", (q) => q.eq("state", state))
			.unique();
		if (!row) return null;
		if (Date.now() - row.createdAt > TTL_MS) return null;
		return {
			_id: row._id,
			codeVerifier: row.codeVerifier,
			userId: row.userId,
		};
	},
});

export const remove = internalMutation({
	args: { state: v.string() },
	returns: v.null(),
	handler: async (ctx, { state }): Promise<null> => {
		const row = await ctx.db
			.query("xOauthState")
			.withIndex("by_state", (q) => q.eq("state", state))
			.unique();
		if (row) await ctx.db.delete(row._id);
		return null;
	},
});

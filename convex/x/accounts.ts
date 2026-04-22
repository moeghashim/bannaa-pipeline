import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { requireUser } from "../lib/requireUser";

export const upsert = internalMutation({
	args: {
		userId: v.id("users"),
		xUserId: v.string(),
		xHandle: v.string(),
		accessToken: v.string(),
		refreshToken: v.string(),
		expiresAt: v.number(),
		scope: v.string(),
	},
	returns: v.id("xAccounts"),
	handler: async (ctx, args): Promise<Id<"xAccounts">> => {
		const existing = await ctx.db
			.query("xAccounts")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.unique();
		if (existing) {
			await ctx.db.patch(existing._id, {
				xUserId: args.xUserId,
				xHandle: args.xHandle,
				accessToken: args.accessToken,
				refreshToken: args.refreshToken,
				expiresAt: args.expiresAt,
				scope: args.scope,
			});
			return existing._id;
		}
		return await ctx.db.insert("xAccounts", {
			userId: args.userId,
			xUserId: args.xUserId,
			xHandle: args.xHandle,
			accessToken: args.accessToken,
			refreshToken: args.refreshToken,
			expiresAt: args.expiresAt,
			scope: args.scope,
			connectedAt: Date.now(),
		});
	},
});

export const updateTokens = internalMutation({
	args: {
		id: v.id("xAccounts"),
		accessToken: v.string(),
		refreshToken: v.string(),
		expiresAt: v.number(),
	},
	returns: v.null(),
	handler: async (ctx, args): Promise<null> => {
		await ctx.db.patch(args.id, {
			accessToken: args.accessToken,
			refreshToken: args.refreshToken,
			expiresAt: args.expiresAt,
		});
		return null;
	},
});

export const markSynced = internalMutation({
	args: {
		id: v.id("xAccounts"),
		error: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args): Promise<null> => {
		await ctx.db.patch(args.id, {
			lastSyncAt: Date.now(),
			lastSyncError: args.error,
		});
		return null;
	},
});

export const listAll = internalQuery({
	args: {},
	returns: v.array(
		v.object({
			_id: v.id("xAccounts"),
			userId: v.id("users"),
			xUserId: v.string(),
			xHandle: v.string(),
			accessToken: v.string(),
			refreshToken: v.string(),
			expiresAt: v.number(),
			autoSync: v.optional(v.boolean()),
		}),
	),
	handler: async (
		ctx,
	): Promise<
		Array<{
			_id: Id<"xAccounts">;
			userId: Id<"users">;
			xUserId: string;
			xHandle: string;
			accessToken: string;
			refreshToken: string;
			expiresAt: number;
			autoSync?: boolean;
		}>
	> => {
		const rows: Doc<"xAccounts">[] = await ctx.db.query("xAccounts").collect();
		return rows.map((r) => ({
			_id: r._id,
			userId: r.userId,
			xUserId: r.xUserId,
			xHandle: r.xHandle,
			accessToken: r.accessToken,
			refreshToken: r.refreshToken,
			expiresAt: r.expiresAt,
			autoSync: r.autoSync,
		}));
	},
});

export const mineStatus = query({
	args: {},
	returns: v.union(
		v.object({
			connected: v.literal(true),
			xHandle: v.string(),
			connectedAt: v.number(),
			lastSyncAt: v.optional(v.number()),
			lastSyncError: v.optional(v.string()),
			autoSync: v.boolean(),
		}),
		v.object({ connected: v.literal(false) }),
	),
	handler: async (ctx) => {
		const userId = await requireUser(ctx);
		const row = await ctx.db
			.query("xAccounts")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.unique();
		if (!row) return { connected: false as const };
		return {
			connected: true as const,
			xHandle: row.xHandle,
			connectedAt: row.connectedAt,
			lastSyncAt: row.lastSyncAt,
			lastSyncError: row.lastSyncError,
			autoSync: row.autoSync !== false,
		};
	},
});

export const setAutoSync = mutation({
	args: { enabled: v.boolean() },
	returns: v.null(),
	handler: async (ctx, args): Promise<null> => {
		const userId = await requireUser(ctx);
		const row = await ctx.db
			.query("xAccounts")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.unique();
		if (!row) throw new Error("X not connected.");
		await ctx.db.patch(row._id, { autoSync: args.enabled });
		return null;
	},
});

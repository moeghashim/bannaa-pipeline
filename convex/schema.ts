import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const sourceType = v.union(
	v.literal("x"),
	v.literal("youtube"),
	v.literal("article"),
	v.literal("manual"),
);

const stateType = v.union(
	v.literal("new"),
	v.literal("analyzing"),
	v.literal("draft"),
	v.literal("approved"),
	v.literal("rejected"),
	v.literal("published"),
);

const trackType = v.union(
	v.literal("Foundations"),
	v.literal("Agents"),
	v.literal("Media"),
);

export default defineSchema({
	...authTables,

	inboxItems: defineTable({
		source: sourceType,
		handle: v.string(),
		title: v.string(),
		snippet: v.string(),
		raw: v.optional(v.string()),
		url: v.optional(v.string()),
		lang: v.union(v.literal("en"), v.literal("ar")),
		state: stateType,
		length: v.union(v.number(), v.string()),
		capturedBy: v.id("users"),
		captured: v.number(),
		error: v.optional(v.string()),
		xTweetId: v.optional(v.string()),
	})
		.index("by_state", ["state"])
		.index("by_capturedBy", ["capturedBy"])
		.index("by_captured", ["captured"])
		.index("by_xTweetId", ["xTweetId"]),

	xAccounts: defineTable({
		userId: v.id("users"),
		xUserId: v.string(),
		xHandle: v.string(),
		accessToken: v.string(),
		refreshToken: v.string(),
		expiresAt: v.number(),
		scope: v.string(),
		connectedAt: v.number(),
		lastSyncAt: v.optional(v.number()),
		lastSyncError: v.optional(v.string()),
	})
		.index("by_user", ["userId"])
		.index("by_xUserId", ["xUserId"]),

	xOauthState: defineTable({
		state: v.string(),
		codeVerifier: v.string(),
		userId: v.id("users"),
		createdAt: v.number(),
	}).index("by_state", ["state"]),

	analyses: defineTable({
		itemId: v.id("inboxItems"),
		provider: v.union(v.literal("claude"), v.literal("glm"), v.literal("openrouter")),
		runAt: v.number(),
		summary: v.string(),
		concepts: v.array(v.string()),
		keyPoints: v.array(v.string()),
		track: trackType,
		outputs: v.array(
			v.object({
				kind: v.union(v.literal("tweet"), v.literal("reel"), v.literal("website")),
				hook: v.string(),
			}),
		),
		runId: v.id("providerRuns"),
	}).index("by_itemId", ["itemId"]),

	concepts: defineTable({
		name: v.string(),
		track: trackType,
		approved: v.boolean(),
		createdAt: v.number(),
	})
		.index("by_name", ["name"])
		.index("by_track", ["track"]),

	settings: defineTable({
		key: v.string(),
		defaultProvider: v.union(v.literal("claude"), v.literal("glm"), v.literal("openrouter")),
		updatedAt: v.number(),
	}).index("by_key", ["key"]),

	providerRuns: defineTable({
		provider: v.union(v.literal("claude"), v.literal("glm"), v.literal("openrouter")),
		model: v.string(),
		purpose: v.string(),
		itemId: v.optional(v.id("inboxItems")),
		inputTokens: v.number(),
		outputTokens: v.number(),
		cost: v.number(),
		runAt: v.number(),
		error: v.optional(v.string()),
	}).index("by_runAt", ["runAt"]),
});

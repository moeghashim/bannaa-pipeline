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

const channelType = v.union(
	v.literal("x"),
	v.literal("ig"),
	v.literal("ig-reel"),
	v.literal("tiktok"),
	v.literal("yt-shorts"),
	v.literal("fb-page"),
	v.literal("linkedin-page"),
);

const mediaKindType = v.union(
	v.literal("text"),
	v.literal("single-image"),
	v.literal("carousel"),
	v.literal("video"),
);

// Union of all provider identifiers that may appear on a mediaAsset row.
// The old "hyperframes" literal was dropped alongside the satori
// compositor; legacy rows were purged by the
// `generate/image/cleanupLegacyHyperframes` one-shot migration before the
// schema narrowed, so no existing data references it.
const imageProviderType = v.union(
	v.literal("nano-banana"),
	v.literal("gpt-image"),
	v.literal("grok"),
	v.literal("ideogram"),
	v.literal("openrouter"),
);

// Settings-facing subset: only external generators can be a *default*. The
// compositor is never a default because it always composes on top of an
// already-generated base.
const imageGeneratorType = v.union(
	v.literal("nano-banana"),
	v.literal("gpt-image"),
	v.literal("grok"),
	v.literal("ideogram"),
	v.literal("openrouter"),
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
		autoSync: v.optional(v.boolean()),
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

	drafts: defineTable({
		channel: channelType,
		ar: v.string(),
		en: v.string(),
		chars: v.number(),
		state: stateType,
		analysisId: v.id("analyses"),
		sourceItemId: v.id("inboxItems"),
		concepts: v.array(v.string()),
		capturedBy: v.id("users"),
		createdAt: v.number(),
		// Unix ms the operator picked in the scheduler. Undefined until they
		// hit Schedule. Postiz owns the actual firing — we just record what
		// we sent so the UI can show "scheduled for …" until the webhook
		// flips state to `published`.
		scheduled: v.optional(v.number()),
		genRunId: v.id("providerRuns"),
		mediaKind: v.optional(mediaKindType),
		imageProvider: v.optional(imageGeneratorType),
		imageModel: v.optional(v.string()),
		// B.3 carousel: style anchor shared across all slides so a future
		// regeneration of one slide stays coherent with the rest.
		styleAnchor: v.optional(v.string()),
		// Phase C publish fields. All optional — a draft that hasn't been
		// scheduled yet has none of these set.
		//
		// `publishSelection` mirrors the base/overlay preview toggle on the
		// draft card — whichever the operator has selected when they hit
		// Schedule is what gets uploaded to Postiz. Default is "overlay"
		// when a composite exists, "base" otherwise — resolved at upload
		// time, not stored by default.
		publishSelection: v.optional(v.union(v.literal("base"), v.literal("overlay"))),
		// Postiz `integrations[].id` — which of the operator's connected
		// socials to publish through. One draft → one integration (we don't
		// fan-out a single draft to multiple socials today).
		publishIntegrationId: v.optional(v.string()),
		postizPostId: v.optional(v.string()),
		postizStatus: v.optional(
			v.union(
				v.literal("scheduled"),
				v.literal("publishing"),
				v.literal("published"),
				v.literal("failed"),
			),
		),
		postizPermalink: v.optional(v.string()),
		postizError: v.optional(v.string()),
	})
		.index("by_analysis", ["analysisId"])
		.index("by_state", ["state"])
		.index("by_channel", ["channel"])
		.index("by_createdAt", ["createdAt"])
		.index("by_postizPostId", ["postizPostId"]),

	// B.3 carousel script rows — one per slide. Kept separate from `drafts`
	// so the mediaAssets table stays generic and the per-slide AR text +
	// image prompt survive the text-vs-image-generation split.
	carouselSlides: defineTable({
		draftId: v.id("drafts"),
		orderIndex: v.number(),
		ar: v.string(),
		imagePrompt: v.string(),
		createdAt: v.number(),
	}).index("by_draft", ["draftId"]),

	mediaAssets: defineTable({
		draftId: v.id("drafts"),
		kind: v.union(v.literal("image"), v.literal("video")),
		storageId: v.optional(v.id("_storage")),
		url: v.optional(v.string()),
		prompt: v.string(),
		provider: imageProviderType,
		model: v.string(),
		state: v.union(v.literal("generating"), v.literal("ready"), v.literal("failed")),
		width: v.number(),
		height: v.number(),
		orderIndex: v.number(),
		createdAt: v.number(),
		error: v.optional(v.string()),
		genRunId: v.optional(v.id("providerRuns")),
		overlaidFrom: v.optional(v.id("mediaAssets")),
	})
		.index("by_draft", ["draftId"])
		.index("by_state", ["state"])
		.index("by_overlaidFrom", ["overlaidFrom"]),

	settings: defineTable({
		key: v.string(),
		defaultProvider: v.union(v.literal("claude"), v.literal("glm"), v.literal("openrouter")),
		defaultImageProvider: v.optional(imageGeneratorType),
		updatedAt: v.number(),
	}).index("by_key", ["key"]),

	providerRuns: defineTable({
		provider: v.union(
			v.literal("claude"),
			v.literal("glm"),
			v.literal("openrouter"),
			v.literal("nano-banana"),
			v.literal("gpt-image"),
			v.literal("grok"),
			v.literal("ideogram"),
		),
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

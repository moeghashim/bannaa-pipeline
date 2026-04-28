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

const angleType = v.union(
	v.literal("explainer"),
	v.literal("news"),
	v.literal("hot_take"),
	v.literal("use_case"),
	v.literal("debunk"),
	v.literal("tutorial"),
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

const brandRegisterType = v.union(v.literal("formal"), v.literal("casual"), v.literal("playful"));

const brandReadingLevelType = v.union(
	v.literal("beginner"),
	v.literal("intermediate"),
	v.literal("advanced"),
);

const brandEmojiPolicyType = v.union(v.literal("never"), v.literal("sparse"), v.literal("free"));

const brandToneType = v.object({
	voicePersona: v.string(),
	register: brandRegisterType,
	readingLevel: brandReadingLevelType,
	maxSentenceChars: v.number(),
	emojiPolicy: brandEmojiPolicyType,
	doPhrases: v.array(v.string()),
	dontPhrases: v.array(v.string()),
	arPresets: v.record(v.string(), v.string()),
	activeArPreset: v.string(),
	channelOverrides: v.optional(v.record(v.string(), v.string())),
});

const brandDesignType = v.object({
	palette: v.object({
		primary: v.string(),
		accent: v.string(),
		neutral: v.string(),
		background: v.string(),
		text: v.string(),
	}),
	typography: v.object({
		heading: v.string(),
		body: v.string(),
		mono: v.string(),
	}),
	logoChipText: v.string(),
	footerText: v.string(),
	footerUrl: v.string(),
	layout: v.object({
		chipPosition: v.union(v.literal("top-left"), v.literal("top-right")),
		footerPosition: v.union(v.literal("bottom-left"), v.literal("bottom-right")),
		margins: v.number(),
	}),
	imageStyleGuide: v.string(),
	bannedSubjects: v.array(v.string()),
	designMd: v.optional(v.string()),
});

const outputLanguageType = v.union(
	v.literal("en"),
	v.literal("ar-khaleeji"),
	v.literal("ar-msa"),
	v.literal("ar-levantine"),
);

const secondaryOutputLanguageType = v.union(
	v.literal("ar-khaleeji"),
	v.literal("ar-msa"),
	v.literal("ar-levantine"),
);

const translationType = v.object({
	lang: outputLanguageType,
	text: v.string(),
	chars: v.number(),
	genRunId: v.id("providerRuns"),
	createdAt: v.number(),
});

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
		provider: v.union(v.literal("claude"), v.literal("glm"), v.literal("openrouter"), v.literal("deepseek")),
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
		primary: v.string(),
		translations: v.optional(v.array(translationType)),
		chars: v.number(),
		state: stateType,
		analysisId: v.id("analyses"),
		sourceItemId: v.id("inboxItems"),
		concepts: v.array(v.string()),
		// Editorial angle picked at draft time. Carries through translation
		// so AR copy preserves the original intent (a hot_take should sound
		// opinionated in AR, an explainer should not).
		angle: v.optional(angleType),
		// Embedding of `primary` (OpenAI text-embedding-3-small, 1536 dims).
		// Used to detect near-duplicate drafts on the same channel.
		embedding: v.optional(v.array(v.float64())),
		// Set when this draft has cosine similarity >= DEDUP_THRESHOLD
		// against an earlier draft on the same channel. Surfaced in the
		// dashboard so the operator can merge or discard.
		dedupSimilarity: v.optional(v.number()),
		dedupPriorDraftId: v.optional(v.id("drafts")),
		// Rating triage layer. Total `rating` is 0-100, the sum of the
		// four dimensions in `ratingBreakdown`. Filled in asynchronously
		// after the draft is created — UI shows undefined as "pending".
		rating: v.optional(v.number()),
		ratingBreakdown: v.optional(
			v.object({
				substance: v.object({ score: v.number(), reason: v.string() }),
				hook: v.object({ score: v.number(), reason: v.string() }),
				accuracy: v.object({ score: v.number(), reason: v.string() }),
				voiceFit: v.object({ score: v.number(), reason: v.string() }),
			}),
		),
		ratingRunId: v.optional(v.id("providerRuns")),
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
		publishLang: v.optional(outputLanguageType),
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
	// so the mediaAssets table stays generic and the per-slide text +
	// image prompt survive the text-vs-image-generation split.
	carouselSlides: defineTable({
		draftId: v.id("drafts"),
		orderIndex: v.number(),
		primary: v.string(),
		translations: v.optional(v.array(translationType)),
		imagePrompt: v.string(),
		// Editorial role of this slide in the carousel arc. Optional for
		// backward compatibility with carousels generated before the role
		// taxonomy. New carousels always set it.
		role: v.optional(
			v.union(
				v.literal("hook"),
				v.literal("concept"),
				v.literal("mechanism"),
				v.literal("example"),
				v.literal("payoff"),
			),
		),
		genRunId: v.optional(v.id("providerRuns")),
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
		defaultProvider: v.union(v.literal("claude"), v.literal("glm"), v.literal("openrouter"), v.literal("deepseek")),
		defaultImageProvider: v.optional(imageGeneratorType),
		outputLanguages: v.optional(v.array(secondaryOutputLanguageType)),
		updatedAt: v.number(),
	}).index("by_key", ["key"]),

	brands: defineTable({
		name: v.string(),
		isActive: v.boolean(),
		tone: brandToneType,
		design: brandDesignType,
		version: v.number(),
		updatedAt: v.number(),
	})
		.index("by_active", ["isActive"])
		.index("by_updatedAt", ["updatedAt"]),

	brandVersions: defineTable({
		brandId: v.id("brands"),
		version: v.number(),
		tone: brandToneType,
		design: brandDesignType,
		note: v.optional(v.string()),
		publishedAt: v.number(),
	})
		.index("by_brand", ["brandId"])
		.index("by_brand_version", ["brandId", "version"])
		.index("by_publishedAt", ["publishedAt"]),

	brandPreviews: defineTable({
		brandId: v.id("brands"),
		hash: v.string(),
		storageId: v.id("_storage"),
		createdAt: v.number(),
	})
		.index("by_brand_hash", ["brandId", "hash"])
		.index("by_createdAt", ["createdAt"]),

	feedback: defineTable({
		targetKind: v.union(v.literal("draft"), v.literal("mediaAsset"), v.literal("carouselSlide")),
		targetId: v.string(),
		draftId: v.id("drafts"),
		rating: v.union(v.literal("up"), v.literal("down"), v.literal("neutral")),
		tags: v.array(v.string()),
		note: v.optional(v.string()),
		authorId: v.id("users"),
		createdAt: v.number(),
		brandVersion: v.optional(v.number()),
		promptVersion: v.optional(v.string()),
		provider: v.string(),
		model: v.string(),
		runId: v.id("providerRuns"),
		priorRunId: v.optional(v.id("providerRuns")),
	})
		.index("by_target", ["targetKind", "targetId"])
		.index("by_draft", ["draftId"])
		.index("by_tag", ["tags"])
		.index("by_runId", ["runId"]),

	providerRuns: defineTable({
		provider: v.union(
			v.literal("claude"),
			v.literal("glm"),
			v.literal("openrouter"),
			v.literal("deepseek"),
			v.literal("nano-banana"),
			v.literal("gpt-image"),
			v.literal("grok"),
			v.literal("ideogram"),
			v.literal("openai-embedding"),
		),
		model: v.string(),
		purpose: v.string(),
		itemId: v.optional(v.id("inboxItems")),
		inputTokens: v.number(),
		outputTokens: v.number(),
		cost: v.number(),
		runAt: v.number(),
		error: v.optional(v.string()),
		brandVersion: v.optional(v.number()),
		promptVersion: v.optional(v.string()),
	}).index("by_runAt", ["runAt"]),
});

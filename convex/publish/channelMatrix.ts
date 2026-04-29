// Channel → Postiz provider + capability matrix (Phase C).
//
// Our internal channel union has 7 values but they don't map 1:1 to Postiz
// providers — IG feed and IG Reels both ride the same Postiz integration
// with different payload flags, and TikTok can accept either video OR a
// Photo-Mode slideshow depending on what media we have.
//
// This module is the single source of truth for:
//   • which Postiz provider slug to put in the POST /posts body
//   • whether a draft's media kind is publishable on that channel today
//   • the per-provider `settings` object Postiz's body expects (e.g.
//     `postType: "reel"` for IG Reels vs. feed carousel)
//
// Kept in the **V8 runtime** (no "use node") so it can be imported from
// both the publish action (Node) and queries/UI (V8).

type InternalChannel = "x" | "ig" | "ig-reel" | "tiktok" | "yt-shorts" | "fb-page" | "linkedin-page";
type InternalMediaKind = "text" | "single-image" | "carousel" | "video";

export type PublishCheck =
	| { ok: true; postizProvider: string; settings: Record<string, unknown> }
	| { ok: false; reason: string };

// `provider` column is the slug Postiz's public API expects on the body's
// `integration` object (empirically `x`, `instagram`, `tiktok`, `youtube`,
// `facebook`, `linkedin`). If these drift we'll see a 400 "unknown provider"
// from /posts and can re-map.
export function resolvePublishTarget(
	channel: InternalChannel,
	mediaKind: InternalMediaKind,
): PublishCheck {
	switch (channel) {
		case "x":
			return {
				ok: true,
				postizProvider: "x",
				// `who_can_reply_post` is required by Postiz's X provider —
				// one of everyone / following / mentionedUsers / subscribers
				// / verified. Default to `everyone` for normal reach.
				settings: { who_can_reply_post: "everyone" },
			};
		case "ig": {
			if (mediaKind === "carousel") {
				return { ok: true, postizProvider: "instagram", settings: { post_type: "post" } };
			}
			if (mediaKind === "single-image") {
				return { ok: true, postizProvider: "instagram", settings: { post_type: "post" } };
			}
			return { ok: false, reason: "IG feed needs an image or carousel" };
		}
		case "ig-reel":
			// Meta Graph API requires a video resource for Reels; a carousel
			// going to the Reels surface is rejected at Postiz's provider
			// layer. The operator should promote to IG feed instead.
			return {
				ok: false,
				reason: "IG Reels requires video — promote this as an IG feed post instead for now",
			};
		case "tiktok": {
			// TikTok Photo Mode accepts an image carousel as a first-class
			// slideshow post. Single-image also works (renders as a 1-slide
			// Photo Mode). Postiz's TikTok provider dispatches on media kind
			// — we just pass a hint.
			if (mediaKind === "carousel" || mediaKind === "single-image") {
				return {
					ok: true,
					postizProvider: "tiktok",
					settings: { content_posting_method: "DIRECT_POST", post_type: "photo" },
				};
			}
			return { ok: false, reason: "TikTok needs an image, carousel, or video" };
		}
		case "yt-shorts":
			// YouTube Shorts requires vertical video; no image-only equivalent
			// on YouTube. YT Community posts accept images but are a separate
			// surface we don't model today.
			return { ok: false, reason: "YT Shorts requires video — not yet supported" };
		case "fb-page":
			if (mediaKind === "carousel" || mediaKind === "single-image" || mediaKind === "text") {
				return { ok: true, postizProvider: "facebook", settings: {} };
			}
			return { ok: false, reason: "FB Page can't publish this media kind" };
		case "linkedin-page":
			if (mediaKind === "carousel" || mediaKind === "single-image" || mediaKind === "text") {
				return { ok: true, postizProvider: "linkedin", settings: {} };
			}
			return { ok: false, reason: "LinkedIn Page can't publish this media kind" };
	}
}

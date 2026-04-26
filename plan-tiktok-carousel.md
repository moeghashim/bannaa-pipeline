# Plan — Image carousel to TikTok

Add TikTok Photo-Mode carousel as a first-class output of the existing carousel pipeline. **The publish path is already TikTok-carousel-ready** (`convex/publish/channelMatrix.ts:59-72` returns `postizProvider: "tiktok"`, `post_type: "photo"`, `content_posting_method: "DIRECT_POST"` for `("tiktok", "carousel")`). Everything missing is upstream: generation hardcodes IG, prompts say "Instagram", images bake at 1080×1080 square.

- Repo: `bannaa-pipeline`
- Convex dev deployment: `shiny-hare-202`
- Files referenced below are repo-relative
- Postiz key already in env; no new auth needed

---

## Current coupling

**Carousel generation hardcodes IG.**
- `convex/generate/carouselInternal.ts:50` inserts new draft with `channel: "ig"` — no parameter.
- `convex/generate/carouselPrompts.ts:7` system prompt opens with "Instagram feed carousel"; tool schema's `channelPrimary` is bounded 150–400 chars (IG caption range, line ~60).
- `convex/generate/carousel.ts:fromAnalysis` action exposes no `channel` arg to operators.

**Image generation is square-locked for carousels.**
- `convex/generate/image/carouselAction.ts:45` hard-codes `"Square 1024x1024 composition."` regardless of channel.
- `convex/generate/image/bakedCarouselAction.ts:40` hard-codes `"Square 1080x1080 composition."`.
- `convex/generate/image/prompts.ts:12` `aspectHint(channel)` already returns `"9:16"` for video channels (TikTok included via `VIDEO_CHANNEL` set at line 6) — but carousel paths don't call it. Single-image baking does.
- `convex/generate/image/internal.ts:52-53` records `width: 1024, height: 1024` on every `mediaAsset` row from the carousel path.

**Drafts UI surfaces no carousel-channel picker.**
- `apps/web/app/_components/views/draftsCarousel.tsx` renders 160×160 square thumbnails — no aspect awareness.
- `apps/web/app/_components/views/drafts.tsx:149` `isCarousel = mediaKind === "carousel"` is the only carousel branch; `DraftCard` doesn't differentiate IG carousel vs TikTok carousel.
- The Promote-to-carousel button in Analyses → carousel pipeline has no channel argument.

**TikTok Photo Mode is fully wired downstream.**
- `convex/publish/postiz.ts:35` lists `"tiktok"` as a Postiz provider.
- `convex/publish/channelMatrix.ts:59-72` returns `ok` for `("tiktok", "carousel")` — the publish action will succeed today if a `("tiktok", "carousel")` draft existed.
- `apps/web/app/_components/views/draftsScheduler.tsx:20` already maps `tiktok → tiktok` for integration filtering.
- Brand voice override for TikTok exists: `convex/brand/defaults.ts:12` "Native short-video voice. Direct address."

---

## Target model

A carousel is **a sequence of N portrait or square slides + per-slide on-image text + caption**, parameterized by target channel. One generation run per target channel (no auto-fan-out v1 — operator picks IG **or** TikTok at promote time). Aspect, slide count bounds, caption length, and bake template all flow from the channel.

| Channel | Aspect | Slides | Caption chars | Bake template |
|---|---|---|---|---|
| `ig` (today) | 1:1 (1080×1080) | 3–5 | 150–400 | square IG chrome |
| `tiktok` (new) | 9:16 (1080×1920) | 3–10 | 80–300 | portrait Photo-Mode chrome |

TikTok Photo Mode allows up to 35 photos; we cap at 10 for cost + operator-review sanity. Square also publishes to TikTok cleanly — but 9:16 is the native feed aspect and what we should generate by default.

---

## Schema changes (`convex/schema.ts`)

Minimal — the carousel schema is already channel-agnostic at storage level. Two precise touches:

1. **`drafts.channel`** — already `union(...all 7 channels)`. No change.
2. **`carouselSlides`** — no change. Per-slide rows are channel-neutral.
3. **`mediaAssets`** — `width`/`height` already optional. Carousel path needs to start writing the **actual** generated dimensions instead of always 1024×1024 (`convex/generate/image/internal.ts:52-53`).
4. **No new tables.**

Brand-versioning continues unchanged: `providerRuns.brandVersion` is already populated by the existing carousel-generation path.

---

## Prompt changes

### `convex/generate/carouselPrompts.ts`

Replace the IG-hardcoded system prompt + tool with channel-parameterized factories. Bump `PROMPT_VERSION`.

```ts
export function buildCarouselPrompt(input: {
  channel: "ig" | "tiktok";
  brand: Brand;
  analysis: Doc<"analyses">;
}): { system: string; tool: Tool; promptVersion: string }
```

Two surface-level diffs vs. today:

- **System prompt opener** — `"Instagram feed carousel"` → `"{channelLabel} carousel"` where `channelLabel ∈ {"Instagram feed", "TikTok Photo Mode"}`.
- **`channelPrimary` length bounds** — IG: 150–400 (today). TikTok: 80–300 (mirrors existing TikTok caption brief at `convex/generate/prompts.ts:94-98`).
- **Slide count bounds** — IG: 3–5 (today). TikTok: 3–10.
- **`styleAnchor`** — language-neutral, channel-neutral; unchanged contract. The aspect hint moves down to the per-slide image stage.

Per-channel guidance prepended from `brand.tone.channelOverrides[channel]` (already wired for non-carousel paths via Feature 2).

### `convex/generate/image/carouselAction.ts` + `bakedCarouselAction.ts`

Both grow a `channel` arg.

- `carouselAction.ts:45` — `"Square 1024x1024 composition."` becomes:
  - `"Square 1024x1024 composition."` for IG.
  - `"Vertical 1024x1792 composition (9:16 portrait)."` for TikTok. (gpt-image-2 native portrait size; we render at 1024×1792 then bake at 1080×1920.)
- `bakedCarouselAction.ts:40` — `"Square 1080x1080 composition."` becomes per-channel; portrait template moves chip + footer to layout-config positions but at 9:16 dimensions.
- `convex/generate/image/internal.ts:52-53` — write the actual width/height passed in, not the constants.
- The "negative space for overlay" clause stays; the safe-area math changes per aspect (TikTok has top + bottom UI overlays — leave 14% top, 22% bottom clear).

`PROMPT_VERSION` bumps in both files.

### `convex/generate/image/providers.ts`

The OpenAI image provider already accepts `size` per call (`providers.ts:116, 226`). Add `1024x1792` as an allowed size; thread it from carousel actions. Replicate uses `aspect_ratio` (line 183) — pass `"9:16"` for TikTok.

---

## Backend changes

### `convex/generate/carousel.ts:fromAnalysis`

Add `channel: v.union(v.literal("ig"), v.literal("tiktok"))` to args; default `"ig"` for backward compat. Forward to `carouselInternal.create` and `buildCarouselPrompt`.

### `convex/generate/carouselInternal.ts:50`

`channel: "ig"` → `channel: args.channel`. Slide-count clamp moves from a hard `[3, 5]` to a per-channel range.

### `convex/publish/scheduleDraft.ts`

No change needed — already loops media by `orderIndex`, already calls `resolvePublishTarget(channel, mediaKind)`, already handles TikTok carousel response shape. Worth adding **one integration test** that mocks Postiz and asserts the payload for `("tiktok", "carousel")` matches what's on the wire today.

### `convex/feedback/regenerate.ts`

Carousel regen-with-feedback already exists. Confirm it preserves `channel` when re-running a TikTok carousel (it should — the mutation reads the existing draft).

---

## UI changes

### `apps/web/app/_components/views/analyses.tsx`

Promote-to-carousel button → split into a small dropdown: **"Carousel → IG"** / **"Carousel → TikTok"**. Or single "Carousel" button that opens a channel picker popover. Calls `api.generate.carousel.fromAnalysis` with the picked channel.

### `apps/web/app/_components/views/draftsCarousel.tsx`

Thumbnail strip becomes aspect-aware: read `draft.channel` and render thumbs as 90×160 (9:16) for TikTok, 160×160 (1:1) for IG. Status label ("3/5 base ready") works as-is.

### `apps/web/app/_components/views/drafts.tsx`

`DraftCard` already shows the channel chip — no change. Carousel section just needs to pass channel to `CarouselStrip`.

### `apps/web/app/_components/views/draftsScheduler.tsx`

No change. Already filters integrations by `CHANNEL_TO_POSTIZ[channel]` and `tiktok → tiktok` mapping is in place.

### Optional: cross-post helper

A "Duplicate as TikTok carousel" button on an approved IG carousel. Clones the draft with `channel = "tiktok"`, **regenerates only the captions** (TikTok length bounds), and **re-bakes the slides at 9:16** (image content can be reused if we crop / re-letterbox; cleaner to re-render). Tag this as v1.1.

---

## Migration

- **None.** Existing IG carousels keep their `channel: "ig"`. New schema fields = zero. Aspect is read from channel, not from a stored field.
- **Backfill `mediaAssets.width`/`height`?** Optional cleanup commit to write the true 1080×1080 onto historical rows; cosmetic only.

---

## Open questions

1. **Auto fan-out IG → TikTok?** I.e. when operator promotes-to-carousel, generate **both** an IG variant and a TikTok variant in one click. Higher cost, less control. Proposal: skip in v1, add as a follow-up after measuring TikTok approval rate via the feedback loop.
2. **TikTok hashtag / sticker / sound metadata.** Postiz's TikTok Photo Mode supports `description`, `disable_comment`, `disable_duet`, `disable_stitch`, `auto_add_music`. Default: `auto_add_music: true` (TikTok's algorithm preference) and all three `disable_*: false`. Surface as advanced toggles in the scheduler popover later.
3. **Carousel cap.** TikTok allows 35 photos; our internal cap of 10 is a generation-cost guardrail, not a platform limit. Revisit once we see operator demand.
4. **Reuse vs re-render images for cross-post.** A 1080×1080 IG image upscaled to 1080×1920 looks bad (letterbox or crop). Default to re-render.
5. **Bake-text Arabic on portrait 9:16.** The existing baked template positions the AR chip top-left and footer bottom-right with `margin: 48`. Same positions on portrait should be fine but need a visual sanity check before shipping.

---

## Sequencing & sizing

| Step | Scope | Size |
|---|---|---|
| 1 | Schema-free backend: parameterize `channel` in `fromAnalysis` + `carouselInternal.create`; channel-aware prompt factory; TikTok caption length bounds | 0.5 day |
| 2 | Image gen: 9:16 size threading through `providers.ts`, `carouselAction.ts`, `bakedCarouselAction.ts`; correct `mediaAssets.width/height` | 1 day |
| 3 | UI: Promote-to-carousel channel picker on Analyses; aspect-aware thumb strip in `draftsCarousel.tsx` | 0.5 day |
| 4 | One integration test exercising `("tiktok", "carousel")` end-to-end through `scheduleDraft.ts` (Postiz mocked) | 0.5 day |
| 5 | ADR + `progress.md` entry + prompt-version bumps | 0.25 day |

**Total: ~2.5–3 days, one PR.** No new env vars, no Convex migration, no Postiz changes.

### Cross-cutting

- Bump `PROMPT_VERSION` in `convex/generate/carouselPrompts.ts`, `convex/generate/image/carouselPrompts.ts` (per-slide), and the carousel bake prompt — caught by `scripts/check-prompt-versions.mjs`.
- Add `docs/adr-tiktok-carousel.md` (one decision: per-channel carousel parameterization vs separate carousel pipeline per platform).
- Append a summary to `progress.md` at PR merge via `npm run commit:with-progress`.
- Watch the file-length cap (600 lines) — `carouselPrompts.ts` is the closest to the limit; move the channel matrix into a `carouselChannels.ts` if needed.

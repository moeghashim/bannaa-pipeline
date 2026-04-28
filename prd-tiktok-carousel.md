# PRD — Image Carousel to TikTok (Photo Mode)

**Status:** Draft v1
**Author:** Moe Ghashim (`moe@bannaa.co`)
**Last updated:** 2026-04-26
**Target audience:** Junior developer implementing the feature
**Related docs:** [plan-tiktok-carousel.md](plan-tiktok-carousel.md) (technical plan), [docs/adr-tiktok-carousel.md](docs/adr-tiktok-carousel.md) (architecture decision), [prd.md](prd.md) (prior batch — EN-first / Brand / Feedback)

---

## 1. Introduction / Overview

`bannaa-pipeline`'s carousel pipeline today produces **Instagram feed carousels only**: 3–5 square (1080×1080) slides with a 150–400 character English caption. Operator clicks "Promote → Carousel" on an analysis and a draft is generated, slides are baked, and the operator approves and schedules through Postiz.

The same operator wants to publish to **TikTok Photo Mode** — TikTok's native multi-image carousel surface — but the pipeline cannot generate a TikTok-targeted carousel. Three things block it:

1. `convex/generate/carouselInternal.ts:50` hardcodes `channel: "ig"` on the inserted draft. Carousels can never be created with `channel: "tiktok"`.
2. `convex/generate/carouselPrompts.ts:7` opens with "Instagram feed carousel" and bounds the caption at 150–400 characters — wrong for TikTok (80–300 char native range).
3. `convex/generate/image/carouselAction.ts:45` and `bakedCarouselAction.ts:40` lock images at 1024×1024 / 1080×1080 square. TikTok feed is 9:16; a square carousel on TikTok looks like an Instagram cross-post.

**Crucially, the publish path is already TikTok-carousel-ready.** `convex/publish/channelMatrix.ts:59-72` returns `postizProvider: "tiktok"`, `post_type: "photo"`, `content_posting_method: "DIRECT_POST"` for `("tiktok", "carousel")`. The Postiz client (`convex/publish/postiz.ts:35`) already lists TikTok. The scheduler popover (`apps/web/app/_components/views/draftsScheduler.tsx:20`) already maps `tiktok → tiktok`. Brand has a TikTok voice override (`convex/brand/defaults.ts:12`). The entire downstream is wired — the feature is purely about lifting the IG hardcoding from carousel **generation**.

This PRD defines the feature as a single shippable PR.

### Problem being solved
- TikTok is the operator's largest reach surface for AI-education content. The pipeline can produce TikTok text drafts but cannot produce TikTok carousels — a major content type missing.
- IG carousels manually re-uploaded to TikTok render at 1:1 with letterboxing, look like cross-posts, and underperform.
- Operator currently re-runs carousel generation, re-edits captions for TikTok length, and manually re-bakes images at 9:16 in another tool — a workflow break.

### Goal
One click: "Promote → Carousel → TikTok" produces a 3–10 slide 9:16 carousel with TikTok-tuned caption, baked at the right aspect, ready to schedule via the existing Postiz integration. No schema migration, no new env vars, no Postiz changes.

---

## 2. Goals

1. **G1 — TikTok-native carousels.** Carousel generation accepts `channel: "tiktok"` and produces 9:16 portrait slides (1080×1920 final) with TikTok-tuned caption length (80–300 chars) and slide count (3–10).
2. **G2 — IG behavior unchanged.** Existing IG carousel pipeline produces byte-identical output for byte-identical input (same seed, brand, analysis). Verified by regression test before merge.
3. **G3 — One-click promote.** Operator picks the channel at promote time on the Analyses tab. No hidden flags, no env-var gating.
4. **G4 — End-to-end publish.** A `("tiktok", "carousel")` draft can be approved and scheduled through the existing Postiz scheduler popover with no new code in the publish path.
5. **G5 — Measurable usage.** Within 4 weeks of merge, **at least 30%** of all generated carousels target TikTok (vs. IG), measured by `count(drafts where mediaKind = "carousel" AND channel = "tiktok")` / total carousel drafts over a 7-day rolling window.

---

## 3. User Stories

All stories are from the single-operator perspective (`moe@bannaa.co`).

- **US-1:** As the operator, on an analysis card I see the existing "Carousel" promote button replaced by **two** buttons or a small dropdown: "Carousel → IG" and "Carousel → TikTok", so I pick the target before tokens are spent.
- **US-2:** As the operator, when I click "Carousel → TikTok", a draft is created with `channel: "tiktok"`, `mediaKind: "carousel"`, 3–10 slides, and a TikTok-length caption (80–300 chars) generated in the same flow as today's IG carousel.
- **US-3:** As the operator, in the Drafts view a TikTok carousel renders thumbnails at **9:16 portrait aspect** (e.g., 90×160 px), so I see the publish-true preview without opening individual slides.
- **US-4:** As the operator, I can approve a TikTok carousel and schedule it through the same Postiz scheduler popover I use for IG. The popover only lists TikTok integrations (existing channel filter behavior) and the publish lands as a Photo-Mode post.
- **US-5:** As the operator, the brand's TikTok channel-override tone (`brand.tone.channelOverrides["tiktok"]`) is applied to the caption, so the TikTok carousel reads in TikTok voice — not the IG voice — without any extra clicks.
- **US-6:** As the operator, regenerating a TikTok carousel with feedback (👎 → 🔁) preserves `channel: "tiktok"` so the regen stays TikTok-tuned.

---

## 4. Functional Requirements

Each requirement is implementation-ready. A junior developer can build directly from these.

### 4.1 — Carousel generation accepts a target channel

1. **`convex/generate/carousel.ts:fromAnalysis`** must accept a new args field `channel: v.union(v.literal("ig"), v.literal("tiktok"))`. When omitted, default to `"ig"` for backward compat with any existing callers. Forward `channel` to `internal.generate.carouselInternal.create` and `buildCarouselPrompt`.
2. **`convex/generate/carouselInternal.ts:50`** — replace the hardcoded `channel: "ig"` with `channel: args.channel`. The internal mutation's args validator must add `channel: v.union(v.literal("ig"), v.literal("tiktok"))`.
3. **Slide count clamp** in `carouselInternal.ts` must read from a `CAROUSEL_LIMITS` lookup (new, in `convex/generate/carouselPrompts.ts`):
   ```ts
   export const CAROUSEL_LIMITS = {
     ig:     { minSlides: 3, maxSlides: 5,  minCaption: 150, maxCaption: 400 },
     tiktok: { minSlides: 3, maxSlides: 10, minCaption: 80,  maxCaption: 300 },
   } as const;
   ```
   The previous hard `[3, 5]` clamp is replaced by `CAROUSEL_LIMITS[channel]`.

### 4.2 — Carousel prompt is channel-parameterized

4. **`convex/generate/carouselPrompts.ts`** must replace `CAROUSEL_SYSTEM_PROMPT` (hardcoded "Instagram feed carousel") with a factory `buildCarouselSystemPrompt(channel: "ig" | "tiktok"): string`. The opener becomes "Generate a {Instagram feed | TikTok Photo Mode} carousel from this analysis." The rest of the prompt (style anchor, per-slide on-image text, language-neutral framing) stays identical.
5. **`buildCarouselPrompt(input)`** must accept `channel: "ig" | "tiktok"` and pass it to `buildCarouselSystemPrompt` and the tool schema. The tool schema's `channelPrimary` `minLength` and `maxLength` must read from `CAROUSEL_LIMITS[channel].{minCaption, maxCaption}`. The slides array's `minItems`/`maxItems` must read from `CAROUSEL_LIMITS[channel].{minSlides, maxSlides}`.
6. **Per-channel tone** must be prepended to the system prompt via `brand.tone.channelOverrides[channel]` (existing pattern from `convex/generate/brandPrompt.ts`). The TikTok channel override seed value already exists (`convex/brand/defaults.ts:12` — "Native short-video voice. Direct address. Set up the hook quickly.").
7. **`PROMPT_VERSION`** in `convex/generate/carouselPrompts.ts` must be bumped (next letter in today's date, e.g. `"2026-04-26-a"`). The `scripts/check-prompt-versions.mjs` lint will warn if this is forgotten.

### 4.3 — Carousel image generation is aspect-aware

8. **`convex/generate/image/carouselAction.ts`** must accept `channel: "ig" | "tiktok"` (passed from `carouselInternal` when scheduling per-slide image actions) and use it to:
   - Replace `"Square 1024x1024 composition."` (line 45) with `"Vertical 1024x1792 composition (9:16 portrait)."` when `channel === "tiktok"`.
   - Pass the right `size` string (`"1024x1024"` for IG, `"1024x1792"` for TikTok) to the OpenAI provider.
   - Pass the right aspect (`"1:1"` or `"9:16"`) to the Replicate provider via `aspect_ratio`.
9. **`convex/generate/image/bakedCarouselAction.ts`** must accept `channel` and:
   - Replace `"Square 1080x1080 composition."` (line 40) with `"Vertical 1080x1920 composition (9:16 portrait)."` for TikTok.
   - Reserve **safe-area margins** in the prompt so the chip and footer don't collide with TikTok's UI overlays: leave **14% of the height clear at the top** and **22% clear at the bottom**. For IG keep current safe-area behavior unchanged.
   - The chip and footer are still placed per `brand.design.layout.chipPosition` / `footerPosition` / `margins`; the safe-area numbers above are additive constraints in the prompt text only, not changes to the layout config.
10. **`convex/generate/image/providers.ts`** must accept `"1024x1792"` as an allowed `size` for the OpenAI image provider. Add it to whatever validator/enum gates the size parameter (lines 116, 226). Replicate's `aspect_ratio` already supports `"9:16"`; verify with one live call before merge.
11. **`convex/generate/image/internal.ts`** must record the **actual** generated `width`/`height` on the `mediaAssets` row instead of always `width: 1024, height: 1024` (lines 52-53). Source the dimensions from the action call's size argument.
12. **`PROMPT_VERSION`** in `convex/generate/image/carouselAction.ts` and `bakedCarouselAction.ts` must be bumped.

### 4.4 — Dashboard surfaces the channel choice

13. **`apps/web/app/_components/views/analyses.tsx`** — the existing single "Promote to Carousel" button must become a small dropdown or split-button labeled **"Carousel ▾"** with two items: **"→ Instagram"** and **"→ TikTok"**. Selecting either calls `api.generate.carousel.fromAnalysis` with the corresponding `channel`. No other Promote buttons change.
14. **`apps/web/app/_components/views/draftsCarousel.tsx`** — the thumbnail strip must read `draft.channel` and render thumbs at:
    - **160×160 px** when `channel === "ig"` (today's behavior, unchanged)
    - **90×160 px** when `channel === "tiktok"` (9:16 portrait)
    Aspect is the only change; status labels, slot ordering, base/overlay toggle behavior all stay identical.
15. **`apps/web/app/_components/views/drafts.tsx:DraftCard`** must pass `draft.channel` into `CarouselStrip` so step 14 can read it. The channel chip shown on every `DraftCard` already renders correctly for `"tiktok"` — no change there.
16. **`apps/web/app/_components/views/draftsScheduler.tsx`** — no change. Channel-to-Postiz mapping (`tiktok → tiktok`) is already in place at line 20. Verify by clicking through the scheduler popover on a TikTok carousel before merge.

### 4.5 — Feedback regeneration preserves channel

17. **`convex/feedback/regenerate.ts`** — verify (and add a test for) the path that regenerates a carousel with feedback. The mutation reads the existing draft and must pass the existing `draft.channel` back into `fromAnalysis` (or the equivalent regen action) so a TikTok carousel regens as TikTok, not IG. If the current code does not propagate `channel`, fix it.

### 4.6 — Cross-cutting

18. **One integration test** must be added to `convex/test/` (uses the existing `convex-test` scaffold from PR-3 of the prior batch) that exercises the full path for `("tiktok", "carousel")`:
    - Call `api.generate.carousel.fromAnalysis` with `channel: "tiktok"` and a fixture analysis.
    - Assert the resulting draft has `channel: "tiktok"`, `mediaKind: "carousel"`, and a caption length in `[80, 300]`.
    - Mock Postiz HTTP. Call `api.publish.scheduleDraft.run` with the draft id.
    - Assert the mocked Postiz `POST /posts` body has `integration.providerIdentifier === "tiktok"`, `posts[0].settings.post_type === "photo"`, `posts[0].settings.content_posting_method === "DIRECT_POST"`, and `posts[0].value[0].image.length` ∈ `[3, 10]`.
19. **One regression test** must assert `("ig", "carousel")` end-to-end produces unchanged output: same caption length range (150–400), same slide count range (3–5), same `width: 1024, height: 1024` (this last assertion fails today and will pass after §4.3.11 — that's expected; update the IG fixture if the test snapshots dimensions).
20. **`docs/adr-tiktok-carousel.md`** is already merged. No new ADR required.
21. **`progress.md`** must gain an entry on PR merge via `npm run commit:with-progress`.

---

## 5. Non-Goals (Out of Scope)

For v1 of this feature, the following are explicitly **not** included:

- **N-1. Auto fan-out (one click → both IG and TikTok carousels).** Operator picks one channel per promote. Reasoning: doubles cost, removes per-channel control, premature without feedback-loop signal on TikTok performance. Defer until §8 metrics show demand.
- **N-2. Reusing IG slide images for TikTok.** A 1080×1080 IG image cropped or letterboxed to 1080×1920 looks amateur. TikTok carousels generate fresh at 9:16. The "Duplicate as TikTok carousel" button is **not** in v1.
- **N-3. TikTok video.** TikTok's video surface (15s–10min) is outside this feature. `yt-shorts` and `ig-reel` remain video-only and remain unchanged.
- **N-4. TikTok-specific Photo-Mode toggles.** Postiz supports `disable_comment`, `disable_duet`, `disable_stitch`, `auto_add_music`, `description` overrides. v1 ships with sensible defaults (all defaults from Postiz; `auto_add_music: true` if Postiz exposes it and defaults differ). Operator-facing toggles in the scheduler popover are a follow-up.
- **N-5. Slide count above 10.** TikTok allows 35 photos; we cap at 10 as a generation-cost guardrail. Revisit after operator demand surfaces in feedback rollups.
- **N-6. Aspect picker.** v1 ships TikTok carousels at 9:16 only. No UI for operator to choose 1:1 or 4:5 on a per-draft basis.
- **N-7. Re-baking of historical IG carousels for TikTok.** Existing `("ig", "carousel")` drafts stay IG-only. No backfill, no re-render. Operator generates a fresh TikTok carousel from the same analysis if they want one.
- **N-8. New env vars or Postiz integration changes.** Existing `POSTIZ_API_KEY` and `tiktok` provider on the operator's Postiz account are sufficient. Documenting the operator's Postiz TikTok account setup is part of onboarding, not this PR.
- **N-9. New language support.** Carousel translations (EN → AR-Khaleeji etc.) work the same way for TikTok as they do for IG, via the existing `convex/generate/translate.ts` flow. No new language plumbing.

---

## 6. Design Considerations

### Promote button on Analyses
- Today the "Carousel" promote action is one button in the row of channel-chip promote actions on each analysis card.
- v1 replaces it with a **small dropdown** anchored to the existing button: clicking "Carousel" opens a 2-item menu (`→ Instagram` / `→ TikTok`). Use the existing dropdown primitive in `apps/web/app/_components/primitives.tsx` (the same one used by the language-switcher in Drafts cards).
- Keyboard shortcut for promote-to-TikTok-carousel: not in v1.

### Carousel thumbnail strip in Drafts
- IG: 160×160 px thumbs (today).
- TikTok: 90×160 px thumbs (9:16). Same gap, same status overlays, same base/overlay toggle.
- Empty/loading slot placeholder must respect aspect (draws the right outline).

### Channel chip on DraftCard
- Already renders `tiktok` correctly via `apps/web/app/_components/icons.tsx`. Verify the chip's accent color is distinct from `ig`'s (it is — different brand colors per channel in `globals.css`).

### Scheduler popover
- No visual change. The existing integration filter only shows TikTok integrations when `draft.channel === "tiktok"`. Confirm this is true on a real TikTok carousel before merge.

### Brand tab impact
- The Brand tab's carousel preview (in `convex/brand/preview.ts` and `apps/web/app/_components/views/brandPreviews.tsx`) currently previews **IG-style square** baked images. v1 does **not** require adding a TikTok carousel preview to Brand tab. If trivial, add a channel toggle to the preview row; otherwise defer to v1.1.

### No Figma mockups
- UI follows existing dashboard conventions in `apps/web/app/_components/primitives.tsx` and the views in `apps/web/app/_components/views/`.

---

## 7. Technical Considerations

### Stack
- **Convex** (deployment: `shiny-hare-202`): all backend changes — carousel generation, image actions, prompts.
- **Next.js 16** in `apps/web`: dropdown on Analyses, aspect-aware thumb strip in Drafts.
- **Node 24** (pinned in `.nvmrc`).

### Key constraints (carry over from prior PRD)
- **No direct `useEffect` in `apps/web`** — use `useMountEffect`.
- **Relative imports must not have `.js` extensions.**
- **No `"use node"` on files imported by `convex/http.ts`.** The carousel prompt factory and `CAROUSEL_LIMITS` stay V8-safe. Image actions remain `"use node"` as today.
- **600-line file cap** enforced by `scripts/check-file-length.mjs`. `carouselPrompts.ts` is the file closest to the cap; if `buildCarouselSystemPrompt(channel)` + `CAROUSEL_LIMITS` push it over, split the per-channel constants into `convex/generate/carouselChannels.ts`.
- **Biome formatting:** tabs, indentWidth 3, lineWidth 120.
- **Pre-commit hook (Husky):** runs `npm run check`.
- **Prompt version lint warns (does not block)** — but for this PR, prompt versions **must** be bumped because the prompt content materially changes.

### Dependencies
- No new npm dependencies.
- gpt-image-2 already supports `1024x1792`; no API change.
- Replicate's `aspect_ratio: "9:16"` already supported by the existing model (verify with one live call during implementation).

### Schema
- **No schema changes.** `drafts.channel` already accepts `"tiktok"`. `drafts.mediaKind` already accepts `"carousel"`. `mediaAssets.width`/`height` are already optional. `carouselSlides` is channel-neutral.
- **No migration.** Historical `("ig", "carousel")` drafts keep `channel: "ig"`. New TikTok carousels are net-new rows.

### Brand-version recording
- `providerRuns.brandVersion` continues to be populated by the existing carousel-generation path. No change.
- `providerRuns.promptVersion` reflects the bumped prompt versions from §4.2.7 and §4.3.12. No new code — the existing recording in `convex/generate/internal.ts` reads the `VERSION` constant.

### Postiz payload shape — verify before merge
- `convex/publish/postiz.ts:177-189` builds `posts[0].value[0] = {content: text, image: [...]}`. For TikTok Photo Mode, confirm with one **manual test post to a Postiz sandbox account** that this shape works. Postiz's TikTok provider documentation is sparse; the manual test is cheaper than guessing.
- If Postiz rejects, the most likely fix is wrapping the image array under a `slideshow` or `photos` key on `posts[0].value[0]`. Document the actual key in `convex/publish/postiz.ts` with a comment citing the Postiz API response.

### Testing
- Add tests under `convex/test/` per §4.6.18 and §4.6.19. Use the `convex-test` scaffold introduced in the prior PRD's PR-1.
- UI changes verified by `npm run dev -w @bannaa-pipeline/web` and clicking through the golden path: promote-to-TikTok-carousel from Analyses → see 3–10 9:16 thumbs in Drafts → approve → open scheduler → confirm TikTok integration appears.

### Security / safety
- No new prompt-injection surface. The brand's TikTok channel-override string is operator-supplied and operator-trusted; same trust model as the existing IG channel override.
- Cost guardrail: the slide-count cap at 10 keeps a single TikTok carousel generation under ~10× the cost of an IG carousel. Per-slide image generation cost ≈ $0.04 (gpt-image-2 portrait). Worst-case TikTok carousel: ~$0.40 in image cost. Acceptable.

### Observability
- `providerRuns.cost` already aggregated per call. No new observability needed.
- The §8 success metric (TikTok carousel share) is computed off `drafts` rows directly — no new instrumentation.

---

## 8. Success Metrics

### Primary metric (G5)
- **TikTok carousel share:** `count(drafts where mediaKind = "carousel" AND channel = "tiktok") / count(drafts where mediaKind = "carousel")` over a 7-day rolling window.
- **Baseline:** 0% (TikTok carousels do not exist before this PR).
- **Target:** ≥30% within 4 weeks of merge.
- **Measured in:** the existing Brand tab → Eval history section (extend the `versionSummary` rollup with a `byChannel` breakdown in a follow-up — not in v1; v1 measures via direct Convex dashboard query).

### Secondary metrics
- **TikTok carousel approval rate vs. IG carousel approval rate:** uses the existing `feedback.summaryByBrand` query, sliced by `draft.channel`. Tracks whether TikTok carousels are quality-on-par with IG. A persistent gap > 20 percentage points is a signal the prompt or aspect needs tuning.
- **Regenerate clicks per approved TikTok carousel:** uses the existing primary metric from prior PRD (`prd.md` §8) sliced by channel. Should land within ±20% of IG's value within 4 weeks.
- **Cost per published TikTok carousel:** sum of `providerRuns.cost` for all runs tied to a published TikTok carousel draft. Sanity-check that 9:16 generation cost stays below $0.50/draft (image gen + caption + bake).

### Launch criteria
- IG carousel regression: byte-identical caption + same slide count for the same fixture analysis, before vs. after the PR.
- One real TikTok carousel scheduled successfully via the operator's Postiz TikTok account, observed live in TikTok's draft inbox.
- Prompt-version constants bumped in all three modified prompt files; pre-commit lint clean.

---

## 9. Open Questions

Decisions made during PRD drafting on 2026-04-26:

- **Slide cap of 10** — accepted (§5 N-5). Revisit on operator request.
- **9:16 only for v1** — accepted (§5 N-6). No aspect picker.
- **Auto fan-out deferred** — accepted (§5 N-1). Operator picks per promote.
- **Re-render images for TikTok rather than reuse IG slides** — accepted (§5 N-2). Quality > cost.

Still open (not blocking v1):

1. **Postiz Photo Mode payload key.** Whether the existing `posts[0].value[0].image` array works for TikTok Photo Mode or whether Postiz expects a different key (`photos`, `slideshow.images`, etc.). Resolved during implementation by one manual test post; document the answer in `convex/publish/postiz.ts`.
2. **Brand-tab TikTok carousel preview.** Whether the Brand tab's preview row gains a per-channel toggle in v1 or v1.1. Defer to engineer's discretion: include if trivially small, otherwise leave for v1.1.
3. **TikTok-specific Photo Mode advanced toggles** (`auto_add_music`, `disable_*`). Revisit after first 10 published TikTok carousels — operator will know which toggles they reach for.

---

## Appendix — File map

Files that will change or be added in this PR. Paths relative to repo root.

**Backend (Convex)**
- `convex/generate/carousel.ts` — `fromAnalysis` accepts `channel` arg; default `"ig"`; forwards through.
- `convex/generate/carouselInternal.ts` — `create` accepts `channel`; replaces hardcoded `"ig"` at line 50; reads slide-count clamp from `CAROUSEL_LIMITS[channel]`.
- `convex/generate/carouselPrompts.ts` — exports `CAROUSEL_LIMITS`; exports `buildCarouselSystemPrompt(channel)`; `buildCarouselPrompt` accepts `channel`; bumps `PROMPT_VERSION`.
- `convex/generate/image/carouselAction.ts` — accepts `channel`; switches composition string + `size` param per channel; bumps `PROMPT_VERSION`.
- `convex/generate/image/bakedCarouselAction.ts` — accepts `channel`; switches composition string + safe-area constraints per channel; bumps `PROMPT_VERSION`.
- `convex/generate/image/providers.ts` — allow `"1024x1792"` as a valid OpenAI size; verify Replicate `aspect_ratio: "9:16"`.
- `convex/generate/image/internal.ts` — write actual `width`/`height` on `mediaAssets` rows instead of always 1024×1024.
- `convex/feedback/regenerate.ts` — verify `channel` is propagated on regen; fix if not.

**Frontend (Next.js)**
- `apps/web/app/_components/views/analyses.tsx` — Promote-to-Carousel button becomes a 2-item dropdown.
- `apps/web/app/_components/views/draftsCarousel.tsx` — thumb strip reads `draft.channel`; switches aspect 1:1 vs 9:16.
- `apps/web/app/_components/views/drafts.tsx` — `DraftCard` passes `draft.channel` into `CarouselStrip`.

**Tests**
- `convex/test/tiktokCarousel.test.ts` (new) — per §4.6.18.
- `convex/test/igCarouselRegression.test.ts` (new or extended) — per §4.6.19.

**Docs**
- `progress.md` — append entry on PR merge.
- `docs/adr-tiktok-carousel.md` — already merged at commit `dcd2467`. No change.

---

_End of PRD._

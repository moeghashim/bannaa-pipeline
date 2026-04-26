---
summary: "ADR: parameterize carousel pipeline by target channel to add TikTok Photo Mode"
read_when:
  - Editing carousel generation, carousel image actions, or carousel bake templates.
  - Adding a new carousel-capable channel beyond IG and TikTok.
  - Debugging carousel aspect ratio, slide-count bounds, or caption-length validation.
---

# ADR: TikTok carousel via channel-parameterized pipeline

## Decision

Add TikTok Photo Mode as a target of the existing carousel pipeline by threading `channel` through `convex/generate/carousel.ts`, `carouselInternal.ts`, `carouselPrompts.ts`, `image/carouselAction.ts`, and `image/bakedCarouselAction.ts`. The same generation code emits IG (1:1, 3–5 slides, 150–400 char caption) or TikTok (9:16, 3–10 slides, 80–300 char caption) drafts based on the channel argument.

## Alternatives considered

- **Separate `convex/generate/carouselTikTok.ts` pipeline.** Rejected: 90% of the code is identical (style anchor, per-slide image prompts, brand integration, feedback loop). Two pipelines drift; one parameterized pipeline doesn't.
- **Auto fan-out: one promote-to-carousel click generates both IG and TikTok variants.** Rejected for v1: doubles cost per analysis and removes operator control over per-channel tone. Revisit after the feedback loop produces TikTok-specific approval data.
- **Reuse 1:1 IG slides on TikTok.** Rejected: cropped or letterboxed 1080×1080 on 9:16 looks amateur. TikTok carousels generate fresh at 9:16.

## Rationale

The publish path (`convex/publish/channelMatrix.ts:59-72`) already accepts `("tiktok", "carousel")` and returns the right Postiz Photo-Mode settings. The brand voice override for TikTok already exists. The only gap is upstream: carousel generation hardcodes `channel: "ig"` and the prompt says "Instagram feed carousel". One parameter, one prompt factory, one aspect-ratio threading — TikTok carousel ships in a single PR with no schema change, no migration, and no new env vars.

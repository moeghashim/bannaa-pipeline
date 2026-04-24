# Pipeline Expansion Plan — EN-first, Brand Config, Eval Loop

Three features, each independently shippable as its own PR. Recommended order: **Brand config → EN-first → Feedback**, because both others get easier once the Khaleeji persona is externalized and `brandVersion` is on `providerRuns`.

- Repo: `bannaa-pipeline`
- Convex dev deployment: `shiny-hare-202` (team `ja3ood`, project `bannaa-pipeline`)
- Files referenced below are relative to repo root

---

## Feature 1 — English-first, Arabic as a selectable output language

### Current coupling
- `convex/generate/prompts.ts:11` and `:28` hard-code **Khaleeji-leaning AR** as the voice; `DRAFT_TOOL` requires both `ar` and `en` as non-optional strings; all 7 `CHANNEL_BRIEFS` (lines 55–98) reinforce "Khaleeji" tone.
- `convex/generate/carouselPrompts.ts:9,60` applies the same to per-slide `ar`.
- `drafts` table stores `ar: v.string()` + `en: v.string()` as twins (`convex/schema.ts:142–143`); `carouselSlides.ar` required (`schema.ts:200`).
- `convex/generate/image/bakedAction.ts:39` and `bakedCarouselAction.ts:39` ask gpt-image-2 to render **Arabic glyph-for-glyph**; the "AR" chip + footer layout in `bakedAction.ts:32–42` is Arabic-labelled.
- `convex/analyze/prompts.ts:15` already produces English-only analysis — no change needed there.
- `inboxItems.lang` exists (`schema.ts:78`) but describes the *input*, not a per-draft output language.

### Target model
Primary language = **EN**; zero or more secondary outputs picked per-draft (today: AR; tomorrow: anything). Language becomes a first-class dimension, not a hard-coded string pair.

### Schema changes (`convex/schema.ts`)
1. **`drafts`** — replace `ar` + `en` twins with:
   ```
   primary: v.string()   // English copy (always present)
   translations: v.optional(v.array(v.object({
     lang: v.union(v.literal("ar-khaleeji"), v.literal("ar-msa"), v.literal("ar-levantine"), …), // extensible
     text: v.string(),
     chars: v.number(),
     genRunId: v.id("providerRuns"),
     createdAt: v.number(),
   })))
   ```
2. **`carouselSlides`** — same treatment: `primary` + optional `translations[]`.
3. **`settings`** gains `outputLanguages: string[]` — globally enabled language presets.
4. `inboxItems.lang` unchanged.

### Prompt changes
- Split `convex/generate/prompts.ts` into two stages:
  1. **`DRAFT_TOOL_EN`** — required field `en` only + `chars`. System prompt drops Khaleeji; adopts `brand.tone.voicePersona` (Feature 2).
  2. **`TRANSLATE_TOOL`** — input: approved EN + target-language preset. Output: `{ text, chars }`. Runs only when the operator clicks "+ Arabic".
- `convex/generate/carouselPrompts.ts` — same two-stage refactor. `styleAnchor` stays language-neutral.
- `convex/generate/image/bakedAction.ts:23–47` — templates become language-parameterized. The hard-coded "AR" chip → `{languageLabel}`. "Render glyph-for-glyph verbatim" clause preserved but driven by whichever translation the operator selected for baking.

### UI changes
- `apps/web/app/_components/views/drafts.tsx` — per-channel card header gains a language switch: `EN` (always present) + per-translation chips (`+ Arabic`). Clicking a chip triggers `generateTranslation`. Each translation gets its own editor block. `publishSelection` gains a language axis.
- `apps/web/app/_components/views/analyses.tsx` — Promote stays single-language (EN only); translations happen downstream.
- Settings — new "Output languages" section; operator toggles which presets appear by default on new drafts.

### Migration
- One-shot `convex/migrations/splitDraftsLanguage.ts`: copy `en → primary`, wrap `ar` into `translations: [{lang:"ar-khaleeji", text: ar, …}]`. Same for `carouselSlides`.
- Purge old `ar`/`en` fields in a second deploy after schema narrows (mirrors `cleanupLegacyHyperframes.ts`).
- Dashboard remains functional during overlap: read paths fall back to `primary || en` and `translations[0]?.text || ar`.

### Open questions
- Per-channel language defaults (X always EN-only, IG always EN+AR) or single global default? Proposal: per-channel, inside the brand config.
- AR-MSA vs AR-Khaleeji — language row or brand-voice row? Proposal: brand-voice (Feature 2).

---

## Feature 2 — Brand tone + visual design config

### Current coupling
- Khaleeji persona hard-coded: `convex/generate/prompts.ts:11–12` system prompt and in every `CHANNEL_BRIEFS` entry (lines 55–98).
- Visual brand hard-coded: warm terracotta palette in `convex/generate/image/prompts.ts:31–32`; baked chrome (BANNAA chip, AR label, footer, JetBrains-Mono, `#fff8ec`) in `convex/generate/image/bakedAction.ts:32–42`.
- No config surface — `convex/settings/doc.ts` only tracks `defaultProvider` + `defaultImageProvider`.

### Target model
Two coupled concepts, both editable from a new **Brand tab**:

1. **Tone profile** (text): voice persona, register, do/don't phrases, banned words, reading level, max sentence length, emoji policy, per-channel overrides, Arabic voice presets.
2. **Design profile** (visual): palette, typography, logo/chip text, footer text/URL, layout template (chip + footer positions, margins), image style guide, banned subjects.

Singleton **active brand** per deployment, but the table supports multiple rows so A/B brand tests are later possible.

### Schema changes
```
brands: defineTable({
  name: v.string(),
  isActive: v.boolean(),
  tone: v.object({
    voicePersona: v.string(),
    register: v.union(v.literal("formal"), v.literal("casual"), v.literal("playful")),
    readingLevel: v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced")),
    maxSentenceChars: v.number(),
    emojiPolicy: v.union(v.literal("never"), v.literal("sparse"), v.literal("free")),
    doPhrases: v.array(v.string()),
    dontPhrases: v.array(v.string()),
    // AR voice presets (Feature 1 reads these during TRANSLATE stage):
    arPresets: v.record(v.string(), v.string()),  // { "ar-khaleeji": "Gulf dialect…", "ar-msa": "MSA…" }
    activeArPreset: v.string(),
    channelOverrides: v.optional(v.record(channelType, v.object({ /* per-channel tone tweaks */ }))),
  }),
  design: v.object({
    palette: v.object({ primary: v.string(), accent: v.string(), neutral: v.string(), background: v.string(), text: v.string() }),
    typography: v.object({ heading: v.string(), body: v.string(), mono: v.string() }),
    logoChipText: v.string(),
    footerText: v.string(),
    footerUrl: v.string(),
    layout: v.object({ chipPosition: v.string(), footerPosition: v.string(), margins: v.number() }),
    imageStyleGuide: v.string(),
    bannedSubjects: v.array(v.string()),
  }),
  version: v.number(),
  updatedAt: v.number(),
}).index("by_active", ["isActive"])
```

Also add: `providerRuns.brandVersion: v.optional(v.number())` — every generation run records which brand version produced it.

### Prompt changes
- New `convex/generate/brandPrompt.ts`: `renderBrandSystemPrompt(brand, channel)` — returns the system string prepended to `DRAFT_SYSTEM_PROMPT`.
- `convex/generate/image/prompts.ts` — `buildImagePrompt(…, brand)` injects `brand.design.palette`, `brand.design.imageStyleGuide`, and banned-subject negatives.
- `convex/generate/image/bakedAction.ts` + `bakedCarouselAction.ts` — read chip text, footer, palette, font, and layout from `brand.design` instead of hard-coded literals. Typography fetched from Google Fonts by name (same pattern as the old HyperFrames Noto Naskh fetch).

### Khaleeji specifics (the concrete move)
Three moves in `convex/generate/prompts.ts`:

1. **`DRAFT_SYSTEM_PROMPT` (lines 5–17) → EN-only, no dialect.** Rules 2 ("AR Khaleeji") and 3 ("EN gloss") deleted. New rule 2 becomes "match `{{brand.tone.voicePersona}}`".
2. **`CHANNEL_BRIEFS` (lines 55–98) → language-neutral.** Every "AR" → "target language"; "Khaleeji-casual" on LinkedIn (line 95) removed. Briefs keep length, hook structure, hashtag rules, paragraph shape. Dialect/tone per channel moves to `brand.tone.channelOverrides[channel]`.
3. **Khaleeji becomes a preset** in `brand.tone.arPresets["ar-khaleeji"]`. Seeded values:
   - `ar-khaleeji` → "Gulf dialect, conversational, not MSA, avoids academic phrasing"
   - `ar-msa` → "Modern Standard Arabic, formal, publication-ready"
   - `ar-levantine` → "Levantine dialect, Syria/Lebanon/Jordan register"
   Translate stage (Feature 1) reads `brand.tone.arPresets[brand.tone.activeArPreset]` and injects as the system prompt. Seeded default `activeArPreset = "ar-khaleeji"` → today's behavior is preserved exactly.

### UI changes
- New **Brand** tab next to Settings: two-pane editor.
  - **Tone**: schema-driven form + "Preview on current channel brief" button (cheap LLM round-trip, shows rendered system prompt).
  - **Design**: color swatches, font pickers, logo/footer text, live **sample baked image** preview (real gpt-image-2 render, ~$0.02, throttled).
- Settings tab keeps provider defaults; gains "Active brand: X (edit →)" link.

### Migration
- Seed the singleton brand on first deploy with today's hard-coded values → zero visible change until operator edits.
- Feature flag: while `brands` is empty, prompts fall back to today's constants.

### Open questions
- Per-channel **design** overrides (full override for IG vs LinkedIn) or tone-overridable-only? Proposal: shared design + per-channel tone override.
- Versioning: rely on `brandVersion` + `providerRuns.runAt` + a manual version bump (auto-incremented on save), or introduce a brand-revision history table? Proposal: manual bump, no separate history table (YAGNI).

---

## Feature 3 — Feedback / eval loop on generated media (and text)

### Current coupling
- Zero eval plumbing: no rating, score, or vote table. `providerRuns` (`convex/schema.ts:233–251`) logs only cost/tokens.
- Existing **base ↔ overlay** toggle in Drafts is UI-only — operator's choice isn't persisted.
- Prompts aren't versioned; no way to answer "did last week's prompt tweak improve approval rate?"

### Target model
Three layers, delivered incrementally:

**Layer A — implicit signals (day-one)**
Operator actions become data: approve / reject / publish / regenerate counts per draft, channel, brand version, provider. No new UI; just wiring.

**Layer B — explicit ratings**
A 1-tap feedback surface on every generated asset: `👍 / 👎 / ↻ regenerate-with-feedback` + optional free-text + tag set (`off-brand`, `text-wrong`, `composition`, `palette-off`, `typography`, `wrong-language`). Stored per `mediaAsset` AND per `draft` text version.

**Layer C — A/B evals (later)**
Run the same analysis through two prompt/brand variants, stack outputs side-by-side, capture operator pick → win-rate report per variant.

### Schema changes
```
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
}).index("by_target", ["targetKind", "targetId"])
  .index("by_draft", ["draftId"])
  .index("by_tag", ["tags"])
  .index("by_runId", ["runId"])

evals: defineTable({
  name: v.string(),
  analysisId: v.id("analyses"),
  variantA: v.object({ brandVersion: v.number(), promptVersion: v.string(), draftId: v.id("drafts") }),
  variantB: v.object({ brandVersion: v.number(), promptVersion: v.string(), draftId: v.id("drafts") }),
  winner: v.optional(v.union(v.literal("A"), v.literal("B"), v.literal("tie"))),
  note: v.optional(v.string()),
  createdAt: v.number(),
})
```

Also add to `providerRuns`: `promptVersion: v.optional(v.string())`, `brandVersion: v.optional(v.number())`. Each prompt file exports a `VERSION` constant bumped by hand.

### Backend changes
- Every text/image/bake action records `promptVersion` + `brandVersion` on its `providerRuns` row.
- New `convex/feedback/`: `rate`, `tag`, `regenerateWithFeedback` mutations; `summaryByBrand`, `summaryByPrompt` queries.
- `regenerateWithFeedback`: takes the previous asset + operator's tags + free-text, rebuilds the prompt with a `priorFeedback` block: "Last attempt was rated down for `off-brand, text-wrong`. Operator note: '…'. Fix these before anything else."

### UI changes
- **Drafts tab** — feedback row under each image (👍 👎 🔁) + "Why?" popover with tag chips. Under each text draft, same thumbs + tone/factual/length tag row.
- **Brand tab** — new **Eval history** section: win-rate of current brand vs. previous versions, top-5 failure tags, regenerate rate per channel.
- **New Evals tab** (Layer C, behind a flag): pick analysis → run A/B with two brands or prompt versions → side-by-side picker → log winner.

### Migration
- None for Layer A (start writing `promptVersion`/`brandVersion` on new runs; old rows stay null).
- Layer B ships with empty tables; no backfill.
- Layer C follows once A+B produce real data.

### Open questions
- Does feedback flow back into the **prompt** (append priorFeedback — easy) or into the **brand doc** (harder: tags must mechanically map to `brand.tone.dontPhrases`)? Proposal: local to regenerate flow; surface brand-level aggregates as manual-edit hints.
- Eval scoped to media only (your wording) or also text drafts? Recommendation: both — biggest lever is text quality.

---

## Sequencing & sizing

| Order | Feature | Why first | Rough size |
|---|---|---|---|
| 1 | **Brand config** (tone + design) | Prereq for EN-first (voice) and eval (`brandVersion`) | 3–4 days |
| 2 | **EN-first, AR-as-output** | Unlocks non-AR markets; relies on brand voice being externalized | 3–4 days |
| 3 | **Feedback Layer A + B** | Needs prompt/brand versions in place | 2–3 days |

Total: **~8–11 days** of focused work, across **3 independently shippable PRs**. Layer C of Feedback is another 2–3 days once A+B produce data.

### Cross-cutting
- One ADR per feature in `docs/` (repo convention).
- One integration test per feature that exercises the full Convex action path (adds `convex/test/` scaffold with `convex-test` — small cost, high leverage for prompt iteration).
- Every new table has indexes defined up front (see schema snippets above).
- Append a summary to `progress.md` at each PR merge (via the repo's `npm run commit:with-progress`).

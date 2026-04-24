# PRD — Pipeline Expansion: EN-first Output, Brand Config, Feedback Loop

**Status:** Draft v1
**Author:** Moe Ghashim (`moe@bannaa.co`)
**Last updated:** 2026-04-23
**Target audience:** Junior developer implementing the features
**Related docs:** [plan.md](plan.md) (technical plan), [README.md](README.md) (system overview), [progress.md](progress.md) (learning log)

---

## 1. Introduction / Overview

`bannaa-pipeline` is a single-operator content pipeline that ingests AI-education raw material (X bookmarks, manual captures), runs analysis through a switchable LLM, produces per-channel social drafts, generates background images through five providers, and bakes Arabic text into images with `gpt-image-2`. Everything lands in a review queue — nothing auto-publishes.

Today the pipeline is hard-coded to a **Khaleeji Arabic** voice, a **fixed visual brand** (warm terracotta palette, JetBrains-Mono chrome, `BANNAA · [CHANNEL]` chip), and produces **no signal** about whether generated output was good or bad. The operator approves or rejects in the UI, but that decision doesn't flow back to improve the next round of generations.

This PRD expands the pipeline across three coupled features:

1. **EN-first output with selectable secondary languages** (Arabic at launch; schema ready for more).
2. **Brand configuration** — operator-editable tone + visual design that every generation respects.
3. **Feedback loop** — explicit 1-tap ratings + tags on every generated asset, feeding back into regeneration prompts.

### Problem being solved
- **Language rigidity:** The tool can only publish Arabic. Any English or other-language reach requires manual rewriting.
- **Brand rigidity:** The persona, palette, typography, and chrome are spread across prompt strings and layout code. Every tweak is a code change and a deploy.
- **No quality signal:** When the operator regenerates 4 times before approving, nothing is learned. Prompt changes can't be evaluated against prior versions.

### Goal
Give the operator direct control over language, brand, and quality feedback — without leaving the dashboard — and cut time-to-publish measurably.

---

## 2. Goals

1. **G1 — EN-first output.** Every draft is produced in English first. Arabic is an optional per-draft output generated from the approved English copy on demand. The schema is extensible — additional languages (e.g. Spanish, French) can be added in a later PR by editing the language enum and adding a voice preset string, no architectural change.
2. **G2 — Brand externalized.** All tone (voice persona, register, do/don't phrases, Arabic dialect preset) and visual design (palette, typography, chrome layout, image style) are edited from a new Brand tab. Prompts read from the brand doc at call time. No code change needed to rebrand.
3. **G3 — Feedback captured.** Every generated text draft and media asset has a one-tap 👍 / 👎 / 🔁 control with a tag set. Operator's choice is stored with provenance (brand version, prompt version, provider, model, run ID) so future prompt/brand iterations can be measured against prior outputs.
4. **G4 — Feedback loops into regeneration.** Clicking 🔁 with feedback tags rebuilds the next prompt with an explicit "fix these before anything else" block derived from the tags + optional note.
5. **G5 — Measurable efficiency gain.** Reduce **regenerate clicks per approved draft** by at least **30%** within 4 weeks of Feature 3 launch, versus the baseline measured in the week before launch.

---

## 3. User Stories

All stories are from the single-operator perspective (`moe@bannaa.co`). Multi-operator is explicitly out of scope for v1 (see §5).

### Feature 1 — EN-first output
- **US-1.1:** As the operator, I promote an analysis to a Drafts card and see the English copy generated first, so I can judge the core message before spending tokens on translations.
- **US-1.2:** As the operator, I click `+ Arabic` on an English draft to produce Arabic output using the currently-active Arabic voice preset, so I can publish Arabic without losing the English version.
- **US-1.3:** As the operator, I edit either language version (EN, AR) independently in the draft card, so I can correct one translation without re-running the other.
- **US-1.4:** As the operator, when I click "Bake into image," I pick which language's text gets baked, so the image matches the language I'm publishing in that channel.
- **US-1.5:** As the operator, I schedule either language version through Postiz, so the same draft can produce two scheduled posts across both languages.

### Feature 2 — Brand config
- **US-2.1:** As the operator, I open the Brand tab and edit the voice persona (free text), register (formal/casual/playful), reading level, and max sentence length, so the English draft generator respects my current brand voice without me editing code.
- **US-2.2:** As the operator, I maintain a `doPhrases` list and a `dontPhrases` list, so the LLM learns what's on-brand and what to avoid.
- **US-2.3:** As the operator, I pick which Arabic voice preset is active (Khaleeji / MSA / Levantine) from a dropdown, so switching dialects is a one-click change.
- **US-2.4:** As the operator, I define per-channel tone overrides (e.g., LinkedIn more formal than TikTok), so each channel retains its own voice.
- **US-2.5:** As the operator, I edit the visual palette (5 colors), typography (heading/body/mono font names), logo chip text, footer text/URL, and image style guide, so the baked-text images reflect my current brand.
- **US-2.6:** As the operator, I render a sample baked image from the Brand tab to preview how the current config will look before saving, so I don't discover problems downstream.
- **US-2.7:** As the operator, after I save brand changes, the new version number is recorded automatically on every generation that follows, so I can later correlate output quality to brand versions.

### Feature 3 — Feedback loop
- **US-3.1:** As the operator, I see 👍 / 👎 / 🔁 buttons under every generated text draft and every generated image/carousel slide, so I can capture my reaction in one tap.
- **US-3.2:** As the operator, when I click 👎 I can optionally pick one or more tags (`off-brand`, `text-wrong`, `composition`, `palette-off`, `typography`, `wrong-language`, `tone-off`, `too-long`, `factually-wrong`) and add a free-text note, so the signal is specific.
- **US-3.3:** As the operator, when I click 🔁 ("regenerate with feedback"), the next generation receives my tags + note as an explicit "fix these before anything else" instruction, so I don't repeat the same problem twice.
- **US-3.4:** As the operator, from the Brand tab I can see a small eval rollup — top-5 failure tags this week, regenerate-rate per channel, and current brand-version win-rate vs. the previous version, so I can decide whether a brand edit made things better or worse.

---

## 4. Functional Requirements

Requirements are grouped by feature. Each is implementation-ready: a junior developer can build directly from these.

### 4.1 — Feature 1: EN-first output with selectable secondary languages

1. **The system must replace the `drafts.ar` and `drafts.en` string pair** with:
   - `drafts.primary: string` (English, always present after draft generation)
   - `drafts.translations?: { lang, text, chars, genRunId, createdAt }[]` (zero or more)
2. **The system must replace `carouselSlides.ar`** with the same `primary` + optional `translations[]` shape.
3. **The draft-generation LLM call must produce English only.** The existing `DRAFT_TOOL` schema must be renamed `DRAFT_TOOL_EN`, its `ar` field removed, and its `en` field renamed `primary` and become the single required copy field (plus `chars`, `concepts` unchanged).
4. **A new `TRANSLATE_TOOL` must exist** in `convex/generate/prompts.ts` taking inputs `{ primary, targetLang, brand, channel }` and producing `{ text, chars }`. The call's system prompt must inject the brand's Arabic voice preset string when `targetLang` starts with `ar-`. The function signature must accept any future language code; unsupported codes throw a clear error.
5. **A new Convex action `generateTranslation`** must exist at `convex/generate/translate.ts`, callable from the Drafts view, that takes `{ draftId, targetLang }`, runs the translate LLM call, inserts the result into `drafts.translations[]` (or replaces the existing entry for that lang), and records a `providerRuns` row.
6. **The Drafts card** (`apps/web/app/_components/views/drafts.tsx`) must render:
   - A language-switcher row with `EN` (always shown, always enabled) and one chip per available secondary language (`+ Arabic` at launch).
   - Clicking a `+ Language` chip that is not yet generated calls `generateTranslation` and shows a loading state.
   - Clicking a chip for an already-generated language selects it for editing / baking / publishing.
   - Each language is editable in its own text area independently.
7. **The baked-image flow** (`convex/generate/image/bakedAction.ts` and `bakedCarouselAction.ts`) must accept a `targetLang` argument and read the corresponding text from `drafts.translations[].text` (or `drafts.primary` when `targetLang === "en"`). The hard-coded "AR" chip label must be replaced with a per-language label taken from a `LANG_LABELS` lookup (`en → "EN"`, `ar-khaleeji → "AR"`, `ar-msa → "AR"`, `ar-levantine → "AR"`).
8. **The Postiz publish flow** (wherever the existing `publishSelection` is resolved) must accept a `publishLang` field on the draft, defaulting to `"en"`, and pick the matching text for upload.
9. **The settings doc** must gain an `outputLanguages: string[]` field listing which language chips are shown by default on new drafts. Seed value: `["ar-khaleeji"]`.
10. **A migration `convex/migrations/splitDraftsLanguage.ts`** must be written and run once: for every existing `drafts` row, copy `en → primary` and wrap `ar` into `translations: [{ lang: "ar-khaleeji", text: ar, chars, genRunId, createdAt }]`. Same logic for `carouselSlides`. After the migration deploys cleanly, a follow-up PR must narrow the schema to remove the old `ar` + `en` fields. The follow-up must not deploy until operator confirms no legacy reads remain.
11. **All read paths** (queries that feed the Drafts view, the Analyses view, the baked-image flows) must be updated to prefer `primary` over `en` and to iterate `translations[]` over `ar`. During the migration overlap, a fallback `primary ?? en` and `translations ?? (ar ? [{lang:"ar-khaleeji", text: ar, …}] : [])` must be used.

### 4.2 — Feature 2: Brand config

12. **A new Convex table `brands`** must be added with the shape specified in [plan.md — Feature 2 schema](plan.md#schema-changes-1). One row is the active brand (`isActive: true`). Other rows are permitted but only the active row is read by generation code.
13. **A migration `convex/migrations/seedBrand.ts`** must insert a single active `brands` row on first run, populated with today's hard-coded values so no visible behavior changes on day one:
    - `tone.voicePersona` = "friendly AI educator for Gulf readers, conversational, not academic"
    - `tone.register` = "casual"
    - `tone.readingLevel` = "intermediate"
    - `tone.maxSentenceChars` = 220
    - `tone.emojiPolicy` = "sparse"
    - `tone.doPhrases` = `[]` (operator fills in)
    - `tone.dontPhrases` = `[]` (operator fills in)
    - `tone.arPresets` = `{ "ar-khaleeji": "Gulf dialect, conversational, natural for Gulf readers, not formal MSA. Avoid stiff academic phrasing.", "ar-msa": "Modern Standard Arabic, formal, publication-ready, no dialect markers.", "ar-levantine": "Levantine dialect, Syria/Lebanon/Jordan register, conversational." }`
    - `tone.activeArPreset` = `"ar-khaleeji"`
    - `tone.channelOverrides` = (seed with today's `CHANNEL_BRIEFS` content, tone only — the length/format parts stay in code)
    - `design.palette` = `{ primary: "oklch-warm-terracotta", accent: "#d97757", neutral: "#f5e8d8", background: "#fff8ec", text: "#2a1f18" }` (read current values from `convex/generate/image/prompts.ts:31–32` and `bakedAction.ts:32–42` and transcribe verbatim)
    - `design.typography` = `{ heading: "JetBrains Mono", body: "JetBrains Mono", mono: "JetBrains Mono" }`
    - `design.logoChipText` = `"BANNAA"`
    - `design.footerText` = `"bannaa.co"`
    - `design.footerUrl` = `"https://bannaa.co"`
    - `design.layout` = `{ chipPosition: "top-left", footerPosition: "bottom-left", margins: 48 }`
    - `design.imageStyleGuide` = (transcribe from `convex/generate/image/prompts.ts:31–32` verbatim)
    - `design.bannedSubjects` = `[]`
    - `version` = 1
14. **A new Convex module `convex/brand/`** must expose:
    - `query getActive()` — returns the active brand doc (live, in-progress edits included).
    - `mutation updateActive(patch)` — validates and patches the active brand *in place*, sets `updatedAt`. **Does NOT bump `version`.** Intended for live editing.
    - `mutation publishVersion(note?)` — snapshots the current active brand state into a new `brandVersions` row, bumps `brand.version` by 1, records the operator note. Only this action changes `brand.version`. A new **`brandVersions`** table holds immutable snapshots: `{ brandId, version, tone, design, note?, publishedAt }`, indexed by `(brandId, version)`.
    - `query listVersions()` — returns all published versions of the active brand with metadata.
    - `query listVersionsSummary()` — rollup of `providerRuns` grouped by `brandVersion` for the eval history view (read-only).
    - **Rationale:** explicit publish keeps `brandVersion` stable across a burst of edits, so approval-rate comparisons between versions measure real deltas, not edit-mid-flight churn.
15. **A new module `convex/generate/brandPrompt.ts`** must expose `renderBrandSystemPrompt(brand, channel): string`. This function composes the brand's tone fields + channel override into the system-prompt string that prepends `DRAFT_SYSTEM_PROMPT`. `DRAFT_SYSTEM_PROMPT` itself must be rewritten to drop all Khaleeji and AR-specific rules — it becomes language-neutral and voice-neutral, describing only the structural rules (single tool call, honor channel length, reuse concept names, no out-of-scope rejection).
16. **`CHANNEL_BRIEFS`** (in `convex/generate/prompts.ts:55–98`) must be rewritten so each entry contains only language-agnostic structural fields: `label`, `charLimit` (renamed from `arLimit`), `format`. The `tone` line on each brief must be removed — tone comes from `brand.tone.channelOverrides[channel]`.
17. **Image prompt builder** (`convex/generate/image/prompts.ts`) must accept a `brand` argument and interpolate `brand.design.palette` color names, `brand.design.imageStyleGuide`, and `brand.design.bannedSubjects` (as negative prompts).
18. **Baked-text actions** (`convex/generate/image/bakedAction.ts`, `bakedCarouselAction.ts`) must read chip text, footer text, palette, font, and layout from `brand.design` instead of the current hard-coded literals. Google Fonts must be fetched by the `brand.design.typography.*` names at call time (the same fetch pattern used by the removed HyperFrames compositor is a good reference — see git history for `convex/generate/image/hyperframes.ts`).
19. **`providerRuns`** must gain optional fields `brandVersion: number | null` and `promptVersion: string | null`. Every existing call site that writes a `providerRuns` row must set these values. Each prompt module (`DRAFT_SYSTEM_PROMPT`, `ANALYZE_SYSTEM_PROMPT`, carousel prompts, image prompts) must export a `VERSION` string constant (e.g., `"2026-04-23-a"`) that is bumped manually when the prompt is edited.
20. **A new dashboard view `apps/web/app/_components/views/brand.tsx`** must be added alongside the existing views. It must appear as a new tab in `apps/web/app/_components/app.tsx` between `settings` and the other tabs.
21. **The Brand tab** must render a two-pane editor plus a publish bar:
    - Left pane (**Tone**): form fields matching §4.2.13 schema. Each edit patches the active brand via `updateActive` (in-place, no version bump). A "Preview system prompt" button below the form shows the currently rendered `renderBrandSystemPrompt(brand, channel)` output for a chosen channel. A separate "Preview draft" button triggers a single live LLM call (current provider, current brand, current channel) against a canned analysis fixture and displays the resulting draft — costs ~1¢, rate-limited to 1 call per 10 seconds per user.
    - Right pane (**Design**): color swatches (5 with hex input), font pickers (3 name-string inputs), logo/footer/URL text inputs, layout radios, image style guide textarea, banned subjects chips. A "Preview baked image" button renders a single sample baked image using the current config — costs ~2¢, rate-limited to 1 call per 30 seconds per user. The returned PNG must be uploaded to Convex file storage (a new `brandPreviews` collection — simplest: reuse `_storage` with a `brandPreviews` mapping table `{ brandId, hash, storageId, createdAt }` indexed by `(brandId, hash)`) and displayed in the pane. Identical-input renders (same `hash` of brand design fields) return the cached storageId without re-rendering. The pane must survive a page reload without triggering a re-render.
    - **Publish bar** (sticky footer of the Brand tab): shows a "Changes since v{N}" diff summary + an explicit "Publish v{N+1}" button that calls `publishVersion(note)` with an optional note. The button is the only way to bump `brand.version`. Until publish, all live generations still read the current (edited) brand state but tag their `providerRuns.brandVersion` with `N` (the last-published version).
22. **The Settings tab** must display a small "Active brand: `{name}` (v{version}) — Edit →" link that routes to the Brand tab.

### 4.3 — Feature 3: Feedback loop (Layers A + B)

23. **Layer A — implicit signals.** `providerRuns` must be written on every generation with `brandVersion` and `promptVersion` (already covered by §4.2.19). No new schema beyond that for Layer A.
24. **Layer B — explicit feedback table.** A new table `feedback` must be added with the shape in [plan.md — Feature 3 schema](plan.md#schema-changes-2):
    ```
    targetKind: "draft" | "mediaAsset" | "carouselSlide"
    targetId: string
    draftId: Id<"drafts">
    rating: "up" | "down" | "neutral"
    tags: string[]
    note?: string
    authorId: Id<"users">
    createdAt: number
    brandVersion?: number
    promptVersion?: string
    provider: string
    model: string
    runId: Id<"providerRuns">
    ```
    Indexes: `by_target(targetKind, targetId)`, `by_draft(draftId)`, `by_tag(tags)` (array-index), `by_runId(runId)`.
25. **A new Convex module `convex/feedback/`** must expose:
    - `mutation rate({ targetKind, targetId, rating, tags?, note? })` — inserts a feedback row. If the same user has already rated the same target, the existing row is patched, not duplicated.
    - `mutation regenerateWithFeedback({ draftId, targetKind, targetId, tags, note })` — looks up the last `providerRuns` for the target, builds a prompt that prepends a "Prior attempt was rated down for: {tags}. Operator note: '{note}'. Fix these before anything else." block, re-runs the appropriate generation action, and writes a new feedback row linking the new run to the prior one (via an optional `priorRunId` field on feedback — add this field now).
    - `query forTarget({ targetKind, targetId })` — returns all feedback rows for a target, newest first.
    - `query summaryByBrand({ brandVersion?, since? })` — aggregates feedback counts per brand version, returning `{ up, down, neutral, topTags, regenerateRate, approvalRate }`.
    - `query summaryByPrompt({ promptVersion, since? })` — same shape, keyed by promptVersion.
26. **Allowed feedback tags** (closed vocabulary for v1):
    - For text targets: `tone-off`, `too-long`, `too-short`, `factually-wrong`, `wrong-language`, `off-brand`, `boring`.
    - For media targets: `off-brand`, `text-wrong`, `composition`, `palette-off`, `typography`, `wrong-subject`, `low-quality`.
    The vocab lives in `convex/feedback/tags.ts` as a pair of exported constants. UI chips render from those constants.
27. **Drafts view UI** must render, for each text draft and each media asset (image or carousel slide):
    - Three inline buttons: 👍 (rating=up), 👎 (rating=down, opens tag popover), 🔁 (opens tag popover + note input, then calls `regenerateWithFeedback`).
    - A small badge showing the existing rating if one exists.
    - The tag popover is a compact menu of the allowed tags for the target kind, multi-select, plus an optional note textarea capped at 280 chars.
28. **Brand tab** must gain an "Eval history" section below the two-pane editor. This section must render:
    - A card showing current brand version approval rate vs. previous brand version approval rate (both computed by `summaryByBrand`).
    - A top-5 failure tags list, with counts (from `summaryByBrand.topTags`).
    - A regenerate-rate-per-channel table (rows: channels; column: regenerate-rate for the last 7 days).

### 4.4 — Shared / cross-cutting

29. **Prompt versioning.** Every prompt-owning module in `convex/generate/` and `convex/analyze/` must export a `VERSION` constant. When a prompt is edited, the developer bumps the version string (format: `YYYY-MM-DD-a`, `-b` etc.). A lint check in `scripts/check-prompt-versions.mjs` (new) must emit a **warning** (not an error) during `npm run check` when a prompt file is modified without a `VERSION` bump. The warning must include the file path and a suggested bump (next letter in today's date). It must not block the commit or fail CI — the developer may knowingly accept the warning for trivial edits like comment changes.
30. **Backward compatibility during migrations.** For every schema narrow step, a PR must deploy the write-path first (producing both old + new shapes), then a second PR narrows the schema and removes the old-shape code. No PR may remove old-shape fields until the operator has confirmed no legacy data remains.
31. **ADR.** One ADR must be added to `docs/` per feature at merge time: `docs/adr-brand-config.md`, `docs/adr-en-first.md`, `docs/adr-feedback-loop.md`. Each must briefly explain: what was changed, alternatives considered, why this choice.
32. **Progress log.** Each PR must append a summary entry to `progress.md` via the repo's `npm run commit:with-progress` tool.

---

## 5. Non-Goals (Out of Scope)

For v1 of this expansion, the following are explicitly **not** included:

- **N-1. Multi-operator / team support.** System remains single-operator on the `OPERATOR_EMAILS` allowlist. SaaS multi-tenant conversion will come later as its own project.
- **N-2. Self-serve arbitrary locales.** Only English and three Arabic presets (Khaleeji, MSA, Levantine) are shippable at launch. Adding another language (Spanish, French, etc.) is a later code change: add to the language enum + add a style preset string on the brand doc + add a language chip to the Drafts view. No v1 UI for self-serve locale addition.
- **N-3. Layer C — A/B evals tab.** No side-by-side A/B variant runner, no winner-picking UI, no win-rate-by-variant analytics. Layers A + B only.
- **N-4. Auto-tuning brand from feedback.** Feedback is surfaced as operator-facing rollups; the brand doc is never auto-mutated. Operator manually edits Brand based on what they see in Eval history.
- **N-5. Multiple simultaneous active brands.** The `brands` table schema supports multiple rows but only one may be active at a time in v1 (enforced in `updateActive`).
- **N-6. Retroactive feedback backfill.** Historical generations (before Feature 3 ships) do not get `brandVersion` or `promptVersion` populated. Old rollups start at launch day.
- **N-7. Custom fonts uploaded by operator.** Typography is limited to Google Fonts fetchable by name.
- **N-8. Video generation.** The schema has `mediaKind: "video"` but this PRD does not add video generation. Existing placeholder tabs (Reel Ideas, Newsletter, Website Proposals) remain out of scope.
- **N-9. Publishing English or Spanish through Postiz.** Postiz integration changes are limited to recording `publishLang` — confirming the Postiz account supports non-AR posting is part of Feature 1's follow-up, not v1.
- **N-10. Prompt rollback UI.** Version bumping is manual in code; there is no dashboard to roll back to an earlier prompt version. Rollback is a git revert.

---

## 6. Design Considerations

### Dashboard shell
- The existing tab order is: `Inbox`, `Analyses`, `Drafts`, `Reel Ideas`, `Newsletter`, `Website`, `Settings`.
- Insert the new **Brand** tab between `Settings` and `Newsletter` (or wherever is stylistically least disruptive — confirm with operator during implementation).
- Keyboard shortcut for Brand: `G B` (follows existing `G I`/`G A`/`G D` pattern in the command palette).

### Drafts card language chips
- Shown as small pill buttons above the draft text area. Primary `EN` pill is always highlighted. Secondary language chips (`+ Arabic` at launch) render in a "not-yet-generated" style until pressed; once generated, they render as selectable tabs.
- Selected chip controls: (a) which text is shown in the editor, (b) which is passed to the baked-image action, (c) which is used for publishing.

### Feedback controls
- The 👍 / 👎 / 🔁 row is compact and inline — does not push the card height noticeably. Tag popover is a floating menu, not a modal.
- Tag chips in the popover use Biome-styled row layout consistent with existing concept chips in the Analyses view.

### Brand tab layout
- Two-column split on desktop (≥1024px): Tone left, Design right.
- Single-column stacked on mobile (though the operator primarily uses desktop per README).
- Below the editor, full-width "Eval history" section.

### Image previews
- "Preview baked image" must cache identical-input renders for 5 minutes to prevent accidental double-spend.

No Figma mockups exist. UI follows existing dashboard conventions in `apps/web/app/_components/primitives.tsx` and the views in `apps/web/app/_components/views/`.

---

## 7. Technical Considerations

### Stack
- **Convex** (deployment: `shiny-hare-202`, team `ja3ood`): all backend — schema, queries, mutations, actions, storage. All new tables, migrations, and modules land in `convex/`.
- **Next.js 16 (App Router, Turbopack)** in `apps/web`: all new UI.
- **Node 24** (pinned in `.nvmrc`). Local dev currently uses a Homebrew-installed `node@24` via PATH — the repo's `engines.node = "24.x"` is authoritative.

### Key constraints
- **No direct `useEffect` in `apps/web`** — use `useMountEffect` from `apps/web/lib/use-mount-effect.ts`.
- **Relative imports in `apps/web` and `convex/` must not have `.js` extensions** (Turbopack + Convex codegen convention).
- **No `"use node"` on files imported by `convex/http.ts`** — the brand prompt renderer, image prompt builder, and feedback module must stay V8-safe. Actions that call gpt-image-2 can remain `"use node"` as today.
- **File length cap of 600 lines** enforced by `scripts/check-file-length.mjs`. The Brand view and Drafts view will approach this — split into subcomponents under `apps/web/app/_components/views/brand/` and `views/drafts/` if needed.
- **Biome formatting:** tabs, indentWidth 3, lineWidth 120.
- **Pre-commit hook (Husky):** runs `npm run check` — biome + file-length + `tsgo` + per-workspace `tsc`. PRs that fail `check` cannot merge.

### Dependencies
- No new npm dependencies are required. All language/brand/feedback logic uses existing `@anthropic-ai/sdk`, `openai`, `convex`, and `@convex-dev/auth`.
- Google Fonts fetch uses native `fetch` + module-level cache (existing pattern from the deleted HyperFrames compositor — reference `git log --diff-filter=D -- convex/generate/image/hyperframes.ts` to see the original implementation).

### Migration ordering
Three PRs, in order:

1. **PR-1: Brand config.** Adds `brands` table, seeds active brand, adds `brandVersion` + `promptVersion` to `providerRuns`, refactors prompts to read from brand doc. No visible behavior change (seed values match today's hard-coded strings). Ships Brand tab UI.
2. **PR-2: EN-first + translations.** Schema split of `drafts` and `carouselSlides`. Migration runs. Draft generation produces EN only. `generateTranslation` action added. Drafts view gains language chips. Baked-image actions accept `targetLang`. Postiz gains `publishLang`.
3. **PR-3: Feedback loop.** Adds `feedback` table. Adds `convex/feedback/` module. Drafts view gains 👍 / 👎 / 🔁 controls. Brand tab gains Eval history section.

Each PR must be independently revertable. No PR may depend on unmerged changes from a later PR.

### Provider runs schema evolution
- `providerRuns.brandVersion` and `.promptVersion` are optional — they remain `null` for runs that happened before PR-1. Rollup queries must skip null values, not treat them as a default version.
- `feedback.priorRunId` (optional `Id<"providerRuns">`) is introduced in PR-3 to chain regenerate-with-feedback calls. Absent on first-generation feedback rows.

### Testing
- No test scaffold exists in the repo today. Part of PR-1 is adding a minimal `convex/test/` directory using [`convex-test`](https://docs.convex.dev/functions/testing) with at least one integration test per feature:
  - PR-1 test: `updateActive` increments version; `renderBrandSystemPrompt` includes do/don't phrases.
  - PR-2 test: `generateTranslation` produces a translation row and links a `providerRuns` id.
  - PR-3 test: `rate` updates existing feedback for the same `(authorId, targetId)` rather than duplicating; `regenerateWithFeedback` writes a new `providerRuns` row and links `priorRunId`.
- UI changes should be spot-checked by running `npm run dev -w @bannaa-pipeline/web` and manually exercising the flow. Per CLAUDE's guidance on UI changes, the implementing engineer must actually click through the golden path in a browser before calling a PR ready for review.

### Security / safety
- **No secrets in brand doc.** The brand doc is read by the operator only (auth-gated query); still, do not permit operator-supplied strings to include the system's API keys or webhook URLs. Keep `footerUrl` validated as a URL, and sanitize logo/footer text to plain Unicode in the baked-image prompt (no prompt injection vector via brand → LLM round-trip; the LLM only sees brand strings, never the user's session token).
- **Rate limit live previews** in the Brand tab per §4.2.21 to prevent accidental cost blowout.

### Observability
- `providerRuns` already captures cost per call. New queries `summaryByBrand` and `summaryByPrompt` aggregate these. No new observability infra needed.

---

## 8. Success Metrics

### Primary metric (G5)
- **Regenerate clicks per approved draft:** measured as `count(providerRuns where purpose ∈ {generate-draft, bake-single-image, bake-carousel-image}) / count(drafts where state = "approved")` over a 7-day rolling window.
- **Baseline:** measure in the week preceding PR-3 merge (last 7 days of current behavior).
- **Target:** 30% reduction within 4 weeks of PR-3 merge.
- **Measured in:** a new `Brand tab → Eval history` card that renders this metric live.

### Secondary metrics
- **Approval rate by brand version:** `count(feedback where rating = up AND brandVersion = X) / count(feedback where brandVersion = X)`. Must trend up or at worst flat after brand edits; a decline is a signal to revert the brand edit.
- **Top failure tags:** the 5 most-applied `tags` on `rating = down` feedback, over 7 days. Used by the operator to guide brand tweaks.
- **Language mix:** count of published drafts by language. Not a target, but a visibility metric — confirms Feature 1 is being used.

### Launch criteria
- **PR-1 (Brand config):** ships with zero visible behavior change (seed brand matches today's output). Verified by generating one draft + one image before and after the deploy and confirming byte-identical prompts and near-identical outputs.
- **PR-2 (EN-first):** every existing draft remains readable in the Drafts view after migration. Operator can still publish any legacy draft's AR version via the same flow as before.
- **PR-3 (Feedback):** 👍 / 👎 / 🔁 visible on at least one existing draft; `feedback.rate` inserts are visible in the Convex dashboard within one minute of the operator clicking a button.

---

## 9. Open Questions

Decisions resolved during PRD review on 2026-04-23:

- **Feedback tag vocabulary** — accepted as-is (§4.3.26). No additions or removals.
- **Brand version bumping** — explicit `publishVersion` mutation + "Publish v{N+1}" button (§4.2.14, §4.2.21). `updateActive` patches in place without bumping the counter.
- **Prompt-version lint strictness** — warn only, never blocks (§4.4.29). Developer may knowingly accept the warning.
- **Baked-image sample preview persistence** — cached in Convex file storage keyed by brand-design hash (§4.2.21). Survives reload.
- **Multi-operator readiness** — `feedback.authorId` included from day one (§4.3.24) even though single-operator in v1, to make future SaaS migration trivial.

Still open (not blocking v1):

1. **Next language post-launch.** Direction is possibly "open for all languages" rather than a specific next add. Defer the decision until the operator observes real usage; v1 ships with extensible schema (§4.1.4 — `generateTranslation` accepts any language code; unsupported codes throw). When the direction firms up, a follow-up PR adds the UI-level language picker (free-form code vs. curated list) without schema change.

---

## Appendix — File map

Files that will change or be added, grouped by PR. Paths relative to repo root.

**PR-1 (Brand config)**
- `convex/schema.ts` — add `brands` table; add `brandVersion`, `promptVersion` to `providerRuns`.
- `convex/brand/doc.ts` — new: `getActive`, `updateActive`, `listVersionsSummary`.
- `convex/migrations/seedBrand.ts` — new.
- `convex/generate/brandPrompt.ts` — new.
- `convex/generate/prompts.ts` — rewrite `DRAFT_SYSTEM_PROMPT` to drop Khaleeji; flatten `CHANNEL_BRIEFS` tone fields.
- `convex/generate/carouselPrompts.ts` — same refactor.
- `convex/generate/image/prompts.ts` — accept `brand` arg.
- `convex/generate/image/bakedAction.ts`, `bakedCarouselAction.ts` — read chrome from brand.
- `apps/web/app/_components/app.tsx` — add `brand` view key.
- `apps/web/app/_components/views/brand.tsx` — new (may split into submodules).
- `apps/web/app/_components/views/settings.tsx` — add "Active brand" link.
- `scripts/check-prompt-versions.mjs` — new.
- `docs/adr-brand-config.md` — new.

**PR-2 (EN-first + translations)**
- `convex/schema.ts` — split `drafts` and `carouselSlides` language fields.
- `convex/migrations/splitDraftsLanguage.ts` — new.
- `convex/generate/prompts.ts` — rename `DRAFT_TOOL` → `DRAFT_TOOL_EN`; add `TRANSLATE_TOOL`.
- `convex/generate/translate.ts` — new action.
- `convex/drafts/*` — update read paths with fallbacks.
- `convex/generate/image/bakedAction.ts`, `bakedCarouselAction.ts` — accept `targetLang`.
- `convex/settings/doc.ts` — add `outputLanguages`.
- `apps/web/app/_components/views/drafts.tsx` — language chip switcher.
- `apps/web/app/_components/views/analyses.tsx` — Promote emits EN-first draft only.
- `docs/adr-en-first.md` — new.

**PR-3 (Feedback)**
- `convex/schema.ts` — add `feedback` table with indexes.
- `convex/feedback/rate.ts`, `regenerateWithFeedback.ts`, `summary.ts`, `tags.ts` — new.
- `apps/web/app/_components/views/drafts.tsx` — add 👍👎🔁 controls + tag popover.
- `apps/web/app/_components/views/brand.tsx` — add Eval history section.
- `docs/adr-feedback-loop.md` — new.

---

_End of PRD._

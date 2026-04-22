# Progress Log

Append-only learning log for commits and deploys. Add new entries only at the end of this file. Do not edit or delete previous entries.

## Entry Template

## <ISO timestamp>
- Trigger: <commit|deploy>
- Learning: <required learning>
- Context: <commit message or release bump/version>
- Branch: <branch>
- Actor: <git user.name <git user.email>>
- Changed Paths:
  - <path> (commit entries only)
## 2026-04-21T01:27:07.306Z
- Trigger: commit
- Learning: Scaffold shipped with Node 22 pin across .nvmrc, package.json engines, and scripts/native-deps.mjs EXPECTED_NODE_MAJOR; updated all three to 24 and bumped @types/node to ^24. Also bumped next 16.2.1 → 16.2.4 to patch GHSA-q4gf-8mx6-v5v3 (Server Components DoS).
- Context: chore: pin Node 24 and bump next to 16.2.4
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - .nvmrc
  - package.json
  - apps/web/package.json
  - scripts/native-deps.mjs
  - package-lock.json
## 2026-04-21T01:39:40.889Z
- Trigger: commit
- Learning: Ran npx convex dev --configure new --project bannaa-pipeline --once; created project under team ja3ood with dev deployment shiny-hare-202. CLI wrote CONVEX_DEPLOYMENT / CONVEX_URL / CONVEX_SITE_URL to .env.local (gitignored), scaffolded convex/ with _generated types, and appended .env.local to .gitignore.
- Context: feat(convex): initialize fresh bannaa-pipeline project
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - .gitignore
  - package.json
  - package-lock.json
  - convex
## 2026-04-21T02:04:46.584Z
- Trigger: commit
- Learning: Ported the seven-tab operator dashboard (Inbox, Analyses, Drafts, Reel Ideas, Newsletter, Website Proposals, Settings) from the Claude Design HTML/JSX bundle to Next.js 15 App Router + TypeScript. Kept CSS-variable design tokens verbatim in globals.css; wired next/font for Inter Tight + JetBrains Mono + Newsreader + Noto Naskh Arabic; state-chip, keyboard (J/K, G-chain, CMD-K), command palette, capture bar with pipeline-progress animation, bilingual RTL website editor all live. Relaxed Biome useSemanticElements + noStaticElementInteractions for apps/web — the design intentionally uses styled div rows + scrim patterns that break if forced to <button>. Also dropped .js extensions from relative imports under apps/web; Turbopack cannot resolve .js->.tsx even with moduleResolution=Bundler.
- Context: feat(web): port Bannaa Pipeline dashboard from Claude Design handoff
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - apps/web/app/globals.css
  - apps/web/app/layout.tsx
  - apps/web/app/page.tsx
  - apps/web/app/_components
  - biome.json
## 2026-04-21T14:19:34.543Z
- Trigger: commit
- Learning: Phase 1 scope locks to: Convex schema (users/inboxItems/analyses/concepts/providerRuns), Convex Auth magic-link with single-email allowlist, manual-capture mutation, Claude analyze action with strict tool-use schema, live Inbox+Analyses wiring to Convex. Explicitly deferred: crons, ingest adapters, drafts/reel/newsletter generation, HyperFrames, Postiz, Resend send, GitHub PRs, multi-provider, budget enforcement. Seeded ontology is minimal (~20 concepts from design demo data) since bannaa.co has no real content — corrected from earlier assumption that bannaa.co was populated. Open questions tracked in the PRD for later phases: budget over-cap policy, Media track scope, Website Proposals direction, ontology provenance, FB+LinkedIn channels in Drafts.
- Context: docs(prd): add phase-1 backend PRD
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - docs/prd-phase-1.md
## 2026-04-21T15:02:27.469Z
- Trigger: commit
- Learning: Phase-1 backend landed: Convex schema (users via authTables, inboxItems, analyses, concepts, providerRuns), Convex Auth with magic-link via Resend + single-email allowlist for moe@bannaa.co, inbox capture/list/get/reject mutations+queries, analyze action calling Claude Sonnet 4.6 via tool-use (strict record_analysis schema, tracks Foundations/Agents/Media), budget/todaySpend query computing AST-day cost from providerRuns. Frontend swapped SEED_INBOX+SEED_ANALYSES for useQuery/useMutation/useAction; setTimeout simulations removed; hint bar shows live today-spend against the cap and Sonnet 4.6 model; sidebar shows the signed-in operator. Sign-in page at /sign-in, middleware redirects unauthed routes. Seeded 20 starter concepts (approved=true). Still open before live use: ANTHROPIC_API_KEY + RESEND_API_KEY must be set via npx convex env set; AUTH_EMAIL_FROM default is noreply@bannaa.co and requires Resend domain verification. Learned: @convex-dev/auth/providers/Email uses a named (not default) export; Turbopack cannot resolve relative imports with .js extension even under moduleResolution=Bundler so we strip them in apps/web; requireUser helper must use the generated ActionCtx/MutationCtx/QueryCtx types, not GenericDataModel, or it won't accept schema-typed ctx.
- Context: feat(backend): phase-1 Convex backend + auth + live Inbox/Analyses
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - convex
  - apps/web/app
  - apps/web/middleware.ts
  - apps/web/tsconfig.json
  - package.json
  - package-lock.json
## 2026-04-21T18:57:23.162Z
- Trigger: commit
- Learning: Added two LLM providers: Zhipu GLM (default model glm-5.1 via Zhipu's OpenAI-compatible endpoint at open.bigmodel.cn/api/paas/v4) and OpenRouter (default target anthropic/claude-sonnet-4-6, overridable via OPENROUTER_MODEL env). Unified dispatch in convex/analyze/providers.ts: Anthropic-native tool-use for Claude, OpenAI-compatible function-calling for GLM + OpenRouter. DEFAULT_ANALYZE_PROVIDER env var selects the default (fallback: glm). Schema provider union expanded to claude|glm|openrouter on both analyses and providerRuns tables; recordSuccess and recordAudit now accept the full union (recordAudit previously hardcoded claude and lost provenance on non-Claude failures). Frontend picker on Analyses tab + Settings tiles updated to Claude/GLM/OpenRouter with GLM as the default-active tile. Pricing table approximates GLM at /bin/zsh.6/.8 per MTok; OpenRouter uses the selected model's tokens through the same estimator. To enable: npx convex env set GLM_API_KEY ..., OPENROUTER_API_KEY ..., optionally GLM_MODEL / OPENROUTER_MODEL / DEFAULT_ANALYZE_PROVIDER.
- Context: feat(analyze): add GLM + OpenRouter providers, default to GLM-5.1
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - convex
  - apps/web/app
  - package.json
  - package-lock.json
## 2026-04-21T19:55:26.991Z
- Trigger: commit
- Learning: Three small gaps closed before starting Phase 2: (1) Open analysis button on Inbox detail now wires to Shell's onOpenAnalysis which sets analysisSel and navigates to the Analyses tab; (2) InboxView's selection now pulls from filtered list (not underlying items) so the detail pane follows the visible rows when filters narrow them — avoids showing a rejected item when filter=new; (3) renamed apps/web/middleware.ts to proxy.ts per Next.js 16 convention, export signature unchanged, Next.js picks it up automatically and the deprecation warning is gone. Palette action shortcuts (Analyze/Approve/Reject/Edit) are still cosmetic — left for Phase 2 since wiring them needs current-selection plumbing into Palette.
- Context: chore(web): phase 1 polish — Open analysis nav, filter-aware selection, proxy rename
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - apps/web/app/_components/app.tsx
  - apps/web/app/_components/views/inbox.tsx
  - apps/web/middleware.ts
  - apps/web/proxy.ts
## 2026-04-21T20:19:36.386Z
- Trigger: commit
- Learning: Phase 2 kickoff (track C): default analyze provider now lives in a settings singleton doc in Convex, not an env var. Settings tab's provider tiles became click-to-set (Convex mutation persists the choice); Analyses tab's per-item LLM picker became a read-only label (per-item override is out of scope now); HintBar model string is driven by the same setting so it always reflects what Analyze will actually use. analyze.run reads settings.doc.getInternal first, then falls back to DEFAULT_ANALYZE_PROVIDER env, then 'glm'. TypeScript gotcha: the action's handler needed an explicit Promise<RunResult> annotation — without it, useAction(api.analyze.run.run) in the frontend triggered Convex's recursive type inference and TS7022/7023 cascaded into unrelated files. Lesson: whenever an action's handler reads internal.* queries that reference the same generated api, add an explicit return type.
- Context: feat(settings): global default provider stored in Convex, interactive tiles
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - convex
  - apps/web/app/_components
## 2026-04-21T20:40:19.586Z
- Trigger: commit
- Learning: X ingest end-to-end: Convex HTTP routes /auth/x/start + /auth/x/callback run the OAuth 2.0 PKCE dance against x.com/i/oauth2/authorize (confidential client, offline.access for refresh, scopes tweet.read bookmark.read users.read offline.access). PKCE verifier/challenge generated via Web Crypto (crypto.subtle.digest + btoa for base64url) so everything stays in Convex V8 runtime — no 'use node' — which means the HTTP router in http.ts can import it cleanly. Tokens persist in new xAccounts table (userId indexed); xOauthState is a short-lived CSRF+verifier table with TTL check on consume. Bookmarks sync (internal.x.sync.syncAll on 15-min cron + action.syncMine for manual trigger) calls GET /2/users/:id/bookmarks paginated with next_token (capped at 5 pages per run), dedupes against inboxItems via new by_xTweetId index, and inserts new rows with real tweet text as snippet (no more 'Awaiting fetch' placeholder for X). Refresh token logic runs automatically when access token is within 1min of expiry. Settings tab now has a live XConnection widget showing @handle + last sync relative time + 'Sync now' button. Gotcha: useQuery(api.x.accounts.mineStatus) sits on a public query that calls requireUser, so it's scoped to the signed-in operator. The Connect button navigates directly to the Convex site URL's /auth/x/start — Convex Auth's HTTP-only cookie on the site origin lets getAuthUserId resolve without passing a token through the URL.
- Context: feat(x): OAuth 2.0 PKCE + bookmarks cron ingesting into inboxItems
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - convex
  - apps/web/app/_components/views/settings.tsx
## 2026-04-21T23:53:07.101Z
- Trigger: commit
- Learning: Connect X was returning 'Not signed in' because Convex Auth's session cookie lives on the Next.js origin, not the Convex site origin — direct browser navigation to convex.site/auth/x/start had no auth context. Fix: OAuth start now runs from a Next.js route handler at apps/web/app/api/auth/x/start/route.ts. The route verifies Next.js session via isAuthenticatedNextjs(), then fetchAction()s a new Convex action x.oauth.startForCaller with the Convex Auth token. The action generates PKCE verifier+challenge via Web Crypto, stores state in xOauthState via the existing internal mutation, builds the X authorize URL using the client_id in Convex env, and returns the URL. The Next.js route then 302s the browser to X. The callback HTTP action stays on Convex site (X calls it directly with code+state, no auth needed since state identifies the user). Removed the broken httpAction start and the unused authorizeUrl helper. Test passed end-to-end: OAuth consent → X redirects to Convex callback → token exchange + /users/me → inbox sync pulled 134 bookmarks with real tweet text as snippet (no more 'fetching…' placeholder).
- Context: fix(x): move OAuth start to Next.js route with Convex action
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - apps/web/app/api
  - convex/x/oauth.ts
  - convex/http.ts
  - apps/web/app/_components/views/settings.tsx
  - apps/web/next-env.d.ts
## 2026-04-22T00:01:30.463Z
- Trigger: commit
- Learning: Phase 2B.1 landed: drafts schema (channel with 7 values, ar/en, chars, analysisId, sourceItemId, genRunId for audit, createdAt, optional scheduled); channel-specific prompt templates in convex/generate/prompts.ts with per-channel length/tone/format briefs (X 280 punchy, IG feed 150-400, IG Reels caption 60-200, TikTok 80-300, YT Shorts 60-200, FB Page 200-600, LinkedIn 400-800, all Khaleeji-leaning AR); generate.draft.fromAnalysisOutput action reuses the analyze provider dispatch but passes a distinct DRAFT_TOOL + DRAFT_SYSTEM_PROMPT (providers.ts refactored to accept tool+system as args — backwards compatible, analyze still works). Promote button on Analyses tab is now wired — clicking a tweet output generates an X draft, reel output generates IG-Reel; website kind disabled until Phase 3. Drafts tab swapped seed data for live Convex queries (list + counts + approve/reject mutations) and expanded channel tabs to all 7 Postiz channels. Drafts grid now loads from Convex and shows state chips + Approve/Reject mutations wired. Shell no longer holds draft state locally — DraftsView fetches directly via useQuery. providerRuns rows track generate-draft runs separately from analyze runs via a 'purpose' field — budget.todaySpend aggregates across both naturally.
- Context: feat(drafts): text draft generation + 7-channel Drafts tab live on Convex
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - convex
  - apps/web/app/_components
## 2026-04-22T00:17:52.523Z
- Trigger: commit
- Learning: Phase 2 B.2 landed: five image-provider adapters in convex/generate/image/providers.ts, all fetch-based and staying in Convex V8 (no 'use node') so the module is safely importable from anywhere. Provider quirks discovered: (a) Nano Banana (Google Gemini 2.5 Flash Image) posts { contents: [{ parts: [{ text }] }] } to generativelanguage.googleapis.com with ?key=… query-string auth, and the response shape puts the base64 PNG at candidates[0].content.parts[*].inlineData.data; (b) OpenAI gpt-image-1 uses Bearer auth on api.openai.com/v1/images/generations and returns data[0].b64_json (distinct OPENAI_API_KEY from OPENROUTER_API_KEY — the two must not be reused); (c) Grok uses the same OpenAI-style endpoint at api.x.ai/v1/images/generations, model grok-2-image, response_format: 'b64_json'; (d) Ideogram is the odd one out — Api-Key header (NOT Bearer), multipart/form-data body (prompt, aspect_ratio, rendering_speed, num_images), and the response returns a signed URL at data[0].url that we must fetch a second time for the bytes; (e) OpenRouter exposes an OpenAI-compatible /images/generations with Bearer auth, routed to google/gemini-2.5-flash-image by default (overridable via OPENROUTER_IMAGE_MODEL env), reusing the existing OPENROUTER_API_KEY and HTTP-Referer/X-Title headers. MediaAssets flow: insert row with state 'generating' BEFORE calling the provider (so the UI can render a shimmer tile immediately via the by_draft index), then on success store the blob via ctx.storage.store (action-only API, needs a real action, not a node action — V8 action has storage.store), patch the row to 'ready' with storageId, and patch the parent draft with mediaKind='single-image' + imageProvider + imageModel; on failure patch to 'failed' with the error string and record a failed providerRun. providerRuns.provider union widened to include the five image providers so audit rows have real provenance instead of being squashed. AR text is intentionally NOT in the image prompt — the image is a clean background / illustration, the AR copy is overlaid later by HyperFrames (B.4), so the prompt explicitly forbids letters/glyphs/captions and asks the model to leave top-right + bottom-left quadrants empty for overlay. Video channels (ig-reel / tiktok / yt-shorts) are skipped with a 'video later' button — they need real video models in a future phase. Env vars operator must set: npx convex env set GOOGLE_API_KEY …, OPENAI_API_KEY …, GROK_API_KEY …, IDEOGRAM_API_KEY …; OPENROUTER_API_KEY already exists from text dispatch (also used by OpenRouter image). Optional: OPENROUTER_IMAGE_MODEL to override the OpenRouter routed model. Type gotcha repeated from B.1: the generateForDraft action handler needs explicit Promise<RunResult> annotation because it calls ctx.runQuery(internal.*) which otherwise cascades into recursive-inference errors in apps/web. UI additions: Drafts tab renders the first media asset per card (shimmer while generating, img when ready, HyperFrame fallback when no asset); Generate-image button opens an inline provider picker anchored over the card foot; Settings tab gains an Image provider tile section (persisted to settings.defaultImageProvider) plus a new env.imageKeys.imageKeysPresent auth-gated action exposing per-provider key presence so each Connections row can show 'configured' vs 'run npx convex env set …'.
- Context: feat(images): five image providers + single-image draft generation
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - convex/schema.ts
  - convex/settings/doc.ts
  - convex/generate/image/providers.ts
  - convex/generate/image/prompts.ts
  - convex/generate/image/internal.ts
  - convex/generate/image/action.ts
  - convex/mediaAssets/list.ts
  - convex/mediaAssets/url.ts
  - convex/env/imageKeys.ts
  - apps/web/app/_components/types.ts
  - apps/web/app/_components/views/drafts.tsx
  - apps/web/app/_components/views/settings.tsx
  - apps/web/next-env.d.ts
  - convex/_generated/api.d.ts
## 2026-04-22T00:21:29.892Z
- Trigger: commit
- Learning: Added optional autoSync:v.boolean() to xAccounts with undefined treated as true — no migration needed, existing rows default to on. Toggle only gates the 15-min cron (syncAll skips when acc.autoSync===false); the manual 'Sync now' button via syncMine deliberately bypasses it so the operator can always pull on demand. When off, the Settings X row shows a 'paused' Chip (state=new) next to @handle so the account reads as connected-but-paused at a glance. Schema addition is backwards-compatible; lastSyncAt/lastSyncError aren't touched for paused accounts (paused != broken).
- Context: feat(x): auto-sync toggle for bookmarks cron
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - apps/web/app/_components/views/settings.tsx
  - convex/schema.ts
  - convex/x/accounts.ts
  - convex/x/sync.ts
## 2026-04-22T00:59:50.065Z
- Trigger: commit
- Learning: satori + @resvg/resvg-wasm pair is V8-safe (both WASM: satori bundles yoga, resvg is a pure WASM module fetched from unpkg and cached via module-scope initWasm promise). Swapped the spec's @resvg/resvg-js for @resvg/resvg-wasm because the -js variant is native node addons that can't load in Convex's V8 runtime. Noto Naskh Arabic + JetBrains Mono fonts are fetched from fonts.gstatic.com once per cold action and cached in module-scope ArrayBuffers so subsequent composites skip the font round-trip. Overlays live in mediaAssets as sibling rows keyed by overlaidFrom — the base is preserved so the operator can regenerate text without losing the generated background, and a base/overlay toggle on the Drafts card lets them A/B the two. firstReadyByDraft now prefers the composite over the base so the UI auto-swaps once B.4 runs, with a separate baseReadyByDraft query backing the toggle's 'show base' path. No providerRuns row is written for a composite — it's local compute with no API cost — keeping costs accurate for the budget dashboard. Split the image-provider union into imageGeneratorType (5 external generators, used for user-selectable defaults + drafts.imageProvider) and imageProviderType (6 including 'hyperframes', used only on mediaAssets.provider) so settings and the generate action keep their narrow type while composites tag their origin cleanly.
- Context: feat(hyperframes): server-side overlay compositor
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - convex/schema.ts
  - convex/mediaAssets/list.ts
  - convex/settings/doc.ts
  - convex/generate/image/internal.ts
  - convex/generate/image/composite.ts
  - convex/generate/image/hyperframes.ts
  - apps/web/app/_components/types.ts
  - apps/web/app/_components/views/drafts.tsx
  - package.json
  - package-lock.json
  - convex/_generated/api.d.ts
## 2026-04-22T01:12:05.952Z
- Trigger: commit
- Learning: Carousel draft creation is split from image generation so the operator has a review gate on the script before spending on N image calls; styleAnchor + per-slide imagePrompt is the coherence vector since most image providers do not accept seeds; a dedicated carouselSlides table beats stuffing slides into drafts JSON because mediaAssets stays generic and future regeneration of one slide stays transactional; slidesForDraft query returns per-slot ordered results with composite-preferred, keeping firstReadyByDraft untouched for the single-image path; hyperframes composite() now accepts slideIndex/slideTotal and renders N/M in the top-right chip instead of AR; carousels ship for ig only in B.3 — FB and LinkedIn carousels deferred.
- Context: feat(carousel): IG carousel drafts with style-anchor + multi-slide HyperFrames overlay
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - convex/schema.ts
  - convex/generate/carousel.ts
  - convex/generate/carouselPrompts.ts
  - convex/generate/carouselInternal.ts
  - convex/generate/image/carouselAction.ts
  - convex/generate/image/compositeCarouselAction.ts
  - convex/generate/image/hyperframes.ts
  - convex/generate/image/internal.ts
  - convex/mediaAssets/list.ts
  - convex/carouselSlides/list.ts
  - apps/web/app/_components/app.tsx
  - apps/web/app/_components/views/analyses.tsx
  - apps/web/app/_components/views/drafts.tsx
  - apps/web/app/_components/views/draftsCarousel.tsx
## 2026-04-22T01:22:36.010Z
- Trigger: commit
- Learning: README was still the scaffold-era vision (Claude/Codex/Grok provider set, five apps/worker + packages/* that never got built, bannaa.co described as populated site). Rewrote to match what's actually live: pipeline diagram (X bookmark → analyze → drafts → image → HyperFrames overlay), 3 LLM providers (GLM default + Claude + OpenRouter) + 5 image providers (Nano Banana + GPT Image + Grok + Ideogram + OpenRouter), IG carousel branch with styleAnchor coherence, satori + @resvg/resvg-wasm compositor, complete env-var matrix with required-for column, accurate repo layout down to convex/generate/image/* submodules, scaffold rules (no direct useEffect in apps/web, no .js extensions, no use node on http-imported files, a11y relaxations scoped to apps/web). Dropped the Codex/Grok-text-LLM naming that predated the GLM switch. Kept MIT license.
- Context: docs(readme): rewrite to reflect shipped pipeline
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - README.md
## 2026-04-22T01:26:40.949Z
- Trigger: commit
- Learning: CI failed on B.3 (106257e) and subsequent commits because convex/_generated/api.d.ts wasn't included in the scoped commit paths. The subagent ran npx convex dev --once locally which regenerated the file, but commit:with-progress was called with convex/generate/carousel.ts etc. and didn't pick up the generated file. Pre-commit hook passes locally because the regenerated file is present on disk; CI builds against origin content which was stale. Fix is purely mechanical (commit the already-regenerated file). Going forward: commit:with-progress paths should include convex/_generated/api.d.ts whenever a new convex module is added, or the commit should be invoked with 'convex' as a path prefix rather than individual files.
- Context: chore(convex): regenerate api.d.ts for carousel exports
- Branch: main
- Actor: Ja3ood <moeghashim@users.noreply.github.com>
- Changed Paths:
  - convex/_generated/api.d.ts

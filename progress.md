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

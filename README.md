# bannaa-pipeline

Operator dashboard for a bilingual (EN/AR, Khaleeji-leaning) AI-education content pipeline. Ingests raw material from X, runs it through a switchable LLM for structured analysis, generates per-channel social drafts in Arabic, produces background images with five image providers, and composites final publish-ready PNGs with HyperFrames AR-text overlays. Every output lands in a human review queue — **nothing auto-publishes**.

Scope is deliberately narrow: **AI education only** — the tracks, concepts, and templates ontology is seeded minimally in Convex and grows via operator-approved additions.

## Stack

- **Next.js 15 + TypeScript** (App Router, Turbopack) — dashboard at `apps/web`
- **Convex** — storage, queries, mutations, actions, crons, file storage; dev deployment `shiny-hare-202`
- **Convex Auth** — magic-link sign-in via Resend; single-operator allowlist on `moe@bannaa.co`
- **LLM providers** (text, tool-use): **GLM 5.1** (default, via Zhipu OpenAI-compatible), **Claude Sonnet 4.6** (Anthropic native), **OpenRouter** (routed); default is stored in a Convex `settings` doc and can be flipped from the Settings tab
- **Image providers** (5, direct integrations): **Nano Banana** (Google Gemini 2.5 Flash Image), **GPT Image** (OpenAI gpt-image-1), **Grok** (xAI grok-2-image), **Ideogram v3**, **OpenRouter** (image routing)
- **HyperFrames** — server-side AR overlay compositor using **satori + @resvg/resvg-wasm**; Noto Naskh Arabic fetched from Google Fonts (module-cached)
- **X API v2** (OAuth 2.0 PKCE) — bookmarks ingest, 15-min cron with per-account auto-sync toggle
- **Resend** — magic-link email delivery today; newsletter delivery planned

Planned (not yet shipped): Postiz social publishing, newsletter composer, article/YouTube URL fetching, website-proposal PR opener.

## Pipeline

```
X bookmark (15-min cron or manual Sync now)
  ↓
inboxItems  ──  manual capture via Inbox capture bar also lands here
  ↓ Analyze  (GLM 5.1 tool-use — strict `record_analysis` schema)
analyses    ──  summary · concepts · key points · track (Foundations / Agents / Media) · suggested outputs
  ↓ Promote
drafts  (per-channel Khaleeji-AR)        7 channels: X / IG / IG Reels / TikTok / YT Shorts / FB Page / LinkedIn Page
  ↓ Generate image (per-draft, pick provider)
mediaAssets  (base PNG in Convex file storage)
  ↓ Overlay AR text (HyperFrames: satori → SVG → resvg → PNG)
mediaAssets  (composite PNG, linked via `overlaidFrom`)
```

For **Instagram feed** specifically, "Promote as IG carousel" branches into a 3–5-slide carousel: one LLM call produces a shared **styleAnchor** + per-slide AR text and image prompts; each slide renders through the same image-provider + HyperFrames stack, with an `N/M` slide-position chip in the top-right of every composite.

## Dashboard — seven tabs

- **Inbox** — captured items from X bookmarks (real tweet bodies after cron) + manual entries; filter by state / source; analyze button per item
- **Analyses** — structured LLM output with `Promote` buttons per suggested output (tweet → X, reel → IG Reel, website → deferred) and `Promote as IG carousel` with 3 / 4 / 5 slide picker
- **Drafts** — review queue across all 7 channels; `Generate image`, `Overlay AR text`, `Approve`, `Reject`; carousel strip for multi-slide; `base / overlay` toggle so the operator can see the raw image or the final composite
- **Reel Ideas**, **Newsletter**, **Website Proposals** — scaffolded, not yet wired (later phases)
- **Settings** — interactive tiles to switch default LLM provider and default image provider; connection status chips for every API key; X connection with `Auto-sync` toggle + `Sync now` + `Reconnect`

Keyboard: `⌘K` command palette, `G I` / `G A` / `G D` etc. for tab navigation, `J` / `K` list navigation on Inbox, `E` / `A` / `R` for edit / approve / reject, `⌘N` focuses the capture input.

## Repo layout

```
apps/web                  Next.js 15 dashboard (App Router)
  app/                    Routes, layout, providers, proxy middleware
    _components/          Shell, sidebar, chrome, palette, primitives, views/*
    api/auth/x/start/     Next.js route that kicks off X OAuth via Convex action
    sign-in/              Magic-link sign-in
  lib/use-mount-effect.ts Only allowed useEffect escape hatch in apps/web

convex/                   All backend
  auth.ts, auth.config.ts Convex Auth + Email (Resend) magic-link provider
  http.ts                 HTTP router (auth routes + /auth/x/callback)
  schema.ts               All tables; provider + channel + mediaKind unions
  analyze/                Analyze action + provider dispatch (Claude / GLM / OpenRouter)
  analyses/               Analyses queries
  inbox/                  Capture, list, get, reject, reopen
  drafts/                 List, counts, approve, reject, reopen
  generate/
    draft.ts              Per-channel text draft generator (LLM tool-use)
    prompts.ts            Channel-specific brief (tone, format, length) + DRAFT_TOOL
    image/
      providers.ts        Unified image-provider dispatch (5 adapters)
      prompts.ts          Single-image prompt builder (no AR/EN text in image)
      action.ts           generateForDraft
      composite.ts        overlayForDraft (HyperFrames single-image)
      compositeCarouselAction.ts  overlayCarouselForDraft
      hyperframes.ts      satori + resvg compositor helper
      internal.ts         Internal mutations for asset lifecycle
      carouselAction.ts   Sequential per-slide image gen
    carousel.ts           Carousel script generator (LLM)
    carouselPrompts.ts    CAROUSEL_TOOL + CAROUSEL_SYSTEM_PROMPT
    carouselInternal.ts   Carousel internal queries + insert mutations
  mediaAssets/            list: firstReadyByDraft (composite-preferred), slidesForDraft, etc.
  carouselSlides/         scriptForDraft query
  settings/doc.ts         Singleton settings doc (default LLM + image providers)
  budget/todaySpend.ts    AST-day cost aggregation across providerRuns
  x/                      OAuth 2.0 PKCE, bookmarks sync, account status, auto-sync toggle
  concepts/               Ontology seed + list
  users/me.ts             Identity query
  env/imageKeys.ts        Reports which image-provider keys are set (for Settings chips)
  config/active.ts        Active provider + model resolver
  crons.ts                15-min X bookmarks sync

packages/core             Shared TS library (scaffold, minimal usage today)
docs/                     Agent workflow + ADR + commands + Vercel deploy notes
scripts/                  Commit / progress / check tooling vendored from the starter
```

## Setup

Requires **Node 24** (pinned via `.nvmrc`). From the repo root:

```bash
npm install                 # installs all workspace deps
npx convex dev              # one-time: sign into Convex, project auto-created on first run
npm run dev -w @bannaa-pipeline/web   # Next.js dev on http://localhost:3000
```

### Convex env vars

Magic-link sign-in + the default LLM provider work with **GLM + Resend** alone. Every other feature is gated on the relevant key being set. Use `npx convex env set <KEY> <value>` for each.

| Purpose | Env var | Required for |
|---|---|---|
| Magic-link email | `RESEND_API_KEY`, `AUTH_EMAIL_FROM` (verified sender) | Sign-in |
| Operator allowlist (override) | `OPERATOR_EMAILS` (default `moe@bannaa.co`) | Restricting who can sign in |
| GLM (default text LLM) | `GLM_API_KEY`, optional `GLM_MODEL` (default `glm-5.1`) | Analysis + draft generation |
| Claude (optional text LLM) | `ANTHROPIC_API_KEY` | Switching default to Claude |
| OpenRouter (optional text + image routing) | `OPENROUTER_API_KEY`, optional `OPENROUTER_MODEL`, `OPENROUTER_IMAGE_MODEL` | OpenRouter as text or image provider |
| Default provider override | `DEFAULT_ANALYZE_PROVIDER` (`claude` / `glm` / `openrouter`) | Env-level default (Settings doc overrides this) |
| Nano Banana | `GOOGLE_API_KEY` | Gemini 2.5 Flash Image |
| GPT Image | `OPENAI_API_KEY` | `gpt-image-1` |
| Grok | `GROK_API_KEY` | xAI `grok-2-image` |
| Ideogram | `IDEOGRAM_API_KEY` | Ideogram v3 |
| X bookmarks | `X_CLIENT_ID`, `X_CLIENT_SECRET` | OAuth 2.0 PKCE + 15-min sync |

Auth-layer vars (`JWKS`, `JWT_PRIVATE_KEY`, `SITE_URL`) are set automatically by `npx @convex-dev/auth` on first run.

### Next.js env

`apps/web/.env.local`:

```
NEXT_PUBLIC_CONVEX_URL=https://<your-convex-deployment>.convex.cloud
```

Auto-written by `npx convex dev` on first run.

## Running the full stack

Two terminals:

```bash
# terminal 1
npx convex dev              # watches convex/, pushes on change, streams logs

# terminal 2
npm run dev -w @bannaa-pipeline/web
```

Open `http://localhost:3000`. If not signed in you'll be redirected to `/sign-in` — enter the operator email, click the magic link in the email, land on Inbox.

## Checks

```bash
npm run check         # biome (tabs, indentWidth 3, lineWidth 120) + file-length (600) + tsgo + per-workspace tsc
npm run build -w @bannaa-pipeline/web
```

Pre-commit hook (Husky) runs `npm run check` on every commit; failing check blocks the commit.

## Agent layer

The repo ships with vendored agent prompts and skills from PI-Starter's scaffold. See:

- [AGENTS.md](AGENTS.md) — operator conventions
- [`progress.md`](progress.md) — append-only learning log appended on every commit via `npm run commit:with-progress`
- [`docs/`](docs/) — workflow, agent skills, ADR template, Vercel deploy notes

Key rules enforced by Biome and the scaffold:

- No direct `useEffect` in `apps/web` — use `useMountEffect` from `apps/web/lib/use-mount-effect.ts`
- Relative imports in `apps/web` and `convex/` must **not** have a `.js` extension (Turbopack + Convex generated types rely on extensionless)
- No `"use node"` on files imported by `convex/http.ts` or other cross-called paths — keep compositor, image providers, and auth flows in V8 (satori + @resvg/resvg-wasm are V8-safe)
- Biome a11y rules are relaxed for `apps/web` in favor of the design's intentional styled-row + scrim patterns — applies only to apps/web, not packages

## License

MIT

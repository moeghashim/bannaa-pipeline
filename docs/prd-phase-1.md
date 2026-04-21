---
summary: "Phase 1 backend PRD — Convex schema, auth, manual capture, Claude analyze, live Inbox/Analyses wiring"
read_when:
  - Implementing the first backend slice of bannaa-pipeline.
  - Reviewing scope, acceptance criteria, or task breakdown for the first backend PR.
  - Picking up the project after Phase 1 to understand what was explicitly deferred.
---

# Phase 1 — End-to-end capture → analyze tracer

## Goal

Prove the core pipeline loop end-to-end with the simplest possible stack: an operator logs in, pastes a URL or note, the item persists in Convex, a Claude action extracts a structured analysis, and both the Inbox and Analyses tabs reflect live data. Nothing auto-publishes. No crons. No social / newsletter / website PRs. One provider (Claude). Minimal ontology, seeded by hand.

Success looks like: a brand-new visitor can sign in, drop a URL, and within ~30 seconds see an Analyses entry with a real LLM-extracted summary, concept tags, and suggested outputs — all from Convex.

## In scope

- Convex Auth — single-operator today, schema ready for team
- Convex prod deployment provisioned alongside the existing dev (`shiny-hare-202`)
- Convex schema for: `users`, `inboxItems`, `analyses`, `concepts`, `providerRuns`
- Manual capture mutation (paste URL or freeform text)
- Source auto-detection server-side (x / youtube / article / manual) — mirrors client detection
- Claude analyze action with strict JSON tool-use extracting: `summary`, `concepts[]`, `keyPoints[]`, `outputs[]`, `track`
- Provider-run audit trail (tokens, cost, runAt, provider) for the budget surface
- Live `useQuery` wiring on Inbox (list + detail) and Analyses (list + diff pane)
- Reject / re-open inbox item state transitions
- Track budget spend (read-only display; no enforcement yet)
- Minimal concept ontology seeded with ~20 starter concepts (from the demo data already in `apps/web/app/_components/data.ts`)
- Auth-gated `/` — unauthenticated visitors see a sign-in screen

## Out of scope (explicitly deferred)

- Cron ingestion (X bookmarks, YouTube, RSS)
- Article fetching (will return "fetching…" placeholder until Phase 2)
- Multi-provider (Codex, Grok) — Claude only for now
- Drafts generation, HyperFrames rendering
- Reel Ideas generation
- Newsletter composition and Resend send
- Website Proposals persistence or GitHub PRs (tab still shows seed data — direction still unresolved)
- Postiz scheduling
- Budget enforcement (we track; we do not yet pause/degrade)
- Team membership / roles

## User stories

### S1 — Operator sign-in
_As the operator, I visit the dashboard and sign in via Convex Auth so only I can see and act on captured items._
- Unauthenticated → redirected to a minimal sign-in screen
- Successful sign-in lands on `/` with the Inbox tab active
- Session persists across reloads

### S2 — Capture a URL or note
_As the operator, I paste any URL or type a freeform note in the Capture bar and it lands in Convex as an `inboxItem` with state `new`._
- Source is auto-detected server-side (x / youtube / article / manual)
- New item appears at the top of the Inbox list in real time
- `captured` timestamp is set to server time
- Freeform notes store `raw` text in `snippet` and set `length` to word count

### S3 — Run analysis on a single item
_As the operator, I click Analyze on a `new` item and it transitions to `analyzing` → `draft` with real Claude output written to Convex._
- State transitions are observed live in the dashboard (via Convex subscriptions)
- On success: an `analyses` row is inserted linked to the inbox item
- On failure: item returns to `new`, an `error` field is populated, operator can retry
- Time from click to `draft` should be < 30 seconds for a short text input

### S4 — Review analysis output
_As the operator, I open the Analyses tab and see the structured extraction for any analyzed item._
- Summary, concepts (tag pills), keyPoints (bullet list), suggested outputs (tweet / reel / website hooks) all render
- Provider, run timestamp, tokens, and cost shown in the metadata row
- Re-run control is visible but a no-op in Phase 1 (wired in Phase 2)

### S5 — Reject out-of-scope items
_As the operator, I reject inbox items that fall outside AI-education scope; the LLM does not auto-reject._
- Reject mutation sets state to `rejected`
- Rejected items remain visible in the list but filtered out by default
- `rejected` filter in the Inbox segmented control surfaces them

### S6 — See budget spend
_As the operator, I can see today's aggregate spend on analyses in the hint bar or Settings._
- Value is computed from `providerRuns` with `runAt >= today 00:00 AST`
- Displayed in USD; no enforcement behavior yet

## Technical design

### Convex schema (new tables)

```ts
// convex/schema.ts
users: defineTable({
  email: v.string(),
  displayName: v.optional(v.string()),
  createdAt: v.number(),
}).index("by_email", ["email"]);

inboxItems: defineTable({
  source: v.union(v.literal("x"), v.literal("youtube"), v.literal("article"), v.literal("manual")),
  handle: v.string(),
  title: v.string(),
  snippet: v.string(),
  raw: v.optional(v.string()),           // full text for manual notes
  url: v.optional(v.string()),
  lang: v.union(v.literal("en"), v.literal("ar")),
  state: v.union(
    v.literal("new"),
    v.literal("analyzing"),
    v.literal("draft"),
    v.literal("approved"),
    v.literal("rejected"),
    v.literal("published"),
  ),
  length: v.union(v.number(), v.string()),   // word count or duration
  capturedBy: v.id("users"),
  captured: v.number(),                  // ms epoch
  error: v.optional(v.string()),
}).index("by_state", ["state"])
  .index("by_capturedBy", ["capturedBy"]);

analyses: defineTable({
  itemId: v.id("inboxItems"),
  provider: v.literal("claude"),         // Phase 1: Claude only
  runAt: v.number(),
  summary: v.string(),
  concepts: v.array(v.string()),         // concept names, validated against `concepts` table
  keyPoints: v.array(v.string()),
  track: v.union(v.literal("Foundations"), v.literal("Agents"), v.literal("Media")),
  outputs: v.array(v.object({
    kind: v.union(v.literal("tweet"), v.literal("reel"), v.literal("website")),
    hook: v.string(),
  })),
  runId: v.id("providerRuns"),
}).index("by_itemId", ["itemId"]);

concepts: defineTable({
  name: v.string(),                      // e.g. "attention", "agent loop"
  track: v.union(v.literal("Foundations"), v.literal("Agents"), v.literal("Media")),
  approved: v.boolean(),                 // seeded concepts = true; LLM-suggested = false until operator approves
  createdAt: v.number(),
}).index("by_name", ["name"])
  .index("by_track", ["track"]);

providerRuns: defineTable({
  provider: v.literal("claude"),
  model: v.string(),                     // "claude-sonnet-4-5"
  purpose: v.string(),                   // "analyze", "generate-tweet", etc.
  itemId: v.optional(v.id("inboxItems")),
  inputTokens: v.number(),
  outputTokens: v.number(),
  cost: v.number(),                      // USD
  runAt: v.number(),
  error: v.optional(v.string()),
}).index("by_runAt", ["runAt"]);
```

### Auth — Convex Auth

- Use `@convex-dev/auth` with the simplest viable provider for single-operator: **magic-link email** (no OAuth app required on day one).
- `auth.config.ts` restricts sign-in to a hard-coded allowlist of one email (the operator's). Future: promote to a table-driven allowlist.
- All dashboard queries / mutations / actions require `ctx.auth.getUserIdentity()` → 401 otherwise.

### Analyze action — Claude tool-use schema

Single tool definition. The LLM must call the tool; we reject free-text responses.

```ts
{
  name: "record_analysis",
  input_schema: {
    type: "object",
    required: ["summary", "concepts", "keyPoints", "track", "outputs"],
    properties: {
      summary: { type: "string", minLength: 200, maxLength: 1200 },
      concepts: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 8 },
      keyPoints: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 6 },
      track: { type: "string", enum: ["Foundations", "Agents", "Media"] },
      outputs: {
        type: "array", minItems: 1, maxItems: 5,
        items: {
          type: "object",
          required: ["kind", "hook"],
          properties: {
            kind: { type: "string", enum: ["tweet", "reel", "website"] },
            hook: { type: "string", minLength: 40, maxLength: 280 },
          },
        },
      },
    },
  },
}
```

The system prompt constrains scope (AI education only), concept selection (prefer existing concepts from the ontology, mark new ones for operator review), and tone (Khaleeji-leaning for any AR content — though Phase 1 analyses are EN).

### Dashboard wiring changes

- Replace hardcoded seed data imports with `useQuery(api.inbox.list)` and `useQuery(api.analyses.list)`.
- `onCapture` in `apps/web/app/_components/app.tsx` becomes a `useMutation(api.inbox.capture)` call; drop the simulated setTimeout transitions.
- `onAnalyze` calls `useAction(api.analyze.run)`.
- `onReject` mutation wired to Inbox detail reject button.
- Sidebar user block reads the current Convex Auth identity instead of hardcoded "Mohammed".

## Task breakdown

### Setup

- [ ] Provision Convex prod deployment and capture `CONVEX_DEPLOY_KEY` + `NEXT_PUBLIC_CONVEX_URL` for `apps/web` prod env
- [ ] Add `@convex-dev/auth` and configure magic-link provider with single-email allowlist
- [ ] Add Resend credentials for magic-link delivery (reuse the Resend setup planned for newsletter; scope the API key narrowly)

### Schema + seed

- [ ] Write `convex/schema.ts` with the five tables above
- [ ] Write `convex/concepts/seed.ts` — idempotent migration that upserts ~20 starter concepts from `apps/web/app/_components/data.ts`
- [ ] Run seed once against dev; re-run procedure documented in `docs/`

### Auth

- [ ] `convex/auth.ts` — Convex Auth with magic-link provider + operator email allowlist
- [ ] Sign-in page at `apps/web/app/sign-in/page.tsx`
- [ ] Middleware: redirect unauthenticated requests from `/` to `/sign-in`
- [ ] Replace hardcoded sidebar user block with live identity

### Capture + analyze

- [ ] `convex/inbox/capture.ts` — mutation: accepts raw string, detects source, inserts `inboxItems` row, returns id
- [ ] `convex/inbox/list.ts` + `convex/inbox/get.ts` — queries with auth check and state filter arg
- [ ] `convex/inbox/reject.ts` — mutation: state → rejected
- [ ] `convex/analyze/run.ts` — action: loads item, calls Claude with tool schema, writes `analyses` + `providerRuns`, updates item state new → analyzing → draft
- [ ] `convex/analyses/list.ts` + `convex/analyses/get.ts` — queries
- [ ] `convex/budget/todaySpend.ts` — query: sum of `providerRuns.cost` where `runAt >= startOfDayAST`

### Frontend wiring

- [ ] Install `convex` client provider in `apps/web/app/layout.tsx` (wrapped in `ConvexAuthProvider`)
- [ ] Delete seed-data imports from `app.tsx`; swap to `useQuery` / `useMutation` / `useAction`
- [ ] Remove the simulated state-transition `setTimeout`s from `onCapture` / `onAnalyze` — Convex will drive the UI state via subscription
- [ ] Hint bar reads `budget/todaySpend` instead of the hardcoded string
- [ ] Error surfaces: capture / analyze failures show a toast or inline error row

### Tests

- [ ] Convex function unit tests for `capture` (all four source detections), `reject`, and `analyze` (with Claude mocked)
- [ ] Tool-schema validation test — invalid payload is rejected, state stays `analyzing`, error is recorded
- [ ] Type-check passes; `npm run check` clean

## Acceptance criteria

1. `npm run check` passes clean on all changes.
2. `npm run build -w @bannaa-pipeline/web` produces a deployable build against prod Convex env vars.
3. Unauthenticated visitor hitting `/` is redirected to `/sign-in` and can complete magic-link flow with the operator email.
4. Pasting `https://x.com/karpathy/status/1234567890` into the Capture bar lands a new `inboxItems` row with `source="x"`, `handle="@karpathy"`, `state="new"` within 2 seconds.
5. Clicking Analyze on a `new` item transitions to `analyzing`, then to `draft` with a populated `analyses` row in < 30 seconds.
6. The Analyses tab renders summary / concepts / keyPoints / outputs exactly as stored; no client-side mocking remains.
7. Reject button moves an item to `rejected`; the `rejected` filter surfaces it.
8. Today's spend in the hint bar matches the sum of `providerRuns.cost` entries for today (AST).
9. Refreshing the page does not re-run analyze or re-capture anything.
10. A Claude failure (429, 5xx, or schema-invalid response) leaves the item in `new` with `error` populated and is retryable.

## Open questions (not blocking Phase 1 implementation)

1. **Budget over-cap behavior** — pause new analyses, degrade to cheaper model, or keep going and alert? Phase 1 only tracks; enforcement lands in a later PR.
2. **Media track scope** — currently interpreted as "exclude Media except video." Confirm before Phase 2 (draft generation) so the generator prompts handle it correctly.
3. **Website Proposals tab direction** — given bannaa.co has no real content, do we (a) still PR to bannaa.co once it exists, (b) keep the tab as a local store of future site content, or (c) drop the tab entirely? Affects Phase 3+.
4. **Ontology provenance** — Phase 1 seeds from the design's demo concepts. Long-term: operator-curated in Convex with LLM-suggested additions needing approval. Confirm that's the intended flow.
5. **Drafts channels** — frontend currently shows X / IG / IG Reels / TikTok / YT Shorts. Needs FB Page + LinkedIn Page added to match Postiz reality. Cosmetic; lands with Phase 2 drafts work.

## Estimated effort

~2–3 days of focused work for one implementer. Most risk is in Convex Auth wiring (first time in this repo) and the Claude tool-use payload validation.

# bannaa-pipeline

Content pipeline feeding [bannaa.co](https://bannaa.co) — a bilingual (EN/AR) AI-education site.

Ingests X posts, YouTube videos, articles, and manual entries; runs them through a switchable LLM (Claude / Codex / Grok); generates social drafts, short-form video, a weekly newsletter, and website-content PRs back to the bannaa.co repo.

**Scope:** AI education only — tracks, concepts, and templates territory.
**Rule:** Nothing auto-publishes. Every draft lands in a review queue.

## Stack

- Next.js 15 + TypeScript (dashboard in `apps/web`)
- Convex (storage, crons, workers)
- HyperFrames (graphics + MP4 rendering)
- Postiz (social publishing, self-hosted)
- Resend (newsletter — bannaa.co domain verified)
- youtube-transcript, X API v2
- LLM provider switch per run: Claude / Codex / Grok

## Monorepo layout

```
apps/web              Dashboard (Inbox · Analyses · Drafts · Reel Ideas · Newsletter · Website Proposals · Settings)
apps/worker           Convex functions + crons           (planned)
packages/core         Shared library
packages/ai           Provider-agnostic LLM client       (planned)
packages/ingest       x, youtube-transcript, article, rss, manual  (planned)
packages/generate     tweet, ig-post, tiktok, short, reel, newsletter, website-copy  (planned)
packages/render       HyperFrames compositions           (planned)
packages/publish      Postiz, Resend, GitHub PR opener   (planned)
```

## Locale rules

- Social drafts: **AR only**
- Website proposals: **EN + AR**

## Setup

```bash
npm run doctor
npm install
npm run check
npm test
npm run agent:check
```

If you switch between `arm64` and `x64`, or between Rosetta and native Node, run `npm run reinstall:clean`.

## Agent layer

See [AGENTS.md](AGENTS.md) for agent conventions, [`progress.md`](progress.md) for the append-only learning log, and [`docs/`](docs/) for workflow docs.

## License

MIT

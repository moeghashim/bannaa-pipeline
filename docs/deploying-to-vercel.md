---
summary: "Minimal Vercel deployment path for the default Next.js app workspace"
read_when:
  - Setting up the starter on Vercel for the first time.
  - Shipping changes from `apps/web`.
---

# Deploying To Vercel

Use Vercel Git integration as the default deployment path for this starter.

This document remains the canonical PI Starter deployment baseline even if you vendor additional upstream Vercel deployment skills later.

## Project Settings

- Framework preset: Next.js
- Root directory: `apps/web`
- Install command: `npm install`
- Build command: `npm run build`

## Build Quality Gates

Vercel builds are deploy packaging only. When Vercel sets `VERCEL=1`, `apps/web/next.config.ts` skips Next.js production TypeScript validation so type errors do not block deployment after CI has already checked the branch.

Next.js 16 does not run linting during `next build`; keep linting and type checking in CI with `npm run check`.

GitHub Actions owns the required quality gate. The `CI` workflow runs `npm run check`, `npm test`, and `npm run agent:check` on pull requests and on pushes to `main`. Protect `main` by requiring the `Required checks` status check before merge.

## Environment Variables

Start with no extra environment variables unless your app adds them. Configure app-specific secrets in the Vercel project, scoped to `apps/web`.

## Solo Shipping Flow

1. Run `npm run check`
2. Run `npm test`
3. Run `npm run agent:check`
4. Open a pull request and wait for `Required checks` to pass
5. Merge to `main`
6. Let Vercel Git integration build and deploy `apps/web`

This starter does not require a custom `vercel.json`.

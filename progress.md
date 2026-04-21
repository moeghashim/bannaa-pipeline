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

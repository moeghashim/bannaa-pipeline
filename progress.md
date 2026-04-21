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

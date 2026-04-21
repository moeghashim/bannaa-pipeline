# /ship

Purpose: ship solo changes cleanly without a PR workflow.

Workflow:
1. Confirm whether the target is an app deploy, a package release, or both.
2. Run full validation (`npm run check`, `npm test`, `npm run agent:check`).
3. If the change affects behavior, review it against `agent/skills/addyosmani/code-review-and-quality`.
4. If the change affects trust boundaries, auth, input handling, or third-party integrations, review it against `agent/skills/addyosmani/security-and-hardening`.
5. If the change alters repo conventions, interfaces, or architecture, record or update an ADR under `docs/adrs/` using `docs/architecture-decisions.md`.
6. If shipping the app, treat `docs/deploying-to-vercel.md` as the starter's canonical deployment path.
7. If shipping a package, run the correct `npm run release:<patch|minor|major> -- --learning "..."` command and pass `--publish` only when intentionally publishing.
8. Summarize what shipped, which validations ran, and any manual follow-up.

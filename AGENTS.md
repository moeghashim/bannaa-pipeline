# Development Rules

## Code Quality
- No `any` types unless absolutely necessary.
- Check `node_modules` for external API type definitions instead of guessing.
- NEVER use inline imports:
  - no `await import("./foo.js")`
  - no `import("pkg").Type` in type positions
  - no dynamic imports for types
  - always use standard top-level imports
- Never remove functionality to fix type errors from outdated dependencies; upgrade dependencies instead.
- Always ask before removing functionality that appears intentional.

## Style
- ESM TypeScript.
- Relative imports must include `.js` extension.
- Keep public APIs in `src/index.ts` (re-export), keep internals in separate modules.
- No emojis in commit messages or code comments.

## React App Rules
- In `apps/web`, do not import `useEffect` directly.
- Prefer render-time derivation, event handlers, and framework data loading over effects.
- `useMountEffect` is the only allowed mount-only escape hatch for synchronizing with an external system.

## Commands
- After code changes (not docs changes): `npm run check`
- Fix all errors, warnings, and infos before committing.
- Keep `node_modules` machine-local. After moving between `darwin-x64`, `darwin-arm64`, Linux, or Rosetta/native modes, run `npm install` or `npm run reinstall:clean` before using native-tooling commands.

## Agent Workflow
- Agent workflow docs live in `docs/agent-workflow.md`, skill guidance in `docs/agent-skills.md`, and command index in `docs/commands.md`.
- At task start, review recent entries in `progress.md` to understand prior learnings.
- Run `npm run docs:list` whenever docs are added or updated.
- Run `npm run skills:verify-sync` after changing vendored Vercel skills or their pinned manifest.
- Run `npm run skills:addy:verify-sync` after changing vendored Addy Osmani skills or their pinned manifest.
- Run `npm run agent:check` before handoff to validate docs front matter, AGENTS structure, and vendored sync integrity.
- Use `npm run commit:selective -- "type(scope): summary" "path/one" "path/two"` for path-scoped commits.
- For agent-requested commits, use `npm run commit:with-progress -- "type(scope): summary" --learning "what was learned" -- "path/one" "path/two"` so `progress.md` is appended in the same commit.

## Git
- Never commit unless explicitly requested.
- Keep commit subjects as normal, human-readable summaries (for example `feat(core): add retry guard`).
- Do not replace commit messages with prompt text.
- `progress.md` is append-only: only add new entries at the end; never edit prior entries.
- For substantial agent-generated changes, add a `Repro-Prompt:` trailer in the commit message body.

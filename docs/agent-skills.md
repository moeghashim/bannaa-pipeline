---
summary: "Curated vendored Vercel and Addy Osmani agent skills plus the policy for keeping both pinned"
read_when:
  - Working on React, Next.js, UI review, or interaction patterns in this starter.
  - Working on context setup, testing strategy, review rigor, security checks, or ADRs in this starter.
  - Updating vendored skills from `vercel-labs/agent-skills` or `addyosmani/agent-skills`.
  - Deciding whether a new upstream skill belongs in the default starter layer.
---

# Agent Skills

PI Starter vendors two small upstream skill subsets so repo-local workflows can reference stable, pinned guidance without inheriting an entire external workflow.

## Pinned Upstream

### Vercel UI Pack

- Source repo: `https://github.com/vercel-labs/agent-skills`
- Manifest: `agent/skills-manifest.json`
- Sync command: `npm run skills:sync`
- Verify command: `npm run skills:verify-sync`

### Addy Process Pack

- Source repo: `https://github.com/addyosmani/agent-skills`
- Manifest: `agent/skills-manifest.addyosmani.json`
- Sync command: `npm run skills:addy:sync`
- Verify command: `npm run skills:addy:verify-sync`

## Vendored Skills

### Vercel UI Pack

- `agent/skills/vercel-labs/react-best-practices`
- `agent/skills/vercel-labs/composition-patterns`
- `agent/skills/vercel-labs/react-view-transitions`
- `agent/skills/vercel-labs/web-design-guidelines`

- building or refactoring React and Next.js code
- reviewing UI code for accessibility or web interaction issues
- designing component APIs that should avoid prop sprawl
- adding view transitions or route-level motion

### Addy Process Pack

- `agent/skills/addyosmani/context-engineering`
- `agent/skills/addyosmani/test-driven-development`
- `agent/skills/addyosmani/code-review-and-quality`
- `agent/skills/addyosmani/documentation-and-adrs`
- `agent/skills/addyosmani/security-and-hardening`

- setting up or recovering task context at the start of a session
- proving behavior with failing tests first or regression tests
- reviewing a change across correctness, readability, architecture, security, and performance
- recording architecture decisions and durable rationale in repo-local docs
- hardening features that accept input, handle auth, or integrate external services

## Selection Guide

| Need | Prefer |
| --- | --- |
| React, Next.js, UI, interaction, transitions, composition | Vercel UI pack |
| Session setup, test discipline, review rubric, security, ADR workflow | Addy process pack |
| A task crosses both domains | Load the smallest relevant skill from each pack |

## What Stays Local

The starter keeps its own canonical workflow docs in `docs/` and its own deployment baseline in `docs/deploying-to-vercel.md`.

We intentionally do not vendor every upstream skill into the default starter. The following are currently excluded on purpose:

- `deploy-to-vercel`: broad operational workflow that overlaps with this starter's local deployment doc
- `vercel-cli-with-tokens`: token-handling workflow that should stay opt-in
- `react-native-skills`: outside the default web-first starter scope
- most Addy slash-command, persona, and hook files: useful upstream, but not part of this starter's repo-local default layer
- broad git, CI/CD, and shipping skills that would duplicate local release, progress-log, and deployment rules

## Update Flow

1. Review the relevant upstream `skills/` tree and decide whether the curated subset should change.
2. Update the matching manifest with the new pinned commit or curated-scope changes.
3. Run the matching sync command:
   - `npm run skills:sync` for Vercel
   - `npm run skills:addy:sync` for Addy
4. Run the matching verify command:
   - `npm run skills:verify-sync` for Vercel
   - `npm run skills:addy:verify-sync` for Addy
5. Run `npm run docs:list` if this doc or other docs changed.
6. Run `npm run agent:check` before handoff or ship.

## Multi-Machine Note

`docs:list`, `skills:sync`, `skills:verify-sync`, `skills:addy:sync`, and `skills:addy:verify-sync` are Node-only and should work even when native packages need reinstalling.

`npm run check` still depends on native packages such as Biome, esbuild, and the TypeScript native preview build. After moving between `darwin-x64`, `darwin-arm64`, Linux, or Rosetta/native modes, reinstall dependencies on that machine before running `npm run check`.

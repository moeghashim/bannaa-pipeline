---
summary: "Documentation index and front-matter contract for bannaa-pipeline"
read_when:
  - Adding or editing documentation in this repository.
  - Setting up agent workflows, ADRs, and docs validation.
---

# Docs

This folder contains operational docs used by humans and coding agents.

## Front-Matter Contract

Every markdown file in `docs/` must include YAML front matter with:

- `summary`: concise one-line description.
- `read_when`: non-empty list of situations when this doc should be read.

Validation is enforced by `npm run docs:list`.

## Current Docs

- `docs/agent-workflow.md`: codex-first agent workflow and guardrails.
- `docs/agent-skills.md`: curated vendored Vercel and Addy Osmani skills plus the update policy.
- `docs/architecture-decisions.md`: ADR template and local conventions for recording durable technical decisions.
- `docs/commands.md`: in-repo command prompt index.
- `docs/deploying-to-vercel.md`: minimal Vercel deployment path for `apps/web`.

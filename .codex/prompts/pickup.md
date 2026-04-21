# /pickup

Purpose: rehydrate context quickly before doing implementation work.

Checklist:
1. Read `AGENTS.md` and any relevant docs under `docs/`.
2. Read `docs/agent-skills.md` if the task touches React, Next.js, UI review, transitions, testing strategy, review rigor, security, or ADR decisions.
3. If UI or interaction work is involved, consult the relevant vendored skill under `agent/skills/vercel-labs/`.
4. If process rigor, testing, review, security, or ADR work is involved, consult the relevant vendored skill under `agent/skills/addyosmani/`.
5. Use the `context-engineering` skill to load only the minimum durable context needed for the current task.
6. Review recent entries in `progress.md` and summarize the key learnings that apply to this task.
7. Run `git status -sb` and summarize working tree state.
8. Identify current branch and any related release or deploy context.
9. Run or review the latest `npm run check`, `npm test`, and `npm run agent:check` results.
10. List the next 2-3 concrete actions before editing.

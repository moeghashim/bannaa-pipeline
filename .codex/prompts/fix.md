# /fix

Purpose: fix a bug or issue end-to-end with regression safety.

Workflow:
1. Reproduce and isolate the root cause.
2. Write or identify a failing test, repro script, or equivalent proof before claiming the fix.
3. If the fix touches React, Next.js, UI review, or transitions, read `docs/agent-skills.md` and consult the relevant vendored Vercel skill before editing.
4. Consult `agent/skills/addyosmani/test-driven-development` and `agent/skills/addyosmani/security-and-hardening` when the issue changes behavior or touches a trust boundary.
5. Implement the smallest safe fix.
6. Add or update regression tests.
7. Run `npm run check`, `npm test`, and `npm run agent:check`.
8. Summarize behavior change, repro coverage, tests added, and residual risks.

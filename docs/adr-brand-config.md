---
summary: "ADR: externalize brand tone, visual design, and generation provenance"
read_when:
  - Editing the Brand tab, brand schema, prompt rendering, or generation provenance.
  - Reviewing why brand edits are live but version publishing is explicit.
---

# ADR: Brand config

## Decision

Brand tone and visual design live in Convex `brands`, with immutable snapshots in `brandVersions`. Generation reads the active brand at call time and records `brandVersion` plus `promptVersion` on `providerRuns`.

## Alternatives considered

- Keep brand strings in prompt/image code. Rejected because every tone or design change would require a deploy.
- Auto-bump brand version on every edit. Rejected because mid-edit versions would make approval-rate comparisons noisy.

## Rationale

Live edits keep iteration fast, while explicit publish keeps version analytics meaningful. Seeded defaults preserve the previous Khaleeji/Bannaa behavior until the operator edits the active brand.

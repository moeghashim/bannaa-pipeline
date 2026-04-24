---
summary: "ADR: capture explicit draft and media feedback with provenance"
read_when:
  - Editing feedback controls, feedback rollups, or regenerate-with-feedback behavior.
  - Reviewing brand and prompt quality metrics.
---

# ADR: Feedback loop

## Decision

Explicit feedback is stored in a `feedback` table keyed by target kind and target id. Each row records rating, tags, note, author, run provenance, brand version, and prompt version.

## Alternatives considered

- Store feedback directly on drafts/media rows. Rejected because one draft can have multiple targets and provenance needs to stay tied to the generating run.
- Auto-edit brand config from feedback tags. Rejected for v1 because operator review should remain the control point.

## Rationale

A separate feedback table keeps ratings queryable across drafts, media assets, carousel slides, brand versions, and prompt versions. This supports quality rollups without mutating generation artifacts.

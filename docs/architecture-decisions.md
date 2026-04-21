---
summary: "ADR template and local conventions for recording durable technical decisions in PI Starter"
read_when:
  - Making an architectural or workflow decision that should remain discoverable after the current session.
  - Updating repo conventions, public interfaces, deployment strategy, or agent workflow structure.
  - Applying the vendored `documentation-and-adrs` skill to a PI Starter change.
---

# Architecture Decisions

Use an ADR when a decision changes how this starter should be extended, operated, or reasoned about later.

## When To Write One

- adding or replacing a major dependency or framework
- changing public package APIs or workspace boundaries
- altering release, deployment, or validation workflow
- changing the agent layer in a way future sessions must preserve
- making a decision that would be expensive to reverse

## Location

Store ADRs in `docs/adrs/` using filenames in the form `YYYY-MM-DD-short-title.md`.

## Template

```md
---
summary: "One-line decision summary"
read_when:
  - Working on the area this decision affects.
  - Re-evaluating this technical choice.
---

# Title

## Status

Accepted | Superseded | Deprecated | Proposed

## Context

What problem or constraint forced this decision?

## Decision

What did we choose?

## Consequences

What becomes easier, harder, or required because of this choice?

## Alternatives Considered

- Option A: why it was not selected
- Option B: why it was not selected
```

## Notes

- Keep ADRs short and biased toward rationale over narrative.
- Link the affected docs, prompts, or code paths when useful.
- If a later ADR replaces an earlier one, update the old ADR status instead of rewriting history.

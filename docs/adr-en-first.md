---
summary: "ADR: make English primary copy and treat Arabic as generated translations"
read_when:
  - Editing draft generation, translation, language chips, or publish language selection.
---

# ADR: EN-first output

## Decision

Draft generation now writes English `primary` copy first. Secondary outputs are stored in `translations[]` and generated on demand through `generateTranslation`.

## Alternatives considered

- Continue generating Arabic and English together. Rejected because it couples markets and spends translation tokens before the operator approves the core message.
- Keep legacy `ar`/`en` indefinitely. Rejected after the migration overlap because it leaves two sources of truth for generated copy.

## Rationale

The migration overlap let new drafts follow the EN-first contract while old rows still rendered through fallbacks. After the migration ran and legacy reads were removed, the schema was narrowed so `primary` and `translations[]` are the only persisted language surfaces.

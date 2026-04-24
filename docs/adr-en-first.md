---
summary: "ADR: make English primary copy and treat Arabic as generated translations"
read_when:
  - Editing draft generation, translation, language chips, or publish language selection.
  - Planning the follow-up schema narrow that removes legacy ar/en fields.
---

# ADR: EN-first output

## Decision

Draft generation now writes English `primary` copy first. Secondary outputs are stored in `translations[]` and generated on demand through `generateTranslation`.

## Alternatives considered

- Continue generating Arabic and English together. Rejected because it couples markets and spends translation tokens before the operator approves the core message.
- Remove legacy `ar`/`en` immediately. Rejected because existing rows and UI paths need an overlap deploy before schema narrowing.

## Rationale

The overlap model lets new drafts follow the EN-first contract while old rows still render through fallbacks. The follow-up narrow can remove `ar` and `en` after the migration has run and legacy reads are confirmed gone.

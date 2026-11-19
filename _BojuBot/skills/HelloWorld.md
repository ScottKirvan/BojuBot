---
category: General
description: Compare the active note against another note in the vault
autorun: true
params:
  - id: reference_note
    type: obsidianmd_note
    label: Note to compare against
    validations:
      required: true
---
Compare the active note with the attached reference note.

Highlight:
1. Shared concepts or overlapping points.
2. Contradictions or divergences.
3. Recommended cross-links to add between them.
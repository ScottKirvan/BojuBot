# Slash Command Params — Feature Design Spec

**Status: IMPLEMENTED** — fully implemented as the BojuBot skills system (`SlashParamModal.ts`, `SkillLoader.ts`). The `note` type is resolved as full content attachment; `checkboxes` produces comma-separated string. Claude Code format (`arguments:`, `$ARGUMENTS`) also supported.

## Overview

Extend the slash command template system to support **parameterized prompts**: when a command template defines input fields in its frontmatter, BojuBot presents a modal form before executing, collects user input, interpolates the values into the prompt body, and either inserts the result into the chat input or fires it directly.

This turns static prompt templates into reusable **skills** — structured, repeatable agentic workflows that don't require the user to manually edit the template each time.

---

## Frontmatter Schema

Templates define their form fields via a `params` key in YAML frontmatter — a **sequence of mappings** (array of objects). This is valid YAML but outside Obsidian's flat Properties type system; the Properties panel may render it awkwardly, but the raw file is unaffected. Command templates should be documented as not intended for editing via Obsidian Properties.

### Reference: GitHub Issue Forms

The schema design is intentionally aligned with [GitHub's issue forms syntax](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-githubs-form-schema). Where field names overlap (`label`, `placeholder`, `options`, `validations`), use GitHub's conventions. BojuBot-specific extensions (`autorun`, `type: note`) are additive and clearly differentiated.

### Supported Field Types (v1)

| Type         | Description                                                        |
| ------------ | ------------------------------------------------------------------ |
| `input`      | Single-line text field                                             |
| `textarea`   | Multi-line text field                                              |
| `dropdown`   | Select from a fixed list of options                                |
| `checkboxes` | One or more boolean toggles                                        |
| `note`       | Obsidian-native vault note picker (resolves to note title or path) |

### Field Properties

| Property               | Required       | Description                                  |
| ---------------------- | -------------- | -------------------------------------------- |
| `id`                   | Yes            | Variable name used in `{{interpolation}}`    |
| `type`                 | Yes            | One of the supported types above             |
| `label`                | Yes            | Human-readable field label shown in the form |
| `description`          | No             | Helper text shown below the label            |
| `placeholder`          | No             | Placeholder text for `input` / `textarea`    |
| `options`              | Yes (dropdown) | Array of string values                       |
| `default`              | No             | Pre-filled value                             |
| `validations.required` | No             | If `true`, blocks submission when empty      |

### Additional Frontmatter Keys

| Key           | Description                                                                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `autorun`     | If `true`, executes immediately after form submit (or immediately if no `params`). If absent or `false`, inserts into chat input for review. |
| `category`    | Groups the command under a named heading in the `/` menu                                                                                     |
| `description` | Short subtitle shown below the command name in the menu                                                                                      |

---

## Variable Interpolation

Use `{{id}}` syntax in the template body. After form submission, all `{{id}}` occurrences are replaced with the corresponding field values before the prompt is dispatched or inserted.

**Unresolved variables** (optional fields left blank): strip `{{id}}` and collapse any resulting double whitespace/blank lines. Do not leave visible `{{placeholder}}` tokens in the output.

---

## Execution Flow

```
User selects command from / menu
        │
        ▼
Does frontmatter have `params`?
  ├─ Yes → Present modal form
  │           │
  │           ▼
  │         User fills fields and submits
  │           │
  │           ▼
  │         Interpolate {{vars}} into prompt body
  │           │
  │           ▼
  │         autorun: true? ──Yes──► Execute prompt directly
  │                         │
  │                        No
  │                         │
  │                         ▼
  │                   Insert into chat input
  │
  └─ No → autorun: true? ──Yes──► Execute prompt directly
                           │
                          No
                           │
                           ▼
                     Insert into chat input
```

---

## Example Templates

### Bug Report (parameterized, autorun)

```markdown
---
category: GitHub
description: File a bug report on any repo
autorun: true
params:
  - id: repo
    type: input
    label: Repository
    placeholder: owner/repo
    validations:
      required: true
  - id: title
    type: input
    label: Bug title
    validations:
      required: true
  - id: severity
    type: dropdown
    label: Severity
    options: [low, medium, high, critical]
    default: medium
  - id: body
    type: textarea
    label: Description
    placeholder: Steps to reproduce, expected vs actual behavior...
---
File a GitHub issue in the {{repo}} repository.

Title: {{title}}
Severity: {{severity}}

{{body}}
```

### Weekly Review (no params, insert mode)

```markdown
---
category: Reviews
description: Structured weekly review
---
Review my notes from this week and give me a summary of:
- What I worked on
- Any open threads or unresolved questions
- Suggested priorities for next week
```

### Note Summarizer (Obsidian-native picker)

```markdown
---
category: Writing
description: Summarize a vault note
params:
  - id: target_note
    type: note
    label: Note to summarize
    validations:
      required: true
---
Summarize the following note concisely, preserving key decisions and open questions:

{{target_note}}
```

---

## Implementation Notes

- Parse frontmatter with the same YAML library already in use; `params` will deserialize as an array of objects naturally.
- Modal form fields should be generated dynamically from the `params` array in order.
- `validations.required: true` must show an inline error on the field — do not silently fail or show a generic alert.
- The `note` type requires integration with the Obsidian vault file index; resolve to the note's title or vault-relative path based on what makes most sense for prompt injection.
- Template files reload each time the `/` menu opens — no restart required after authoring a new template.
- Command templates should live in a folder not intended for regular vault browsing (`_commands/` recommended as the documented default path). Note in docs that Obsidian's Properties UI does not support nested YAML and templates should not be edited via that panel.

---

## Open Questions

- **`note` type resolution**: inject note title, path, or full note content into the prompt? Probably title/path by default, with an optional `resolve: content` property to inline the full text.
- **Multi-select**: should `checkboxes` produce a comma-separated string or a YAML list in the interpolated output?
- **Form layout**: single-column modal vs. responsive grid for wider screens?
- **Validation beyond required**: max length, regex patterns — out of scope for v1 but worth reserving field names for.

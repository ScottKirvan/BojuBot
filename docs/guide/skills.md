# Skills

A **skill** is a markdown file that gives Claude a defined mission. Skills live in your skills folder and appear in the `/` menu — and optionally in the Obsidian command palette — ready to run on demand.

Skills range from simple reusable prompts to fully parameterized agentic workflows. Because Claude runs with full tool access, a skill can read and write vault notes, run shell commands, call APIs, and more. If you can describe it in a prompt, you can make it a skill.

## File format

A skill file is a standard markdown file with optional YAML frontmatter:

```markdown
---
category: Reviews
description: Structured weekly review
autorun: true
params:
  - id: focus
    type: input
    label: Any specific focus area?
    placeholder: Leave blank for a full review
---
Review my notes from this week. Give me:
- What I worked on
- Open threads or unresolved questions
- Suggested priorities for next week

{{focus}}
```

The frontmatter controls how the skill appears in the menu and how it behaves. The body is the prompt Claude receives.

## Frontmatter reference

| Field         | Type    | Default   | Description                                                                         |
| ------------- | ------- | --------- | ----------------------------------------------------------------------------------- |
| `category`    | string  | `Prompts` | Groups the skill under a named heading in the `/` menu                              |
| `description` | string  | *(none)*  | Short subtitle shown below the skill name                                           |
| `autorun`     | boolean | `false`   | If `true`, executes immediately. If `false`, inserts into the chat input for review |
| `params`      | array   | *(none)*  | Form fields presented to the user before the skill runs                             |

## `params` fields

When `params` is defined, BojuBot shows a modal form before running the skill. Each entry is an object with the following properties:

| Property               | Required                   | Description                                                  |
| ---------------------- | -------------------------- | ------------------------------------------------------------ |
| `id`                   | Yes                        | Variable name used in `{{interpolation}}` in the prompt body |
| `type`                 | Yes                        | Field type — see below                                       |
| `label`                | Yes                        | Human-readable label shown in the form                       |
| `description`          | No                         | Helper text shown below the label                            |
| `placeholder`          | No                         | Placeholder text for `input` and `textarea` fields           |
| `options`              | Yes (dropdown, checkboxes) | Array of string values                                       |
| `default`              | No                         | Pre-filled value                                             |
| `validations.required` | No                         | If `true`, blocks submission when the field is empty         |

### Field types

| Type              | Description                                                                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `input`           | Single-line text field                                                                                                                                                 |
| `textarea`        | Multi-line text field                                                                                                                                                  |
| `dropdown`        | Select from a fixed list of options                                                                                                                                    |
| `checkboxes`      | One or more boolean toggles — result is a comma-separated string                                                                                                       |
| `obsidianmd_note` | Vault note picker — fuzzy search over all vault notes; injects the **full note content** as an attachment (same as @-mention). Alias: `note` (legacy, still supported) |

### Variable interpolation

Use `{{id}}` in the prompt body to reference field values. After submission:

- **Non-note fields** are interpolated inline.
- **Note fields** are added as context attachments (shown as badges above the input, just like @-mention). The `{{id}}` token is stripped from the body — the note content arrives via the attachment, not inline text.
- Unresolved tokens (optional fields left blank) are stripped cleanly. No visible `{{placeholder}}` tokens appear in the output.

### Handling optional parameters

Interpolation only strips the `{{id}}` token itself — any static label text you wrote around it stays. If an optional `textarea` param is left blank, a body like:

```
**Additional instructions:** {{extra_notes}}
```

leaves a dangling `**Additional instructions:**` with nothing after it. It's harmless, but noisy, and can read like a cut-off instruction to Claude.

Wrap optional parameters in XML-style tags instead:

```
<extra_instructions>
{{extra_notes}}
</extra_instructions>
```

Claude treats XML-like tags as semantic containers, so this pattern handles both cases cleanly:

- **Empty** — Claude sees a clearly-bounded empty block and ignores it.
- **Populated** — the user's content is unambiguously scoped, so it can't blend into the skill's own surrounding instructions.

This matters most for free-text fields (`input`, `textarea`) where the user might paste in dense or instruction-like text. Use it for any optional parameter, not just the ones that happen to be empty most of the time.

**Keep internal protocol details out of skill bodies.** Skills intended for general use should describe actions in plain language ("open the file in Obsidian") and let Claude's system context handle the mechanics — don't embed raw UI Bridge trigger syntax directly in a skill prompt body.

## Execution modes

| `autorun` | `params` | Behaviour                                          |
| --------- | -------- | -------------------------------------------------- |
| `false`   | none     | Inserts prompt body into chat input for review     |
| `true`    | none     | Fires immediately; shows `Running: <name>` in chat |
| `false`   | defined  | Shows form → inserts filled prompt into chat input |
| `true`    | defined  | Shows form → fires immediately on submit           |

## Skills folder

**Default:** `_BojuBot Skills/` — at your vault root. This keeps skills in your vault, making them easy to edit and sync with Obsidian Git.

**Custom:** set **Settings → BojuBot → Skills folder** to:
- A vault-relative path (e.g. `_skills`) — keeps skills in your vault, synced with Obsidian Git
- An absolute path — for a shared folder outside the vault

Skills reload each time you open the `/` menu, so changes take effect immediately with no restart.

## Examples

### Simple autorun

```markdown
---
category: Writing
description: Summarize the active note
autorun: true
---
Summarize the currently active note concisely, preserving key decisions and open questions.
```

### Weekly review with optional focus

```markdown
---
category: Reviews
description: Structured weekly review
autorun: true
params:
  - id: focus
    type: input
    label: Focus area (optional)
    placeholder: Leave blank for a full review
---
Review my notes from this week and give me:
- What I worked on
- Open threads or unresolved questions
- Suggested priorities for next week

{{focus}}
```

### Bug report with form

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
    placeholder: Steps to reproduce, expected vs actual behavior…
---
File a GitHub issue in {{repo}}.

Title: {{title}}
Severity: {{severity}}

{{body}}
```

### Note summarizer using vault picker

```markdown
---
category: Writing
description: Summarize any vault note
autorun: true
params:
  - id: target_note
    type: obsidianmd_note
    label: Note to summarize
    validations:
      required: true
---
Summarize the attached note concisely, preserving key decisions and open questions.
```

The picked note is injected as a context attachment — Claude reads it exactly as it would read an @-mentioned note.

### Programming agent

```markdown
---
category: Code
description: Implement a feature in this repo
autorun: true
params:
  - id: feature
    type: textarea
    label: What should I build?
    placeholder: Describe the feature in plain language…
    validations:
      required: true
  - id: context_note
    type: obsidianmd_note
    label: Relevant design note (optional)
---
You are acting as a senior software engineer working in this vault's codebase.

Task: {{feature}}

Read the relevant files, understand the existing architecture, implement the feature, and write a brief summary of what you changed and why.
```

## Ctrl+P integration

Enable **Settings → Register skills as Ctrl+P commands** to expose every skill as an Obsidian command palette entry, prefixed `Skill: …`.

After adding or removing skill files, run **BojuBot: Reload skills** from the palette to sync. You can also assign hotkeys to individual skills via **Settings → Hotkeys** — search for `Skill:` to find them all.

See the [Skills API](./commands#skills-api) section of the Commands reference for details.

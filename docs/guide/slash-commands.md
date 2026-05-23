# Slash Commands

The `/` menu gives you quick access to built-in BojuBot actions and your own **skills** — all without leaving the chat panel.

## Opening the menu

**Toolbar button** — click the `/` button in the input toolbar. A menu opens with a search box. Type to filter, use arrow keys to navigate, Enter to execute, Escape to close.

**Inline trigger** — type `/` in the chat input, preceded by a space or at the start of the input. A compact menu appears above the input. Navigate with arrow keys, Enter executes, Escape or any other key dismisses it.

::: tip
`/` only triggers the menu when preceded by a space or at the start of the input. Typing `and/or` or `https://...` never opens the menu.
:::

## Built-in commands

| Category    | Command           | What it does                             |
| ----------- | ----------------- | ---------------------------------------- |
| **Session** | New session       | Start a fresh conversation               |
| **Session** | Show history      | Browse and resume past sessions          |
| **Session** | Export session    | Save the current session to your vault   |
| **Context** | Attach file       | Add a file, image, or URL to the prompt  |
| **Context** | Open context file | Edit your persistent vault context       |
| **Context** | Refresh context   | Re-inject vault context into the session |
| **Context** | Open settings     | Open BojuBot settings                    |

## Skills

Skills are the real power of the `/` menu. A skill is a markdown file that gives Claude a defined mission — from a simple reusable prompt to a fully parameterized agentic workflow.

Drop a `.md` file in your skills folder and it appears in the menu instantly. No restart required.

**Default folder:** `<plugin dir>/commands/` — inside the plugin directory, gitignored by default.

**Custom folder:** set **Settings → BojuBot → Skills folder** to any vault-relative path (e.g. `_skills`) or absolute path.

See the **[Skills reference](./skills)** for the full file format, all frontmatter fields, and examples.

### Quick example

```markdown
---
category: Writing
description: Summarize the active note
autorun: true
---
Summarize the currently active note concisely, preserving key decisions and open questions.
```

Save this as `_skills/Summarize Note.md`. It appears under **Writing** in the `/` menu. Selecting it fires immediately — no extra steps.

### Parameterized skills

Skills can define form fields that BojuBot presents as a modal before running:

```markdown
---
category: GitHub
description: File a bug report
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
---
File a GitHub issue in {{repo}} titled "{{title}}".
```

The user fills in the form, hits **Run**, and Claude gets a precisely scoped prompt. No prompt editing required.

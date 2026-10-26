# Context System

BojuBot injects context at the start of each new session so the agent understands your vault before you ask your first question. Nothing extra is injected on later turns: those resume the same conversation, which is far cheaper.

---

## 1. System Orientation

Automatically injected at every new session — no configuration needed. Tells the agent what BojuBot is, that it's operating inside Obsidian, what tools it has, and how to interact with the UI.

---

## 2. Vault Tree

A folder and file name overview of your vault. **Only names are listed — no file contents are read.** Hidden files and folders (starting with `.`) are skipped.

Configure depth in **Settings → BojuBot → Vault tree depth**:

| Setting         | What the agent sees                                  |
| --------------- | ---------------------------------------------------- |
| Off *(default)* | No vault tree — the agent discovers structure on demand |
| 1 level         | Root-level folders and files only                    |
| 2 levels        | Root + one sublevel                                  |
| 3 levels        | Root + two sublevels                                 |
| Unlimited       | Full tree at any depth                               |

With **Off**, the agent uses the vault query protocol to list files when it needs them, so nothing is paid upfront (except in Chat only, where vault queries are refused). Enable a depth if you find the agent frequently needs to browse the vault and you'd prefer it to have that awareness from the start of the session.

---

## 3. Context File (Persistent Memory)

A markdown file injected at the start of every session. Default path: `_claude-context.md` at your vault root. This is the agent's **persistent memory** — it survives across sessions and syncs with your vault.

### Getting started

When you first open BojuBot, a setup dialog offers three options:

- **Generate with Claude** — the agent set in **Settings → BojuBot → Agent** (Claude Code or Antigravity) scans your vault structure and writes a context file tailored to your folders and naming conventions. You'll be asked one optional question first: *"Tell me a little about yourself and how you use this vault."* The more you share, the more personalised the result — but it's entirely optional.
- **Create blank template** — Gives you a pre-structured file with placeholder sections to fill in yourself.
- **Skip** — Skips setup for now. You can relaunch it any time via **BojuBot: Open context file** from the palette — if the file doesn't exist yet, the setup dialog reopens automatically.

Check **Open context file after creation** in the dialog to have it opened for you as soon as it's ready, whichever of the first two options you pick.

### What to put in it

```markdown
# My Vault Context

## About this vault
A personal knowledge base for screenwriting research and script development.

## Conventions
- Meeting notes go in 02_Calendar/YYYY-MM-DD format
- Projects live in 06_Spaces/Projects/
- Use #status/active and #status/done tags

## Current focus
Working on Q2 planning. Key notes: [[Q2 Goals]], [[Team Roster]]

## Notes for the agent
Prefer concise bullet-point summaries. Always ask before deleting files.

_Last updated: 2026-04-13_
```

Think of it as a briefing document — tell the agent who you are, how your vault is organised, what's currently in focus, and any standing preferences.

### `_claude-context.md` vs the agent's own instruction files

Each agent CLI also reads instruction files of its own from its working directory: Claude Code reads `CLAUDE.md`, and Antigravity reads `GEMINI.md` and `AGENTS.md`. They serve a similar purpose to BojuBot's context file, but have distinct roles:

|                        | `_claude-context.md`                                     | `CLAUDE.md` / `GEMINI.md` / `AGENTS.md`                              |
| ---------------------- | -------------------------------------------------------- | -------------------------------------------------------------------- |
| **Read by**            | BojuBot, which injects it at session start, for either agent | The agent CLI itself (Claude Code: `CLAUDE.md`; Antigravity: `GEMINI.md`, `AGENTS.md`) |
| **Location**           | Configurable — any path in or outside the vault          | The working directory (the vault root by default)                    |
| **Purpose**            | Vault-specific: who you are, how you work, current focus | Project/repo instructions: architecture, conventions, build commands |
| **Editable from**      | BojuBot: Open context file command                       | Any text editor                                                      |
| **Travels with vault** | Yes — it's a vault note                                  | Yes — it's a tracked file                                            |
| **Updated by the agent** | Yes, when Autonomous memory is on                      | No — the agent reads it; BojuBot never asks it to update the file    |

**When to use both:** an instruction file at the vault root works as a fallback — the agent CLI reads it regardless of BojuBot. Use it for technical/project-level instructions that apply everywhere. Use `_claude-context.md` for personal context, vault conventions, and the evolving notes that Autonomous memory maintains. It also works the same whichever agent you use.

**When `_claude-context.md` wins:** it can live anywhere (configurable path), it's updated by the agent automatically, and it doesn't need to be at the vault root. If you use BojuBot across multiple vaults, each can have its own context file at a different path without touching the agent's instruction files.

### Keeping it fresh

The context file can go stale as your vault evolves. A few habits that help:

- **Add a datestamp** (`_Last updated: YYYY-MM-DD_`) so the agent — and you — can tell how fresh it is
- **Turn on Autonomous memory** (see section 7) and let the agent maintain it as it learns your vault
- **Run "Refresh session context"** from the palette to re-inject the file into an active session after editing it

The context file path is configurable in **Settings → BojuBot**.

---

## 4. Active Note

The path of the currently open note is prepended to every message — e.g. `[Active note: 06_Spaces/Projects/Alpha.md]`. The agent always knows which note you're looking at.

**Split-pane awareness:** When you have multiple notes open side by side, BojuBot injects all visible file paths instead — e.g. `[Open in split view: Notes/A.md | Projects/B.md]`. Toggle in **Settings → Inject split-pane files as context**.

In **Chat only** none of this is sent: the agent isn't told which notes you have open. See [Permissions](./permissions#chat-only).

---

## 5. Per-note Frontmatter Context

Add BojuBot properties to any note's frontmatter to control how the agent treats it.

| Property               | Value      | Effect                                                     |
| ---------------------- | ---------- | ---------------------------------------------------------- |
| `bojubot-context`      | `always`   | Full note content injected at every session start          |
| `bojubot-instructions` | any string | Instruction injected telling the agent how to treat this file |

**Pin a note to every session** (e.g. a project brief or style guide):

```yaml
---
bojubot-context: always
---
```

**Give the agent standing instructions for a file:**

```yaml
---
bojubot-instructions: "Always write in present tense and keep bullets under 10 words."
---
```

**Both together:**

```yaml
---
bojubot-context: always
bojubot-instructions: "This is the team writing guide — apply its rules to any note you edit."
---
```

::: warning Partial file protection
You can use `bojubot-instructions` to tell the agent not to modify a file — e.g. `"Read for reference only. Do not edit."` This works well in practice but is convention, not enforcement. For truly critical files, keep a backup or use git history.
:::

---

## 6. Custom Session (Shift+click)

When you **Shift+click** the **+** button to customize a session before it starts, two additional context options become available:

**Initial instructions** — a free-text system prompt you supply at session creation. Injected as a `## Session instructions` block after all vault layers. It takes effect on the first turn and stays part of the conversation, so it isn't sent again on later turns.

**Suppress vault context** — uncheck "Include vault context" to skip layers 2–5 (vault tree, context file, memory instruction, pinned notes, per-file instructions). The system orientation (Layer 1 — permission mode, tools) is always injected. Use this for focused code sessions where vault-specific context would be noise.

::: tip
A typical code-project session: set cwd to your repo, uncheck vault context, add a `CLAUDE.md` or README as an attachment, and write a brief role instruction. The agent starts with exactly what it needs and nothing extra.
:::

See [Sessions → Starting a new session](./sessions.md) for the full Custom Session dialog reference.

---

## 7. Autonomous Memory

When **Autonomous memory** is on (default), the agent is instructed to actively maintain the context file as it learns about your vault — naming conventions, ongoing projects, your preferences. It updates the file directly using its file-editing tools; you can inspect and edit it at any time.

Disable in **Settings → BojuBot → Autonomous memory** if you prefer to manage it manually, or if your vault is shared.

### Keeping the context file from growing too large

Over time, autonomous memory can accumulate more than the agent needs. Set **Settings → BojuBot → Memory file size limit (tokens)** to a token ceiling (e.g. `4000`). When the file exceeds that limit, the agent receives an instruction at the start of the session to compact it before the session ends — summarizing redundant entries and dropping outdated observations. The full file is still read; nothing is silently discarded.

Leave the limit at `0` (default) to disable this behaviour.

### Two kinds of memory

|                   | Session memory (the conversation)              | Autonomous memory (context file)     |
| ----------------- | ---------------------------------------------- | ------------------------------------ |
| **What**          | Full conversation history                      | Key facts the agent chose to remember |
| **How long**      | As long as the agent CLI keeps the conversation | Permanent (until you edit or delete) |
| **Cross-machine** | No — the agent CLI stores it on this computer (Claude Code in `~/.claude/`, Antigravity under `~/.gemini/`) | Yes — travels with vault sync        |
| **Size**          | 10KB–several MB per session on Claude Code      | As small as you keep it              |
| **Inspectable**   | No                                             | Yes — it's a markdown file           |

::: tip Cross-machine sessions
Claude Code's conversation files are keyed to the vault's absolute path, and Antigravity's live in its own store on each computer. Resuming a session from another machine requires the agent's conversation to be present on that machine (for Claude Code, at the same absolute path) — generally not practical. Use the context file for cross-machine continuity.
:::

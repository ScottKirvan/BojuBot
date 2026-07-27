# Context System

BojuBot injects context at the start of each new session so Claude understands your vault before you ask your first question. Nothing extra is injected on subsequent turns — those use session resumption (`--resume`), which is far cheaper.

---

## 1. System Orientation

Automatically injected at every new session — no configuration needed. Tells Claude what BojuBot is, that it's operating inside Obsidian, what tools it has, and how to interact with the UI.

---

## 2. Vault Tree

A folder and file name overview of your vault. **Only names are listed — no file contents are read.** Hidden files and folders (starting with `.`) are skipped.

Configure depth in **Settings → BojuBot → Vault tree depth**:

| Setting         | What Claude sees                                     |
| --------------- | ---------------------------------------------------- |
| Off *(default)* | No vault tree — Claude discovers structure on demand |
| 1 level         | Root-level folders and files only                    |
| 2 levels        | Root + one sublevel                                  |
| 3 levels        | Root + two sublevels                                 |
| Unlimited       | Full tree at any depth                               |

With **Off**, Claude uses the vault query protocol to list files when it needs them, so nothing is paid upfront. Enable a depth if you find Claude frequently needs to browse the vault and you'd prefer it to have that awareness from the start of the session.

---

## 3. Context File (Persistent Memory)

A markdown file injected at the start of every session. Default path: `_claude-context.md` at your vault root. This is Claude's **persistent memory** — it survives across sessions and syncs with your vault.

### Getting started

When you first open BojuBot, a setup dialog offers three options:

- **Generate with Claude** — Claude scans your vault structure and writes a context file tailored to your folders and naming conventions. You'll be asked one optional question first: *"Tell me a little about yourself and how you use this vault."* The more you share, the more personalised the result — but it's entirely optional.
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

## Notes for Claude
Prefer concise bullet-point summaries. Always ask before deleting files.

_Last updated: 2026-04-13_
```

Think of it as a briefing document — tell Claude who you are, how your vault is organised, what's currently in focus, and any standing preferences.

### `_claude-context.md` vs `CLAUDE.md`

BojuBot's context file and Claude Code's native `CLAUDE.md` serve similar purposes but have distinct roles:

|                        | `_claude-context.md`                                     | `CLAUDE.md`                                                          |
| ---------------------- | -------------------------------------------------------- | -------------------------------------------------------------------- |
| **Read by**            | BojuBot (injected at session start)                      | Claude Code CLI natively on every spawn                              |
| **Location**           | Configurable — any path in or outside the vault          | Project root by convention                                           |
| **Purpose**            | Vault-specific: who you are, how you work, current focus | Project/repo instructions: architecture, conventions, build commands |
| **Editable from**      | BojuBot: Open context file command                       | Any text editor                                                      |
| **Travels with vault** | Yes — it's a vault note                                  | Yes — it's a tracked file                                            |
| **Updated by Claude**  | Yes, when Autonomous memory is on                        | No — Claude Code reads it, doesn't write it                          |

**When to use both:** `CLAUDE.md` at the vault root works as a fallback — Claude Code reads it on every spawn regardless of BojuBot. Use it for technical/project-level instructions that apply everywhere. Use `_claude-context.md` for personal context, vault conventions, and the evolving notes that Autonomous memory maintains.

**When `_claude-context.md` wins:** it can live anywhere (configurable path), it's updated by Claude automatically, and it doesn't need to be at the vault root. If you use BojuBot across multiple vaults, each can have its own context file at a different path without touching `CLAUDE.md`.

### Keeping it fresh

The context file can go stale as your vault evolves. A few habits that help:

- **Add a datestamp** (`_Last updated: YYYY-MM-DD_`) so Claude — and you — can tell how fresh it is
- **Turn on Autonomous memory** (see section 7) and let Claude maintain it as it learns your vault
- **Run "Refresh session context"** from the palette to re-inject the file into an active session after editing it

The context file path is configurable in **Settings → BojuBot**.

---

## 4. Active Note

The path of the currently open note is prepended to every message — e.g. `[Active note: 06_Spaces/Projects/Alpha.md]`. Claude always knows which note you're looking at.

**Split-pane awareness:** When you have multiple notes open side by side, BojuBot injects all visible file paths instead — e.g. `[Open in split view: Notes/A.md | Projects/B.md]`. Toggle in **Settings → Inject split-pane files as context**.

---

## 5. Per-note Frontmatter Context

Add BojuBot properties to any note's frontmatter to control how Claude treats it.

| Property               | Value      | Effect                                                     |
| ---------------------- | ---------- | ---------------------------------------------------------- |
| `bojubot-context`      | `always`   | Full note content injected at every session start          |
| `bojubot-instructions` | any string | Instruction injected telling Claude how to treat this file |

**Pin a note to every session** (e.g. a project brief or style guide):

```yaml
---
bojubot-context: always
---
```

**Give Claude standing instructions for a file:**

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
You can use `bojubot-instructions` to tell Claude not to modify a file — e.g. `"Read for reference only. Do not edit."` This works well in practice but is convention, not enforcement. For truly critical files, keep a backup or use git history.
:::

---

## 6. Custom Session (Shift+click)

When you **Shift+click** the **+** button to customize a session before it starts, two additional context options become available:

**Initial instructions** — a free-text system prompt you supply at session creation. Injected as a `## Session instructions` block after all vault layers. It takes effect on the first turn and is cached with `--resume`, so it's not re-charged on subsequent turns.

**Suppress vault context** — uncheck "Include vault context" to skip layers 2–5 (vault tree, context file, memory instruction, pinned notes, per-file instructions). The system orientation (Layer 1 — permission mode, tools) is always injected. Use this for focused code sessions where vault-specific context would be noise.

::: tip
A typical code-project session: set cwd to your repo, uncheck vault context, add a `CLAUDE.md` or README as an attachment, and write a brief role instruction. Claude starts with exactly what it needs and nothing extra.
:::

See [Sessions → Starting a new session](./sessions.md) for the full Custom Session dialog reference.

---

## 7. Autonomous Memory

When **Autonomous memory** is on (default), Claude is instructed to actively maintain the context file as it learns about your vault — naming conventions, ongoing projects, your preferences. Claude updates the file directly using its file-editing tools; you can inspect and edit it at any time.

Disable in **Settings → BojuBot → Autonomous memory** if you prefer to manage it manually, or if your vault is shared.

### Keeping the context file from growing too large

Over time, autonomous memory can accumulate more than Claude needs. Set **Settings → BojuBot → Memory file size limit (tokens)** to a token ceiling (e.g. `4000`). When the file exceeds that limit, Claude receives an instruction at the start of the session to compact it before the session ends — summarizing redundant entries and dropping outdated observations. The full file is still read; nothing is silently discarded.

Leave the limit at `0` (default) to disable this behaviour.

### Two kinds of memory

|                   | Session memory (`--resume`)                    | Autonomous memory (context file)     |
| ----------------- | ---------------------------------------------- | ------------------------------------ |
| **What**          | Full conversation history                      | Key facts Claude chose to remember   |
| **How long**      | Until the Claude Code session expires          | Permanent (until you edit or delete) |
| **Cross-machine** | No — stored in `~/.claude/` locally            | Yes — travels with vault sync        |
| **Size**          | 10KB–several MB per session (plain JSON lines) | As small as you keep it              |
| **Inspectable**   | No                                             | Yes — it's a markdown file           |

::: tip Cross-machine sessions
Session files are keyed to the vault's absolute path. Resuming a session from another machine requires the same absolute path AND the session file present on that machine — generally not practical. Use the context file for cross-machine continuity.
:::

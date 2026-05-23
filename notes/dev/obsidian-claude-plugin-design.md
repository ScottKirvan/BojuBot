# ObsidiBot — Architecture Reference

**Status:** As-built (reflects v2.16.x, May 2026)  
**Replaces:** Pre-development design doc (v0.1, "Pre-development")

---

## What It Is

ObsidiBot is an Obsidian plugin that embeds the Claude Code CLI as a managed subprocess. It provides a chat panel inside Obsidian where Claude can read, write, and organize vault notes — with the user in control of what Claude can access and what it can do. No API key is required; it rides a Claude Pro/Max subscription via the CLI.

Desktop only (Electron/Node). No mobile support.

---

## Goals

- Replicate the Claude Code / VS Code panel experience inside Obsidian
- Make the full vault available as Claude's working context
- Provide intelligent, user-controlled context injection rather than brute-force full-vault loading
- Support writing, planning, organizing, and scripting workflows that Obsidian users actually do
- Be distributable to anyone with Claude Code installed — no additional billing

---

## Non-Goals

- Mobile support (desktop/Electron requirement)
- Multi-vault support
- Direct Anthropic API integration (subprocess only — no API key)
- Real-time collaboration

---

## Architecture

### Process Model

```
Obsidian (Electron renderer)
  └── child_process.spawn(
        'powershell.exe',
        ['-NonInteractive', '-Command', "& 'claude.exe' ...args"],
        { cwd: vaultRoot }
      )
        └── claude CLI process
              ├── reads/writes vault files directly
              ├── executes bash/PowerShell commands
              └── streams output via --output-format stream-json
```

Key decisions (locked — don't revisit without discussion):

- **PowerShell wrapper on Windows**: `powershell.exe -NonInteractive -Command "& 'claude.exe' ..."` — direct spawn and cmd.exe both silently swallow stdout in Electron.
- **Prompt via stdin, not CLI arg**: `proc.stdin.write(prompt); proc.stdin.end()`. Avoids all Windows shell-quoting issues (smart quotes, special chars). `proc.stdin.end()` is required or Claude hangs.
- **Flags**: `--output-format stream-json --verbose --print` + permission-mode args. `--verbose` is required with `stream-json + --print`.
- **Session resume**: `--resume <sessionId>` on every turn after the first. Uses `cache_read_input_tokens` (~10x cheaper than re-sending history). Do NOT manually prepend history.
- **Env**: `CLAUDECODE` var deleted from spawn env or Claude refuses nested launch.
- **cwd**: vault root for all spawns.

### Session Storage

Session metadata lives in `.obsidian/obsidibot/sessions/<id>.json`. Actual conversation history stays in `~/.claude/projects/` (managed by the Claude CLI). Session files contain:

- Session ID, title, created/updated timestamps
- Sort order (for drag-and-drop reorder in session manager)
- Active permission mode

Sessions are not vault-portable — the `.jsonl` history files live in the global Claude projects directory, not the vault. Session metadata is small and tracks state only.

### Context Injection Stack

What gets injected at session start (new session, first turn):

| Layer | Source | Tokens (approx) | Always? |
|---|---|---|---|
| Orientation | `src/orientation.md` compiled into `main.js` | ~2,000–2,500 | Yes |
| Permission summary | Injected into orientation placeholders | ~50 | Yes |
| Vault tree | `src/utils/fileTree.ts` | 0 (default off) | If depth > 0 |
| Context file | `_claude-context.md` (configurable) | Variable | If file exists |
| Per-note frontmatter `instructions` | Vault metadata scan | Variable | If notes have it |
| Autonomous memory directive | Short instruction block | ~100 | If setting enabled |

After session start, context is cached by the Claude API as `cache_read_input_tokens` at ~10x cost reduction. A 5-minute inactivity gap expires the cache (server-side TTL) — next turn pays 1.25x to re-prime it.

The orientation block (`src/orientation.md`) is compiled into `main.js` via esbuild's text loader — it is NOT a user-accessible vault file. The `@@CORTEX_ACTION` and `@@CORTEX_QUERY` strings in it are an attack surface; they must never be written to user-readable vault files.

### Skills System

Skills are the primary way users extend ObsidiBot with custom workflows. A skill is a `.md` file in the configured skills folder (default: `_ObsidiBot Skills/`) or a `<name>/SKILL.md` subdirectory (Claude Code convention).

**Frontmatter fields:**

| Field | Description |
|---|---|
| `params:` | Array of typed form fields (ObsidiBot format) |
| `arguments:` | Simple string argument hint (Claude Code format) |
| `argument-hint:` | Placeholder text for the argument input |
| `autorun: true` | Execute immediately without showing the form |
| `category:` | Group heading in the slash menu |
| `description:` | Subtitle in the slash menu |

**Execution:**
1. User selects skill from `/` slash menu or Ctrl+P command palette
2. If skill has `params:` or `arguments:`, `SlashParamModal` shows a form
3. User fills fields and submits
4. Values interpolated into prompt body: `{{id}}`, `$ARGUMENTS`, `$name`, `$0`
5. If `autorun: true`, prompt fires directly; otherwise it's inserted into chat input

**Param types (ObsidiBot):** `input`, `textarea`, `dropdown`, `checkboxes`, `obsidianmd_note` (alias: `note`)

The `obsidianmd_note` type opens a fuzzy vault picker; the selected note's full content is injected as a file attachment. This type is named `obsidianmd_note` (not `note`) so Claude Code and other tools can gracefully degrade when reading ObsidiBot skills.

**Claude Code compatibility:** ObsidiBot skills are a strict superset of Claude Code skill format. Skills authored for Claude Code/Cursor/Gemini CLI work in ObsidiBot as-is.

**Key module:** `src/SkillLoader.ts` owns all skill file-system logic: `resolveSkillsFolder()`, `scanSkillFolder()`, `nameFromPath()`, `parseSkillFile()`, `loadSkills()`.

### UIBridge Protocol (@@CORTEX_ACTION)

Claude triggers Obsidian UI actions by emitting `@@CORTEX_ACTION {"action": "...", ...params}` on its own line in a response. These are intercepted by `src/UIBridge.ts` and never shown to the user.

**Actions (no confirmation required):**
- `open-file` — opens a vault note
- `open-file-split` — opens in split pane
- `navigate-heading` — scrolls to a heading
- `show-notice` — shows a toast notification
- `set-label` — writes the user's name to `settings.userLabel` (consent-based greeting)
- `request-permission` — requests permission mode upgrade

**Actions (require user confirmation):**
- `open-settings` — opens Obsidian settings
- `focus-search` — focuses the search panel
- `run-command` — executes an Obsidian command by ID

UIBridge enforces a command allowlist and denylist (configurable in settings). Allowlisted commands are executed without confirmation. Denylisted commands are always blocked. Mid-session allowlist injection is supported.

Vault content is scanned for `@@CORTEX_` strings and neutralized via `neutralizeTriggers()` before being shown to the user or passed to Claude. This prevents prompt injection via crafted vault notes.

### Vault Query Protocol (@@CORTEX_QUERY)

Claude queries live vault state by emitting `@@CORTEX_QUERY {"query": "...", ...params, "mode": "show"|"inject"}`.

- **show mode**: renders a result card in the chat panel for the user to see
- **inject mode**: auto-fires a `--resume` turn injecting the result into Claude's context, so Claude can continue reasoning without a user turn

**Query types:** `backlinks`, `outlinks`, `tags`, `file-list` (supports optional `depth` and `startFolder` params)

Handled by `src/QueryHandler.ts`.

### Frontmatter Schema (Partially Implemented)

Notes can carry a `claude:` key in YAML frontmatter. The plugin reads this via `app.metadataCache`.

| Field | Implemented? | Behavior |
|---|---|---|
| `context: always` | Yes | Note injected into every session at session start |
| `readonly: true` / `protect: true` | Partial | Shown in settings; write-protection not enforced (FrontmatterGuard blocked — see Known Limitations) |
| `instructions: "..."` | Yes | Injected as context when note is read or pinned |
| `context: never` | No | Planned: block Claude from reading the file. Not enforced. |
| `context: session` | No | Reserved; no behavior defined |
| `priority: high|normal|low` | No | Reserved for future context ordering |

### Welcome Screen

Shows on plugin load when no session is active. Includes: sprite, greeting, tip of the day, recent sessions list.

Greeting is consent-based: reads `settings.userLabel`. This value is written only when the user introduces themselves via conversation and Claude fires `@@CORTEX_ACTION {"action": "set-label", "name": "..."}`. The plugin never reads the OS username.

---

## Features (Current)

- Chat panel (sidebar or split pane) with streaming markdown rendering
- Session persistence and history UI
- Session resume (`--resume`) — cheap cache-read pricing on subsequent turns
- Session manager: list, rename, drag-and-drop reorder, active session indicator
- Session export: YAML frontmatter + screenplay-style markdown transcript (active session via command palette; any past session via download icon in session manager)
- Context injection: vault tree (depth configurable, default off), context file, per-note frontmatter
- Per-turn token stats display: `out · in · cached`
- Token logging and context injection breakdown in debug log
- Configurable vault tree depth (0=off, 1–10=N levels, -1=unlimited)
- @-mention note injection
- File/URL attachment
- Image/PDF attachment (file picker + clipboard paste + drag-and-drop)
- Split-pane context awareness
- Permission modes: Standard / Read-only / Full access
  - Denial card shown when Claude attempts a blocked action
  - Mid-session upgrade path
- Tool call visibility (collapsible)
- Context gauge (SVG ring, click to compact)
- UIBridge (@@CORTEX_ACTION protocol)
- Command allowlist + denylist with settings browser + confirmation modal
- Mid-session allowlist injection
- Session context refresh command
- Command reference file (`.obsidian/plugins/obsidibot/obsidian-commands.md` — generated on layout ready)
- Log file in plugin dir (`.obsidian/plugins/obsidibot/obsidibot-debug.log`)
- Orphaned allowlist entry detection in settings UI
- Vault query protocol (@@CORTEX_QUERY)
- Skills: parameterized slash command files, typed form fields, Claude Code format compatibility
- Skills registered as Ctrl+P commands (default on)
- Welcome screen (sprite + greeting + tip of the day + recent sessions)
- About modal (matches Obsidian native layout)
- Interrupted session detection (`is_error` on result message)
- Autonomous memory setting
- Remote session detection

---

## Settings Reference

| Setting | Default | Description |
|---|---|---|
| Claude binary path | (auto-detect) | Override if detection fails |
| Context file path | `_claude-context.md` | Persistent vault briefing doc for Claude |
| Vault tree depth | 0 (off) | 0=off, 1–10=N levels, -1=unlimited |
| Skills folder | `_ObsidiBot Skills/` | Where skill .md files live |
| Register skills as Ctrl+P | ON | Skills appear in Obsidian command palette |
| Autonomous memory | OFF | Claude proactively maintains the context file |
| Session export folder | `Claude Exports/` | Where exported transcripts are written |
| Permission mode | Standard | Standard / Read-only / Full access |
| Command allowlist | (empty) | Commands Claude can run without confirmation |
| Command denylist | (empty) | Commands Claude can never run |
| User label | (empty) | Consent-based name shown on welcome screen |

---

## Key Files

| File | Purpose |
|---|---|
| `main.ts` | Plugin entry, 16 commands, `activateView`, `notifyAllowlistChanged`, `generateCommandsFile` |
| `src/ClaudeView.ts` | Chat UI, session state, context injection, history modal, `bridgeOptions`, `refreshSessionContext` |
| `src/ClaudeProcess.ts` | Binary detection, spawn (PowerShell on Win), stream-json parsing |
| `src/ContextManager.ts` | Orientation + vault tree + context file + allowlist assembly; all session-start context layers |
| `src/UIBridge.ts` | `@@CORTEX_ACTION` parsing + execution; `ConfirmCommandModal`; allowlist/denylist enforcement |
| `src/QueryHandler.ts` | `@@CORTEX_QUERY` resolution; `resolveQuery()`, `queryLabel()`, `buildInjectMessage()` |
| `src/SkillLoader.ts` | All skill file-system logic: resolve folder, scan, parse, load |
| `src/settings.ts` | Settings schema + tab UI; command browser (searchable checklist) |
| `src/orientation.md` | Orientation template (compiled into `main.js` via esbuild text loader) |
| `src/utils/sessionStorage.ts` | Session CRUD, `.jsonl` parse, `canResumeLocally` |
| `src/utils/logger.ts` | File + console logging, `estimateTokens` |
| `src/utils/fileTree.ts` | Vault folder tree builder |
| `src/modals/SlashParamModal.ts` | Param form modal for skills; `SlashParam` + `SlashParamAttachment` types |
| `test/spawn-test.mjs` | Standalone spawn test (Node.js, no Obsidian) |
| `docs/` | VitePress user-facing guide |
| `docs/guide/skills.md` | Skills reference (field types, examples, Ctrl+P API) |

---

## Known Limitations / Blocked Work

**FrontmatterGuard write-protection** — Claude Code's `--print` mode does not support per-tool-call approval. There is no hook to intercept a write before it executes. `FrontmatterGuard.ts` exists but write-protection is not enforced. `context: never` enforcement has the same blocker. Resolving this requires either: (a) a future Claude Code CLI feature, or (b) the persistent process architecture where ObsidiBot mediates tool calls directly.

**Inline diff preview** — same constraint as FrontmatterGuard.

**"Interrupted." message (#76)** — when Claude fires only UIBridge actions with no text, the UI shows a misleading "Interrupted." status.

**Export button missing from chat panel toolbar (#56)** — export is available via command palette only.

**Pinned context files UI** — backburned; no UI to manage per-session pinned notes yet.

---

## Future Directions

These are designed but not yet built. See `notes/dev/specs/` for individual specs.

### Plugin Ecosystem

The vision is a layered plugin architecture where ObsidiBot core exposes a stable API (`core.api`) that first- and third-party plugins consume:

- **`obsidibot-watchers`** — filesystem event triggers that spawn Claude sessions on vault changes
- **`obsidibot-supervisor`** — session queuing, concurrency control, multi-agent fleet orchestration
- **`obsidibot-mcp`** — exposes vault skills as MCP tools over localhost HTTP/SSE for external clients (Claude Desktop, n8n, mobile via Tailscale)

Core Plugin API spec: `notes/dev/specs/obsidibot-core-api-spec.md`

### Other Planned Features

- **Inline content generation (#10)** — `<% obsidibot: {"prompt": "..."} %>` tags in notes trigger headless Claude calls; output replaces the tag. Spec: `notes/dev/specs/inline-content-generation-spec.md`
- **Persistent process architecture** — keep `claude.exe` alive between turns (no per-turn spawn overhead). Requires dropping `--print` and handling turn-boundary detection from the stream. Significant performance win on Windows.
- **Vault watch/event system (#62)** — Obsidian pushing vault state changes to Claude proactively (second half of the two-way bridge; `@@CORTEX_QUERY` is the first half).
- **Two-way bridge improvements** — `help` topic injection for on-demand reference docs, unified `@@CORTEX` prefix, selection-aware context injection.
- **Obsidian community plugin submission** — pending lint fixes tracked in `notes/dev/obsidian-plugin-submission-feedback.md`.

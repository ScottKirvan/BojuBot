# Claude.md — ObsidiBot
## What
Obsidian plugin. Core feature: Claude Code CLI as subprocess (NOT API, NOT Agent SDK). No API key for AI — rides Pro/Max sub. Desktop only.

ObsidiBot is not limited to features that involve Claude Code directly. Obsidian-native features (voice input/output, live transcription, canvas, template integration, etc.) are in scope when they enhance the note-taking + AI workflow. New non-Claude features should still fit the "AI-enhanced Obsidian" mission — don't add things just because they're possible.

## Architecture (locked — don't revisit without discussion)
- `child_process.spawn` → `powershell.exe -NonInteractive -Command "& 'claude.exe' ..."` (Windows/Electron stdout fix)
- **Prompt is written to `proc.stdin`, NOT passed as a CLI arg.** `proc.stdin.write(prompt)` then `proc.stdin.end()`. This avoids all Windows shell-quoting issues (smart quotes, double quotes, special chars).
- `proc.stdin.end()` closes stdin so claude doesn't hang waiting for more input
- Flags: `--output-format stream-json --verbose --print` + permission-mode args (see below)
- Permission modes map to CLI args via `permissionArgs()` in `ClaudeProcess.ts`:
  - **Standard** (default): `--permission-mode acceptEdits`
  - **Read-only**: `--permission-mode default --allowedTools Read,Glob,Grep,WebFetch,WebSearch`
  - **Full**: `--permission-mode bypassPermissions`
  - **Restricted** (planned #154): `--permission-mode default --allowedTools Write,WebFetch,WebSearch` + vault tree injection suppressed
- `--verbose` required with `stream-json` + `--print` or claude errors
- Delete `CLAUDECODE` from spawn env or claude refuses nested launch
- `--resume <sessionId>` on every turn after first; uses cache_read_input_tokens (~10x cheaper)
- Do NOT prepend history manually — that costs MORE than --resume
- Vault root = cwd for all spawns
- Sessions: `.obsidian/obsidibot/sessions/<id>.json` (metadata only; actual history in `~/.claude/projects/`)

## Current status
Working: chat panel, markdown rendering, session persistence + history UI, session resume + history display, context injection (vault tree + context file + per-note frontmatter), send-on-enter, command palette (16 cmds), export/copy, session export to vault (active session via command palette, any past session via download icon in session manager — hover to reveal — YAML frontmatter + screenplay-style markdown transcript with ephemeral name detection, configurable export folder), per-turn token stats (out · in · cached), token logging, autonomous memory setting, remote session detection, configurable vault tree depth (0=off, 1-10=N levels, -1=unlimited), stdin-based prompt delivery (fixes smart-quote/special-char bugs on Windows), @-mention note injection, file/URL attachment, image/PDF attachment (file picker + clipboard paste + drag-and-drop → saves to `.obsidian/plugins/obsidibot/tmp/` with unique paste filenames), split-pane context awareness, permission modes (Standard/Read-only/Full access) with denial card + session upgrade, tool call visibility (collapsible), context gauge (SVG ring, click to compact), UI Bridge (@@CORTEX_ACTION protocol: open-file, open-file-split, navigate-heading, show-notice, focus-search, open-settings, run-command), command allowlist + denylist with settings browser + confirmation modal, mid-session allowlist injection, session context refresh command (now re-injects full orientation via buildSessionContext()), command reference file (`.obsidian/plugins/obsidibot/obsidian-commands.md` generated on layout ready — Claude reads it instead of guessing IDs), log file in plugin dir (`.obsidian/plugins/obsidibot/obsidibot-debug.log`), orphaned allowlist entry detection in settings UI, session manager (active session indicator, rename updates panel header on X-close, drag-and-drop reorder with sortOrder persistence, new sessions always inserted at top), vault query protocol (@@CORTEX_QUERY — show mode renders result card for user, inject mode auto-fires --resume turn so Claude can continue reasoning; supports backlinks, outlinks, tags, file-list), **skills** (parameterized slash command files — YAML `params` frontmatter defines form fields, `autorun` fires directly, `note` type injects vault note content as attachment; skills registered as Ctrl+P commands via `registerSkillsAsCommands` setting + "Reload skills" command; `SlashParamModal.ts`, `executeSkill()` on ClaudeView, `reloadSkillCommands()` on plugin).

Remaining: FrontmatterGuard.ts write-protection (blocked: Claude Code doesn't support per-tool-call approval in --print mode), inline diff preview (same constraint), pinned context files UI (backburned), export button in chat panel toolbar (#56), misleading "Interrupted." message when Claude fires only UI bridge actions with no text (#76).

## Architectural direction: two-way bridge (#62)
The vault query protocol (@@CORTEX_QUERY, #58) is the first half of the two-way bridge — Claude can now query live vault state (backlinks, outlinks, tags, file-list) on demand. The second half (#62) is a watch/event system: Obsidian pushing vault state changes to Claude proactively. Design #62 as an extension of the existing query infrastructure.

Test vault: `D:\2\deleteme` (symlinked to plugin dir).

## Key files
| File                          | Purpose                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `main.ts`                     | Plugin entry, 16 commands, activateView, notifyAllowlistChanged, generateCommandsFile          |
| `src/ClaudeView.ts`           | Chat UI, session state, context injection, history modal, bridgeOptions, refreshSessionContext |
| `src/ClaudeProcess.ts`        | Binary detect, spawn (PowerShell on Win), stream-json parse                                    |
| `src/ContextManager.ts`       | Vault tree + context file + allowlist assembly; all session-start context layers               |
| `src/UIBridge.ts`             | @@CORTEX_ACTION parsing + execution; ConfirmCommandModal; allowlist/denylist enforcement       |
| `src/QueryHandler.ts`         | @@CORTEX_QUERY resolution; resolveQuery(), queryLabel(), buildInjectMessage()                  |
| `src/settings.ts`             | Settings schema + tab UI; command browser (searchable checklist)                               |
| `src/utils/sessionStorage.ts` | Session CRUD, .jsonl parse, canResumeLocally                                                   |
| `src/utils/logger.ts`         | File + console logging, estimateTokens                                                         |
| `src/utils/fileTree.ts`       | Vault folder tree builder                                                                      |
| `src/modals/SlashParamModal.ts` | Param form modal for skills; `SlashParam` + `SlashParamAttachment` types                     |
| `test/spawn-test.mjs`         | Standalone spawn test (node, no Obsidian)                                                      |
| `docs/`                       | Root VitePress folder user-facing guide                                                        |
| `docs/guide/skills.md`        | Skills reference doc (field types, examples, Ctrl+P API)                                       |
| `notes/COMMIT_DRAFT.md`       | Commit msg staging (gitignored)                                                                |

## Scott's prefs
- Conventional commits + release-please. Scott commits, I write code.
- No auto-commit/push.
- Not fluent in TS — I do implementation.
- Multi-machine (Windows). Keep notes resumable cold.
- Project = "ObsidiBot" (not "ObsidiBot plugin", not "obsidian-claude").

## Build
```bash
npm install && npm run build   # one-shot
npm run dev                    # watch mode
```

## Windows gotchas
- Claude Code must be installed AND logged in natively in PowerShell. `winget install Anthropic.ClaudeCode` + `claude login`.
- Spawn via `powershell.exe -NonInteractive` — cmd.exe (shell:true) and direct spawn (shell:false) both silently swallow stdout in Electron.
- `proc.stdin.end()` is required after spawn.

## Commits
`feat:` / `fix:` / `docs:` / `chore:` / `refactor:` / `test:`. Breaking: `feat!:` or `BREAKING CHANGE:` footer. release-please handles CHANGELOG + version bumps.

## Release process (post-merge checklist)
release-please only reads commit **subject lines** — commit bodies are ignored. After each release PR merges:

1. Scan commit bodies for sub-features/fixes not visible in the subject:
   ```bash
   git log --format="%H %s%n%b%n---" <prev-tag>..HEAD
   ```
2. Manually expand any sparse entries in `notes/CHANGELOG.md`
3. Sync the GitHub release page to match:
   ```bash
   gh release edit <tag> --notes "$(cat release-body.md)"
   ```
   (or paste directly via `gh release edit <tag> --notes-file <file>`)

The natural checkpoint is the release-please PR review — that's the right moment to catch multi-bullet commits before the release goes public.

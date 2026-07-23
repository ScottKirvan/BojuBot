# Claude.md — BojuBot
## What
Obsidian plugin. Core feature: Claude Code CLI as subprocess (NOT API, NOT Agent SDK). No API key for AI — rides Pro/Max sub. Desktop only.

BojuBot is not limited to features that involve Claude Code directly. Obsidian-native features (voice input/output, live transcription, canvas, template integration, etc.) are in scope when they enhance the note-taking + AI workflow. New non-Claude features should still fit the "AI-enhanced Obsidian" mission — don't add things just because they're possible.

## Architecture (locked — don't revisit without discussion)
- `child_process.spawn` → `powershell.exe -NonInteractive -Command "& 'claude.exe' ..."` (Windows/Electron stdout fix)
- **Prompt is written to `proc.stdin`, NOT passed as a CLI arg.** `proc.stdin.write(prompt)` then `proc.stdin.end()`. This avoids all Windows shell-quoting issues (smart quotes, double quotes, special chars).
- `proc.stdin.end()` closes stdin so claude doesn't hang waiting for more input
- Flags: `--output-format stream-json --verbose --print` + permission-mode args (see below)
- Permission modes map to CLI args via `permissionArgs()` in `ClaudeProcess.ts`:
  - **Standard** (default): `--permission-mode acceptEdits --disallowedTools Bash`
  - **Read-only**: `--permission-mode default --allowedTools Read,Glob,Grep,WebFetch,WebSearch`
  - **Full**: `--permission-mode bypassPermissions`
  - **Restricted** (planned #154): `--permission-mode default --allowedTools Write,WebFetch,WebSearch` + vault tree injection suppressed
- `--verbose` required with `stream-json` + `--print` or claude errors
- Delete `CLAUDECODE` from spawn env or claude refuses nested launch
- `--resume <sessionId>` on every turn after first; uses cache_read_input_tokens (~10x cheaper)
- Do NOT prepend history manually — that costs MORE than --resume
- Vault root = cwd for all spawns by default; per-session `cwd` override stored in session JSON and used on every spawn including `--resume`
- Sessions: `.obsidian/bojubot/sessions/<id>.json` (metadata only; actual history in `~/.claude/projects/`); schema includes optional `cwd` field

## Current status
Working: chat panel, markdown rendering, session persistence + history UI, session resume + history display, context injection (vault tree + context file + per-note frontmatter), send-on-enter, command palette (16 cmds), export/copy, session export to vault (active session via command palette, any past session via download icon in session manager — hover to reveal — YAML frontmatter + screenplay-style markdown transcript with ephemeral name detection, configurable export folder), per-turn token stats (out · in · cached), token logging, autonomous memory setting, memory file size cap (injects compaction instruction when context file exceeds token limit; `needsCompaction` flag changes thinking indicator to "Compacting memory…"), remote session detection, configurable vault tree depth (0=off, 1-10=N levels, -1=unlimited), stdin-based prompt delivery (fixes smart-quote/special-char bugs on Windows), @-mention note injection, file/URL attachment, image/PDF attachment (file picker + clipboard paste + drag-and-drop → saves to `.obsidian/plugins/bojubot/tmp/` with unique paste filenames), split-pane context awareness, permission modes (Standard/Read-only/Full access) with denial card + session upgrade, tool call visibility (collapsible), context gauge (SVG ring, click to compact), UI Bridge (@@BOJU protocol, action key: open-file, open-file-split, navigate-heading, show-notice, focus-search, open-settings, run-command, request-permission), command allowlist + denylist with settings browser + confirmation modal, mid-session allowlist injection, session context refresh command (now re-injects full orientation via buildSessionContext()), command reference file (`.obsidian/plugins/bojubot/obsidian-commands.md` generated on layout ready — Claude reads it instead of guessing IDs), log file in plugin dir (`.obsidian/plugins/bojubot/bojubot-debug.log`), orphaned allowlist entry detection in settings UI, session manager (active session indicator, rename updates panel header on X-close, drag-and-drop reorder with sortOrder persistence, new sessions always inserted at top), vault query protocol (@@BOJU query key — show mode renders result card for user, inject mode auto-fires --resume turn so Claude can continue reasoning; supports backlinks, outlinks, tags, file-list), **skills** (parameterized slash command files — YAML `params` frontmatter defines form fields, `autorun` fires directly, `note` type injects vault note content as attachment; skills registered as Ctrl+P commands via `registerSkillsAsCommands` setting + "Reload skills" command; `SlashParamModal.ts`, `executeSkill()` on ClaudeView, `reloadSkillCommands()` on plugin), welcome screen (sprite + greeting + tip of the day + recent sessions list), About modal (matches Obsidian native layout), interrupted session detection (is_error on result message), legacy session migration (`getLegacySessionsDirs()` returns `['obsidibot/sessions', 'cortex/sessions']` merged on load with deduplication), minimal mode (skips all context injection — no orientation, vault tree, context file, active note; UI Bridge and vault queries inactive; skills still work; affected settings visually muted with `bojubot-setting-muted` CSS class), **prime session** (Shift+click on + opens `PrimeSessionModal` — pre-configure name, cwd, initial instructions, vault context suppression, and context attachments before first turn; cwd persisted in session JSON and used on every spawn including `--resume`; `suppressVaultContext` skips layers 1–5 but keeps orientation; `primeInstructions` injected as Layer 6 always; empty fields default to normal behavior; `PrimeSessionModal.ts`).

Remaining: FrontmatterGuard.ts write-protection (blocked: Claude Code doesn't support per-tool-call approval in --print mode), inline diff preview (same constraint), pinned context files UI (backburned), export button in chat panel toolbar (#56), misleading "Interrupted." message when Claude fires only UI bridge actions with no text (#76).

## Architectural direction: two-way bridge (#62)
The vault query protocol (@@BOJU query key, #58) is the first half of the two-way bridge — Claude can now query live vault state (backlinks, outlinks, tags, file-list) on demand. The second half (#62) is a watch/event system: Obsidian pushing vault state changes to Claude proactively. Design #62 as an extension of the existing query infrastructure.

Test vault: `D:\2\deleteme\cortex_test_vault` (junction at `.obsidian/plugins/bojubot` → repo root).

## Key files
| File                            | Purpose                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `main.ts`                       | Plugin entry, 16 commands, activateView, notifyAllowlistChanged, generateCommandsFile          |
| `src/ClaudeView.ts`             | Chat UI, session state, context injection, history modal, bridgeOptions, refreshSessionContext |
| `src/ClaudeProcess.ts`          | Binary detect, spawn (PowerShell on Win), stream-json parse                                    |
| `src/ContextManager.ts`         | Vault tree + context file + allowlist assembly; all session-start context layers               |
| `src/UIBridge.ts`               | @@BOJU action parsing + execution; ConfirmCommandModal; allowlist/denylist enforcement         |
| `src/QueryHandler.ts`           | @@BOJU query resolution; resolveQuery(), queryLabel(), buildInjectMessage()                    |
| `src/settings.ts`               | Settings schema + tab UI; command browser (searchable checklist)                               |
| `src/utils/sessionStorage.ts`   | Session CRUD, .jsonl parse, canResumeLocally                                                   |
| `src/utils/logger.ts`           | File + console logging, estimateTokens                                                         |
| `src/utils/fileTree.ts`         | Vault folder tree builder                                                                      |
| `src/modals/SlashParamModal.ts`  | Param form modal for skills; `SlashParam` + `SlashParamAttachment` types                       |
| `src/modals/PrimeSessionModal.ts` | Pre-session config modal (Shift+click +); `PrimeSessionOptions` type exported from here       |
| `test/spawn-test.mjs`           | Standalone spawn test (node, no Obsidian)                                                      |
| `docs/`                         | Root VitePress folder user-facing guide                                                        |
| `docs/guide/skills.md`          | Skills reference doc (field types, examples, Ctrl+P API)                                       |
| `notes/COMMIT_DRAFT.md`         | Commit msg staging (gitignored)                                                                |

## Scott's prefs
- Conventional commits + release-please.
- I can commit and push on feature/fix branches. **Never commit or merge directly to `main`.** Scott owns `main`. Explicit one-off instructions to do otherwise are temporary exceptions, not rule changes.
- **Branching:** let scope decide — batch related fixes onto one branch when it's reasonable; individual branches when scope diverges. No prescribed granularity.
- Not fluent in TS — I do implementation.
- Multi-machine (Windows). Keep notes resumable cold.
- Project = "BojuBot" (not "BojuBot plugin", not "obsidian-claude").
- No "Generated with Claude Code" credits or any AI advertisement in PR bodies, commit messages, or any other project-visible text.

## Code review / bug fix workflow
Before implementing any fix — especially from a code review:
1. Read the finding and explain the current behavior back in plain language.
2. Flag anything where the diagnosis seems incomplete or where context might change the fix. Code reviews are a starting point for discussion, not a prescription.
3. Propose the fix approach and confirm before writing code.
4. Security and correctness bugs get individual PRs. Maintenance items can batch.
5. Larger refactors get a design discussion first — no diving straight into a 2,800-line file split.

## GitHub issues and PRs
Templates aren't stored in this repo — they live in the org-wide `ScottKirvan/.github` repo (`.github/ISSUE_TEMPLATE/` and `.github/pull_request_template.md`) and apply automatically to BojuBot via GitHub's community-health-file fallback. Fetch them from there (e.g. `gh api repos/ScottKirvan/.github/contents/...` or the raw URL) if you need the exact section headers.

- Bug reports → `[BUG]` title prefix, `bug_report.md` sections
- Feature requests → `[FEATURE]` title prefix, `feature_request.md` sections
- General → `[GENERAL]` title prefix, `general_report.md` sections
- PRs → fill all checklist sections

**Before creating any issue, check open issues for duplicates** (`gh issue list --state open --limit 100`). Don't file if it's already tracked.

**Create issues only when asked.** Don't preemptively file issues for future work unless Scott says to.

**No attributions of any kind** in issue text, PR bodies, or commit messages — no "created by", "contributed by", "Co-Authored-By", "Generated with", or any AI/tool credit lines. This is professional dev; nothing goes on the record about who or what wrote it.

Run all three before opening any PR — all must pass clean:
```bash
npm run build   # TypeScript check + bundle
npm run lint    # ESLint — zero warnings or errors
npm test        # 89 unit tests via tsx --test
```
Lint and TypeScript violations are `fix:` commits, not `chore:`.

**Writing tests:** New pure functions and data-layer logic should have unit tests added to `test/unit.test.ts`. Tests use Node's built-in `node:test` + `node:assert/strict` — no Jest, no Vitest. Tests must not require the Obsidian API or Electron (anything that needs a live plugin can't be unit-tested; note that in the PR instead). Tests go in a `describe` block with a name matching the function or concept. Follow the existing style: assert exact values, test edge cases and failure paths, not just the happy path.

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

**Lint and TypeScript violations are `fix:` not `chore:`** — they block Obsidian community plugin acceptance and must appear in a release.

**`feat:` is for genuinely new user-facing capabilities only.** Bug fixes (even GitHub-tracked bugs), privacy/consent fixes, default value changes, internal improvements, and enabling behavior that was always designed but not yet on by default all use `fix:`, `chore:`, or `refactor:`. Mislabeling fixes as features inflates minor version numbers unnecessarily — release-please uses commit types directly to determine version bumps.

After submitting a PR, always switch back to `main`: `git checkout main && git pull`.
When Scott says a branch is merged or deleted, immediately run `git checkout main && git pull`, then create a new branch before continuing any work.

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

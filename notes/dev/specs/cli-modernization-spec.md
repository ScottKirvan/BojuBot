# Claude Code CLI Modernization — Feature Design Spec

**Status: Phase 1 IN PROGRESS** (branch `feat/cli-capabilities`) · **Phase 2 PROPOSED** (future sprint)

Written 2026-10-02 against Claude Code CLI **2.1.286**. Every "verified" statement below was tested on that version; everything else is design intent and should be re-checked against the CLI current at implementation time.

## Overview

BojuBot was written against a much older Claude Code CLI and passes only seven flags: `--print`, `--output-format`, `--verbose`, `--resume`, `--model`, `--permission-mode`, `--allowedTools`. The CLI has since gained flags and stream events that map directly onto BojuBot features: effort control, live streaming, explicit permission denial, plan-usage data, session forking, remote control, and more.

Two recent bugs show the cost of not knowing what the installed CLI supports: Claude 5.5 models failed on CLI 2.1.70 (#350), and `--permission-mode default` became undocumented (#352). Phase 1 therefore starts with **capability detection**, which makes every later flag safe to adopt on old CLIs.

| Phase | Scope | When |
| --- | --- | --- |
| 1 | Capability detection, `--permission-prompts none`, effort selector, token streaming, `/usage` command | In progress |
| 2 | Usage meter UI, native slash-command set (incl. remote control), session forking, and the remaining flag adoptions below | Future sprint |

---

## Phase 1 — In progress

Summarized here so this spec stands alone; implementation details live in the `feat/cli-capabilities` commits.

### 1. CLI capability detection (fixes #352)

- After `findClaudeBinary()` resolves, BojuBot runs `claude --version` and `claude --help` asynchronously (~70 ms and ~237 ms measured) and parses them with the pure `parseCliCapabilities()` (`src/utils/cliCapabilities.ts`) into `{ version, flags, permissionModes, effortLevels }`.
- Each new flag is used only when the help text lists it. **Unknown capabilities (probe failed or still running) produce exactly the pre-Phase-1 arguments.**
- Read-only and Restricted send `--permission-mode manual` when the CLI lists `manual`; `default` otherwise.
- Detected version shown in the About modal and settings.

Design choice: feature detection by help text, not a version table. BojuBot never needs to know which release added a flag.

### 2. `--permission-prompts none` (closes #291)

Verified on 2.1.286 with `--permission-mode acceptEdits`, user settings excluded:

| Bash command | Without flag | With `--permission-prompts none` |
| --- | --- | --- |
| `echo hello` (read-only) | Allowed | Allowed |
| `curl -s -o page.html https://example.com` (writes a file) | Denied, in `permission_denials` | Denied, in `permission_denials` |

The flag doesn't change behavior today, but it makes the denial documented ("anything that would prompt is denied automatically") instead of an emergent side effect. **Finding:** Standard mode now lets read-only Bash commands through (the CLI classifies them); the user guide was corrected accordingly.

### 3. Effort selector (`--effort`)

- Levels read from the help text (today `low, medium, high, xhigh, max`) plus "Default" (flag left off). Verified to work on Haiku 4.5 and Sonnet 5.5; an invalid value only warns on stderr.
- Global `defaultEffort` (default `''`), optional per-session `effort` pin in `StoredSession` (Custom Session field), re-applied on every spawn including `--resume`. Mid-session switch follows the model-switch rules from #322.
- Toolbar indicator reads "Claude Sonnet 5.5 · high"; `/effort` slash entry and **Switch effort** palette command. Hidden entirely on CLIs without `--effort`.

### 4. Token-by-token streaming (`--include-partial-messages`)

Verified event shape on 2.1.286: `stream_event` lines (`content_block_start`, `content_block_delta` with `text_delta` / `thinking_delta` / `input_json_delta` / `signature_delta`, `content_block_stop`, `message_*`) arrive **in addition to** the complete `assistant` message for each block, which still comes right after the block's last delta.

- `text_delta` feeds a preview layer only. Complete `assistant` messages remain the single source of truth for text, UI bridge actions, queries, tool calls, usage and API-error detection.
- Preview hides `@@BOJU` lines and any trailing partial line that could become one; actions never fire from preview text.
- DOM updates coalesced per animation frame. Setting `streamPartialMessages` (default on) as a fallback switch.

### 5. `/usage` command

Verified: `/usage` sent as the whole stdin prompt in `--print` mode returns plan usage locally (no model call, $0, 0 tokens). `/cost` is now an alias.

- BojuBot slash entry **Usage** and palette command **Show plan usage** run a side process (`--no-session-persistence` when supported, never `--resume`) and render the text as a system card. Never sent to Claude.

---

## Phase 2 — Future sprint

### 2.1 Usage meter UI

**Goal:** always-visible plan usage, so users see a limit coming instead of hitting it.

**Data source — verified:** every normal turn's stream already contains a `rate_limit_event`, with or without partial messages. No extra process is needed.

```json
{"type":"rate_limit_event","rate_limit_info":{
  "status":"allowed","resetsAt":1790964000,"rateLimitType":"five_hour",
  "overageStatus":"rejected","overageDisabledReason":"org_level_disabled","isUsingOverage":false,
  "unifiedWindows":{
    "five_hour":{"utilization":0.53,"resetsAt":1790964000},
    "seven_day":{"utilization":0.33,"resetsAt":1791403200}}}}
```

**Design**

- Parser: new optional `onRateLimit(info)` callback; `SessionCoordinator` emits `usage:limits`. Keep the parsing pure (`parseRateLimitInfo()` → `{ status, windows: [{ name, utilization, resetsAt }] }`), tolerant of missing fields and unknown window names.
- UI: a compact meter beside the context gauge showing the **most constrained window**, e.g. a thin bar or ring with "53%". Tooltip lists every window with its reset time in local time ("5-hour: 53%, resets 2:59 pm · Weekly: 33%, resets Oct 7").
- Thresholds: neutral below 80%, amber from 80%, red from 95%. When `status` isn't `allowed`, show the reset time prominently and a one-line system message on the turn that hit the limit.
- Click opens the full `/usage` card from Phase 1 (adds the "what's contributing" breakdown).
- Before the first turn of a launch there's no event yet: show the meter empty/greyed, or run `/usage` once on demand. Don't run it automatically at startup.
- Persist the last-seen values in memory only; values are per-account and change constantly.

**Open:** should overage status (`isUsingOverage`, `overageStatus`) be shown? Only meaningful for users with extra usage enabled.

### 2.2 Native slash-command set

BojuBot's slash menu gains a **Claude Code** category. Commands are an allowlist: each one is added after testing, never a generic passthrough. Most other CLI commands are interactive (`/config`, `/mcp` UI) or would fight BojuBot's own session state (`/clear`, `/rename`, `/model`, `/effort`, `/compact` is already wrapped).

| Command | Mechanism | What the user gets | Status |
| --- | --- | --- | --- |
| `/usage` | `--print`, stdin `/usage`, `--no-session-persistence` | Plan usage card | Phase 1 |
| `/context` | `--print --resume <id>`, stdin `/context` | Markdown breakdown of the session's context (model, tokens/window, by category, skills) | Verified working |
| `/remote-control` | Opens a terminal: `claude --remote-control "<session title>" --resume <id>` in the session cwd | Continue this BojuBot session from claude.ai or the phone app | Needs manual test (see below) |
| `/terminal` | Opens a terminal: `claude --resume <id>` | Continue this session in the full interactive CLI | Needs manual test |
| `/fork` | Next turn uses `--resume <id> --fork-session`; result saved as a new BojuBot session | Branch the conversation; the original stays untouched (#322 follow-up) | Design |
| `/doctor` | `claude doctor` subcommand (no session) | Installation health check in a card | Needs test |
| `/update` | `claude update` subcommand, then re-run capability detection | Fix "CLI too old" (#350) without leaving Obsidian | Needs test; may need elevation for winget installs |
| `/mcp-list` | `claude mcp list` subcommand | Which MCP servers Claude will load for this vault | Needs test |
| `/insights`, `/recap` | `--print`, stdin | Unknown; listed by the CLI in print mode | Test output first |

Notes from testing on 2.1.286:
- `/context` with `--resume` reports the real session context (17% on a small test session) and writes `<local-command-…>` entries to the session `.jsonl`. BojuBot's loader already hides those (`INTERNAL_USER_PREFIXES`, `src/utils/sessionStorage.ts`). Consider using it as the context gauge's detail view; the gauge itself can stay usage-based.
- All side-process commands must not block or interleave with an in-progress turn on the same session. Commands that use `--resume` should wait for the turn to finish (or be disabled while it runs).

#### `/remote-control` — design

Verified: `/remote-control` does nothing in `--print` mode, and `claude --remote-control` without a TTY falls back to print mode and exits ("Input must be provided…"). Remote control **requires an interactive terminal**, so BojuBot can't host it inside its own pipeline.

Approach: hand the session to a terminal, reusing the pattern of `renderAuthError()`'s **Open terminal** button (`cmd.exe /c start powershell.exe -NoExit -Command "& '<bin>' …"` on Windows; Terminal.app / `x-terminal-emulator` elsewhere).

1. User runs `/remote-control` on an active session (disabled for a session with no turns yet).
2. BojuBot opens the terminal with `--remote-control "<title>" --resume <claudeSessionId>`, cwd = the session's effective cwd, and applies the session's model and permission flags.
3. The chat panel shows a banner: "This session is under remote control in a terminal. Close it there, then click Resume here." The input is locked for that session, because two processes writing the same session would interleave history.
4. On **Resume here**, BojuBot reloads the session history from the `.jsonl` (`loadSessionMessages`) so turns made remotely appear, and unlocks input.

Must verify manually before building: the flag combination works with `--resume`; the remote session is visible in the claude.ai/app session list; history written remotely loads cleanly in BojuBot; what happens to permission modes (remote control may prompt on the phone, which is better than BojuBot's denial card).

`/terminal` is the same flow without `--remote-control` and is a cheap first step that proves the hand-off/reload mechanics.

### 2.3 Remaining flag adoptions

All go through Phase 1 capability detection.

| Flag | Feature | Related | Size |
| --- | --- | --- | --- |
| `--fork-session` | `/fork` (above) plus a "Fork" action in the session manager | #322 | S–M |
| `--name <name>` | Pass the BojuBot session title so sessions are recognizable in the CLI's `/resume` picker and the claude.ai list (pairs with `/remote-control`) | — | S |
| `--restricted` | Back the planned Restricted mode with the CLI's own: removes Bash/code tools and WebFetch, confines file tools to the working dirs, refuses `bypassPermissions`. **It ignores user/project/local settings files**, so the user's MCP servers and hooks would drop — needs a decision and a settings note | #154, #61 | M |
| `--fallback-model <models>` | Setting: automatic fallback when the chosen model is overloaded; the CLI retries the primary each turn | — | S |
| `--add-dir <dirs>` | Custom Session option to grant access to folders outside the vault (persisted like `cwd`) | — | S |
| `--prompt-suggestions` | Clickable suggested next prompt under a reply (`prompt_suggestion` message after each turn) | — | M |
| `--session-id <uuid>` | BojuBot generates the session ID up front, removing the placeholder→real ID swap in `_persistSessionAfterTurn` | — | M (refactor) |
| `--no-session-persistence` + `--json-schema` | One-off calls ("Generate with Claude" context file, future utilities) leave no stray sessions and return structured output that can be validated before writing. Structure also helps rein in that feature's known over-scoping | Context generation | M |
| `--append-system-prompt` | Deliver vault context (orientation, tree, context file) as a system prompt instead of a first-message prefix: keeps it out of history and exports. Note `--system-prompt-snapshot` (default on) records it once per conversation, so it must be passed on every spawn and survives until compaction | — | L |
| `--input-format stream-json` | One persistent `claude` process per session instead of one per turn: lower latency, mid-turn input | #235 | L |
| `--mcp-config` | Expose the UI bridge and vault queries as real MCP tools instead of the `@@BOJU` text protocol: validated, permission-checked, visible as tool calls | #172, #153, #62 | XL — design discussion first |
| `system/thinking_tokens` event | "Thinking… (~140 tokens)" in the status line during long thinking | — | S |

### Ruled out

| Flag | Why |
| --- | --- |
| `--bare` | Disables OAuth/keychain auth (API key only), which breaks BojuBot's subscription model |
| `--max-budget-usd`, `--betas` | API-key users only |
| `--cloud`, `--bg`, `--worktree`, `--tmux`, `--chrome`, `--desktop` | Terminal, cloud or browser workflows outside BojuBot's scope |
| `--dangerously-skip-permissions` | Full mode already uses `--permission-mode bypassPermissions` |

---

## Testing

Each item follows the project rules: pure logic in `src/utils/` with unit tests in `test/unit.test.ts`; `npm run build`, `npm run lint`, `npm test` clean before commit; manual verification in the test vault (`D:\2\deleteme\new_new`).

Phase 2 specifics:
- `parseRateLimitInfo()`: the verified sample above, missing `unifiedWindows`, unknown window names, non-`allowed` status.
- Slash commands: one manual check per command on the current CLI; record the CLI version in the PR.
- `/remote-control` and `/terminal`: manual only (needs a TTY and a second device). Verify history reload and input lock/unlock.
- Every new flag: confirm unknown capabilities still produce the old arguments.

## Open questions

1. **Minimum CLI version:** warn at startup below a floor (e.g. 2.1.280, the 5.5-model minimum), or rely on per-feature hiding plus the #350 message? A `/update` command makes a warning more actionable.
2. **Usage meter placement:** beside the context gauge, or folded into it (two rings)?
3. **`--restricted` trade-off:** accept losing user-level MCP/hooks in Restricted mode, or keep BojuBot's own `--allowedTools` approach?
4. **`/remote-control` lock:** hard-lock the session in BojuBot while it's remote, or warn and allow?
5. **`--append-system-prompt` migration:** existing sessions have context in their first message; new sessions only, or a one-time refresh?

# Agent Backends (Antigravity CLI first) — Feature Design Spec

**Status: Phase 1 IMPLEMENTED** (seam, on `dev`) · **Phases 2–3 PROPOSED** · development on the `dev` branch

Written 2026-10-16. Verified against **Antigravity CLI 1.4.0** (`agy`, run on Windows 11 with a personal Google account) and **Gemini CLI 0.64.0** (read from its published npm package). "Verified" means tested or read in code on those versions; everything else is design intent to re-check at implementation time.

## Overview

BojuBot only drives the Claude Code CLI. Every turn spends the user's Claude plan quota, which heavy Claude Code users have already spent on coding. A second backend lets them keep using BojuBot on a different plan.

**Goal for the release:** the user picks a backend, Claude Code or Antigravity CLI, globally or per session. Everything BojuBot does today keeps working on Claude Code exactly as before, and the core chat, vault, UI Bridge, skills and permission experience works on Antigravity.

**Key finding: the first backend is Antigravity CLI, not Gemini CLI.** Since 2026-06-18, Gemini CLI no longer serves free accounts or Google AI Pro/Ultra subscriptions; only paid API keys and Gemini Code Assist Standard/Enterprise licenses keep access ([announcement](https://github.com/google-gemini/gemini-cli/discussions/27274)). Personal and subscription users moved to **Antigravity CLI** (`agy`), whose headless interface closely mirrors Claude Code's. Gemini CLI stays a candidate later adapter for API-key users.

| Phase | Scope | Shippable on its own |
| --- | --- | --- |
| 0 | `dev` branch, CI for `dev`, this spec | n/a |
| 1 | `AgentBackend` seam; Claude Code moved behind it with zero behavior change | Yes (pure refactor) |
| 2 | Antigravity backend MVP: chat, resume, tools, Standard/Full/Read-only, denial card, models, effort, history | No, internal milestone |
| 3 | Release hardening: onboarding, Chat only decision, docs, test matrix, `dev` → `main` | **Release** |
| Later | Gemini CLI adapter, usage meter for both, persistent process, `agy` remote control | Separate releases |

---

## Research findings

### Antigravity CLI 1.4.0 (verified on this machine)

**Install and auth.** Native Go binary at `%LOCALAPPDATA%\agy\bin\agy.exe`; the installer adds it to the user PATH. Auth is a one-time interactive login. Unauthenticated headless runs exit with an "authentication required" error instead of hanging (per docs).

**Invocation.** `--print` takes the prompt as its *value* (`--print "…"`), unlike Claude's flag, and an empty `--print=` doesn't read stdin. BojuBot must never put prompt text in args on Windows, so it uses the stdin streaming input instead. Verified working from Node, both directly and through BojuBot's `powershell.exe -NonInteractive -Command "& '<bin>' …"` wrapper (inside Obsidian's Electron process is still to confirm in Phase 2):

```
agy --input-format stream-json --output-format stream-json --model <id> [--conversation <id>] [mode flags]
stdin:  {"event":"user","message":{"role":"user","content":"<prompt>"}}\n   then close stdin
```

`content` may be a string or a list of `text` blocks only. Unknown input events are skipped with a stderr warning. A missing `event` field, invalid JSON or a non-text block gives an `ERROR` result and exit 1. Slash commands (e.g. `/model`) in the stream give an `ERROR` result and exit 2.

**Output events** (NDJSON, field `event`, not `type`):

| Event | Shape (verified) | BojuBot use |
| --- | --- | --- |
| `init` | `{"event":"init","conversation_id":"<uuid>","init":{"model","cwd","tools":[…],"permission_mode":"request-review"}}` | Session ID, model |
| `step_update` | `{"event":"step_update","step_update":{"conversation_id","step_index","state","step_type","text_delta"?,"tool_name"?,"tool_info"?,"usage"?,"duration_seconds"?,"subagent_info"?}}` | Text, tools, usage |
| `result` | `{"event":"result","result":{"conversation_id","status","response","error"?,"duration_seconds","num_turns","usage":{…},"denied_actions"?:[…]}}` | End of turn, denials |

- `step_type`: `user_input`, `agent_response`, `tool`, `checkpoint`. `state`: `ACTIVE`, `DONE`, `ERROR`.
- **Text arrives only as deltas.** `agent_response` steps carry `text_delta` chunks; the step's full text is their concatenation, complete at `state: "DONE"`. There is no "complete message" event like Claude's `assistant`. `result.response` holds only the final reply.
- **Tools:** an `ACTIVE` tool step has `tool_name` and `tool_info.parameters`; a `DONE` one adds `tool_info.output` (a summary, e.g. `"2 lines, 27 bytes"`); an `ERROR` one has `tool_info.error {type, message}`.
- **Usage:** each `DONE` step carries `usage {input_tokens, output_tokens, thinking_tokens, cache_read_tokens, total_tokens}`. `result.usage` and `num_turns` are **cumulative for the conversation** (verified after a resume), so per-turn stats must sum the step usage.
- `status` values: `SUCCESS`, `ERROR`, `CANCELED`, `INTERRUPTED`, `INVALID`, `WAITING`, `RUNNING`.
- Observed cost: ~11.8k input tokens of built-in system prompt per invocation, `cache_read_tokens` always 0. Latency 1.7–4 s for a trivial turn.

**Tool names** (built-in, from `init.tools`): `view_file`, `write_to_file`, `replace_file_content`, `multi_replace_file_content`, `run_command`, `grep_search`, `find_by_name`, `list_dir`, `search_web`, `read_url_content`, plus browser, subagent and MCP tools. Parameters use PascalCase (`AbsolutePath`, `TargetFile`, `CommandLine`).

**Sessions.** `--conversation <id>` resumes by the `conversation_id` from `init` (verified: the second turn recalled a codeword, same ID). `--continue` resumes the most recent. Conversations are stored as one SQLite file each at `~/.gemini/antigravity-cli/conversations/<id>.db`; BojuBot should not parse it.

**Permissions** (verified unless noted):

| Run | Result |
| --- | --- |
| Default (`permission_mode: request-review`), read a workspace file | Allowed |
| Default, write a file inside the system temp folder (`write_to_file`) | Allowed, no prompt. The first test ran there, which made default mode look writable |
| Default, write or overwrite a file anywhere else (e.g. a vault on `D:`) | **Denied:** "requires the write_file permission that headless mode cannot prompt for", reported like a shell denial (found in Obsidian testing) |
| Default, shell command that writes (`run_command`) | **Soft-denied:** tool step `ERROR`, run continues and exits 0, `result.denied_actions: [{"action":"command","display_name":"RunCommand"}]` |
| `--mode plan`, write a workspace file | Workspace untouched; it wrote a plan into its own `~/.gemini/antigravity-cli/brain/<id>/` and asked for approval |
| `--dangerously-skip-permissions` | Approves all tool calls (per docs, not tested) |
| `--mode accept-edits`, create and overwrite files outside temp | **Allowed** |
| `--mode accept-edits`, shell command | **Soft-denied**, same as default mode. This is Standard |
| `--mode auto` | Not tested |

Pre-granted rules use `action(target)` (`command(git)`, `write_file(src/)`, `read_file(*)`, `mcp(server/*)`) in `permissions.allow/ask/deny` of `~/.gemini/antigravity-cli/settings.json`, with Deny > Ask > Allow. **There is no per-run flag for rules**, so BojuBot can't express Read-only or Chat only as rules without editing the user's global settings.

**Workspace trust.** A headless run in a directory not in `trustedWorkspaces` worked normally (verified). No trust step is needed, unlike Gemini CLI.

**Models.** `agy models` prints `id<TAB>name` lines, verified: `gemini-3.8-flash-high/medium/low`, `claude-sonnet-4-6`, `claude-opus-4-6-thinking`, `gpt-oss-120b-medium`. An unknown `--model` exits non-zero rather than falling back. The Claude and GPT models draw on a **separate quota group** from Gemini, and none of it touches the user's Anthropic plan.

**Effort.** `--effort low|medium|high|xhigh|max` per `--help` (the docs list only low/medium/high).

**Plan usage.** `agy --output-format json --print "/usage"` returns structured JSON in about 1.7 s, at zero token cost: per model group, `weekly` and `5h` buckets with `remaining_fraction` and `reset_time`. Ten small test turns used about 1% of the Gemini 5-hour window.

**Context and extras.** Reads `GEMINI.md` and `AGENTS.md` from the working directory (the analog of `CLAUDE.md`). MCP via `mcp_config.json`, skills in `.agents/skills/`, `--add-dir`, `--json-schema`, `--remote-control`, `--sandbox`.

**UI Bridge.** Given BojuBot-style instructions, `gemini-3.8-flash-low` and `-high` each emitted a valid, parseable `@@BOJU {"action":"open-file",…}` line followed by normal text (2 of 2 runs). Encouraging, not conclusive; see Testing.

### Gemini CLI 0.64.0 (read from source; access-limited)

Documented for a later adapter. It fits the same seam with these differences:

- Headless: `-p` appends to stdin input; `-o stream-json` events `init {session_id, model}`, `message {role, content, delta: true}` (deltas only), `tool_use {tool_name, tool_id, parameters}`, `tool_result {tool_id, status, output, error {type, message}}`, `error {severity, message}`, `result {status, stats}`.
- Denials: in non-interactive mode, "ask" becomes "deny"; the tool result errors with `policy_violation`.
- Sessions: `--resume <uuid>` (matches the UUID first) and `--session-id <uuid>` to choose the ID up front. Stored per working directory.
- `--approval-mode default|auto_edit|yolo|plan`; `--policy` files for rules.
- **Untrusted folders are fatal headless.** It needs `--skip-trust` or `GEMINI_CLI_TRUST_WORKSPACE=true`, and untrusted folders also force approval mode to `default` and disable MCP. That needs an explicit "trust this vault" consent step.
- Models: aliases `auto`, `pro`, `flash`, `flash-lite` are more stable than IDs, which are in flux (`gemini-2.5-pro`, `gemini-3.5-flash`, `gemini-3.x` previews).
- Also offers `--acp` (Agent Client Protocol), which supports per-tool-call permission requests (relevant to #357).

---

## Architecture

### The seam: `AgentBackend`

Today `src/ClaudeProcess.ts` owns binary detection, capability probing, spawn args and stream parsing. Everything above it (`SessionCoordinator`, `ClaudeView`, `UIBridge`, `ContextManager`) consumes the `StreamCallbacks` contract (`onText`, `onTextPreview`, `onAction`, `onQuery`, `onToolCall`, `onToolResult`, `onApiError`, `onPermissionDenied`, `onUsage`, `onDone`, `onError`). **That contract stays as it is**, and each backend translates its CLI's stream into it.

```ts
type BackendId = 'claude-code' | 'antigravity';   // later: 'gemini-cli'

interface AgentBackend {
  id: BackendId;
  displayName: string;                       // "Claude Code", "Antigravity"
  findBinary(override?: string): string | null;
  probe(binary: string, env: Env, cwd: string): Promise<BackendCapabilities>;
  listModels(caps: BackendCapabilities): Promise<ModelOption[]>;  // static for Claude, `agy models` for Antigravity
  spawnTurn(opts: TurnOptions): ChildProcess;                     // prompt always via stdin
  parseStream(proc: ChildProcess, cb: StreamCallbacks): void;
  permissionSupport: Record<PermissionMode, 'native' | 'approximate' | 'unavailable'>;
  orientation: { agentLabel: string; permissions: Record<PermissionMode, PermissionDescription> };
  features(caps: BackendCapabilities): {
    resume: boolean; compact: boolean; effort: string[]; partialStreaming: boolean;
    planUsage: boolean; readableHistory: boolean; contextWindow(model: string): number | null;
  };
  fetchPlanUsage?(binary: string, env: Env, cwd: string): Promise<PlanUsage>;
}
```

- `ClaudeCodeBackend` is today's `ClaudeProcess.ts` moved behind the interface. Spawn args must stay byte-identical; the existing `buildSpawnArgs`/`permissionArgs` tests pin that.
- `launchClaude()`'s Windows PowerShell wrapper becomes a shared `launchCli(binary, args, cwd, env)`. Verified to work for `agy.exe` from Node.
- `PlanUsage` becomes a structured type (`groups → buckets {window, remainingFraction, resetsAt}`); Claude's text output is wrapped, Antigravity's JSON maps directly. This also feeds the Phase 2 usage meter in `cli-modernization-spec.md`.

### Antigravity stream adapter

| `agy` event | Translated to |
| --- | --- |
| `init` | session ID (`conversation_id`), model |
| `step_update` `agent_response` `ACTIVE` + `text_delta` | append to step buffer → `onTextPreview(stepText)` |
| `step_update` `agent_response` `DONE` | final delta appended → same `@@BOJU` extraction as Claude's `assistant` text → `onAction` / `onQuery` / `onText(clean)`; `onTextPreview('')` |
| `step_update` `tool` `ACTIVE` | `onToolCall(tool_name, tool_info.parameters, \`${conversation_id}:${step_index}\`)` |
| `step_update` `tool` `DONE` / `ERROR` | `onToolResult(id, output ?? error.message)` |
| any `DONE` step with `usage` | sum into the turn's `onUsage` (never use cumulative `result.usage`) |
| step with `subagent_info` | ignored, like Claude's `parent_tool_use_id` |
| `result` | `denied_actions` → `onPermissionDenied([{tool: display_name, input: action}])`; `status` → `onDone(id, status === 'SUCCESS')`; `error` → `onError` / API-error card |

The `@@BOJU` line parsing moves out of Claude's `handleMessage()` into a shared function both adapters call on a completed text segment. `previewForDisplay()` already handles partial lines, so the live-preview rules are unchanged.

### Permission modes

| BojuBot mode | Claude Code (today) | Antigravity | Support |
| --- | --- | --- | --- |
| Standard | `acceptEdits` + `--permission-prompts none` | `--mode accept-edits`: file writes allowed, commands soft-denied → `denied_actions` | **native** (verified) |
| Full access | `bypassPermissions` | `--dangerously-skip-permissions` | **native** |
| Read only | `manual` + `--allowedTools Read,Glob,Grep,WebFetch,WebSearch` | `--mode plan` | **approximate:** no workspace writes (verified), but it answers with plans and asks for approval rather than refusing |
| Chat only | `--allowedTools WebFetch,WebSearch` + temp-dir cwd | no per-run equivalent | **unavailable** in the MVP (see open questions) |

- Differences users will notice: Antigravity's Standard denies **all** shell commands unless the user pre-allows them in its `settings.json`, while Claude's Standard lets read-only commands such as `ls` through. Its denials only name the action (`RunCommand`), not the command, so the denial card shows less detail.
- The denial card's "Allow full access for this session" retry becomes a respawn with `--dangerously-skip-permissions`.
- Permission UI hides or disables modes marked `unavailable` for the session's backend, with a one-line reason.

### Session history

Claude Code's `~/.claude/projects/*.jsonl` is readable; Antigravity's SQLite store isn't. Rather than parsing a private format, BojuBot keeps its **own transcript**: one `sessions/<id>.transcript.jsonl` alongside the session JSON, appended as each turn completes (user text as displayed, assistant text, tool rows, denials). It's used when `features().readableHistory` is false, so Claude keeps reading its own history exactly as today. A later step could make the transcript the single source for both backends, which would also simplify exports.

### Session model

- `StoredSession` gains `backend?: BackendId`; absent means `claude-code`, so every existing session loads unchanged. The existing `claudeSessionId` key is kept as the stored conversation ID for both backends (renaming it would need a migration for no user benefit).
- A session is **bound to its backend**. Conversations can't move between CLIs, so switching backend means a new session. The model picker for an existing session lists only its backend's models.
- `canResumeLocally()` becomes backend-aware: for Antigravity, the transcript's existence decides whether history shows; resume uses `--conversation`.

### What changes outside the backend

| Area | Change |
| --- | --- |
| `src/ClaudeProcess.ts` | Split into `src/backends/` (`types.ts`, `process.ts` for launch/run/kill, `modes.ts`, `claudeCode.ts`, `antigravity.ts`, `index.ts` registry); stream parsing pure and unit-tested |
| `main.ts` | Probe the selected backend(s) at startup; per-backend capabilities in memory; "binary not found" notices name the backend |
| `src/SessionCoordinator.ts` | `host.getBackend(session)`; resume, compact and plan usage go through backend features; stores `backend` |
| `src/ContextManager.ts`, `src/orientation.md` | "Claude Code subprocess" becomes `{{AGENT}}`; `PERMISSION_DESCRIPTIONS` (which name `Read`, `Bash`, `WebFetch`…) come from `backend.orientation`; the memory instruction stops naming "Write or Edit tool" |
| `src/utils/toolFormatting.ts` | Detail extraction for Antigravity parameters (`AbsolutePath`, `TargetFile`, `CommandLine`, search patterns) |
| `src/TokenGauge.ts` | Context window from `features().contextWindow(model)` instead of the fixed `200_000`; compact hidden when unsupported (no `agy` equivalent verified) |
| `src/settings.ts` | Backend selector; per-backend binary path; `defaultModel` per backend (Antigravity's list from `agy models`, cached per launch) |
| `src/modals/CustomSessionModal.ts` | Backend field; model, effort and permission fields follow the chosen backend |
| `src/ClaudeView.ts` | Model and effort pickers, `/usage`, slash entries, and gauge driven by the session's backend features; Claude-only commands hidden on Antigravity |
| `src/ContextGenerationModal.ts` | Spawns through the selected backend |
| About modal, settings | Show the active backend and its detected version |
| User-facing strings | About 45 strings mention "Claude"; generic ones become the backend or assistant name, Claude-specific ones stay but only show for Claude |
| Docs | New "Choosing a backend" guide page; setup, permissions and limitations per backend |

---

## Release plan

### Phase 0: groundwork

1. `dev` created from `main` (done).
2. Add `dev` to `.github/workflows/ci.yml` triggers (`push` and `pull_request`), so PRs into `dev` get the same build, lint and test checks as `main`.
3. Land this spec on `dev`.

### Phase 1: the seam (Claude only, no behavior change)

- Extract `AgentBackend`, the backend registry and `launchCli`; move Claude into `ClaudeCodeBackend`.
- Move `@@BOJU` segment parsing into a shared, tested function.
- Route `SessionCoordinator`, `ContextGenerationModal`, plan usage and probing through the registry (one backend for now).
- `ContextManager` and the orientation take their agent label and permission text from the backend; Claude's output must stay byte-for-byte identical.
- **Done when:** all existing tests pass unchanged, new tests pin Claude spawn args and orientation output, and a manual session in the test vault behaves exactly as before. This phase is low-risk and could merge to `main` early if useful.

**As built:** `src/backends/` holds `types.ts` (the interface and shared stream types), `process.ts` (`launchCli`, `runCli`, `killProcess`), `modes.ts` (`canWrite`, `resolveSpawnCwd`), `claudeCode.ts` (the former `ClaudeProcess.ts`, moved with history) and `index.ts` (registry). `splitBojuLines()` lives in `src/utils/bojuLines.ts` and `renderOrientation()` in `src/utils/orientation.ts`. `ContextManager` takes the backend's orientation as a required second argument, so no call site can silently fall back to Claude's wording. The interface has only the members Phase 1 routes through: `findBinary`, `probe`, `spawnTurn`, `parseStream`, `fetchPlanUsage`, `compactPrompt`, `orientation`. `listModels`, `permissionSupport`, `features()` and a structured `PlanUsage` arrive with Phase 2, which is their first user. The plugin's `claudeBinaryPath` and `cliCapabilities` fields also stay single-backend until then. Verified: all 16 orientation variants (4 modes × custom cwd × rebranded name) are byte-identical to the previous code. The only user-visible changes are two error messages, which now use the backend's name: "Claude binary not found" became "Claude Code binary not found", and "Failed to start claude" became "Failed to start Claude Code".

### Phase 2: Antigravity MVP

- `AntigravityBackend`: binary detection (`%LOCALAPPDATA%\agy\bin\agy.exe`, PATH, and the macOS/Linux equivalents to confirm), probe (`--version`, `--help`, `agy models`), spawn via stdin streaming input, stream adapter, `--conversation` resume.
- Permission modes: Standard, Full and Read-only per the table; Chat only shown as unavailable.
- Denial card from `denied_actions`; full-access retry.
- Model picker from `agy models`; effort from help-listed levels.
- BojuBot transcript store, and history display for Antigravity sessions.
- Tool row formatting; orientation and permission text for Antigravity.
- Backend selector (global default) and per-session backend in Custom Session.
- Context gauge: per-model window where known, otherwise usage-only with no ring percentage; compact hidden.
- `/usage` via `agy --print "/usage"` JSON.
- **Done when:** a Standard-mode Antigravity session in the test vault can chat, read and write notes, trigger UI Bridge actions and vault queries, survive an Obsidian restart and resume, run skills, and show a denial card for a shell command.

**As built so far:**
- **Step 1 (#361):** `src/backends/antigravity.ts` with fixture tests.
- **Step 2 (backend selection):**
  - `settings.backend` (the "Agent" dropdown), `agyBinaryPath` and `agyDefaultModel` (`''` = Antigravity's own default).
  - Per-backend runtime on the plugin: binary, capabilities, and the model list from `agy models`.
  - `StoredSession.backend`, and `SessionCoordinator` bound to a backend. An unstarted, unpinned new session follows a change of the default.
  - Custom Session "Agent" field.
  - Unavailable modes greyed out with their reason (`AgentBackend.unavailableModes`).
  - Gauge and compact hidden when `compactPrompt` is null.
  - Per-backend `/usage`, model picker and effort.
  - A not-found card for a non-Claude default agent.
  - The live preview callback is passed only when streaming is on.
- **Step 3 (transcript store):**
  - `AgentBackend.readableHistory`.
  - `sessions/<id>.transcript.jsonl`, appended once per completed turn that has a conversation ID. The user text is cleaned exactly like Claude Code history (vault context and `<bojubot-context>` tags removed, contexts kept for badges). The reply keeps its @@BOJU lines so query cards replay.
  - `hasReadableHistory()` and `loadHistory()` choose the CLI's history or the transcript. Resume, the session list ("Remote" badge, token estimate) and exporting a past session all go through them.
  - Deleting a session deletes its transcript.
  - Sessions from before step 3 resume with a note that their earlier messages weren't recorded.
- **Step 4 (polish):**
  - agy's stderr notice about a headless auto-denial is dropped (`isAgyDenialNotice()`), because the denial card already reports it.
  - `/usage` drops "left" after bucket names that already say "Remaining".
  - The context-file generator shows progress for Antigravity's tool names too (`contextGenStatusForTool()`).
  - `AgentBackend.modeDescriptions` gives the picker, Custom Session and the permission icon tooltip per-agent wording. On Antigravity, Standard reads "no shell commands".
  - **Gauge stays hidden on Antigravity (decided):** `agy` reports no context window size (not in `agy models`, `/usage` or the stream), and a guessed size would show a misleading percentage.
  - Antigravity onboarding moves to Phase 3.

### Phase 3: release hardening

- Onboarding: clear states for "agy not installed", "not authenticated" (with an Open terminal button, mirroring `renderAuthError()`), and "model unavailable".
- Decide Chat only for Antigravity (see open questions).
- Docs: "Choosing a backend", setup, per-backend permission differences and limitations, the Claude and GPT models available through Antigravity.
- Test matrix (below) on Windows; macOS/Linux spawn smoke test if a machine is available, otherwise documented as untested.
- `dev` → `main` PR. That release is a `feat:` minor bump.

**Releasable when:** every Claude Code behavior is unchanged; an Antigravity user can complete the Phase 2 checklist from a clean install by following the docs; and the unavailable features (Chat only, compact, any untested modes) are hidden with a reason rather than broken.

**As built so far (Phase 3):**
- **Errors and onboarding:**
  - `agyApiError()` turns a failed `result.error`, or a stderr error with no result, into an error card.
  - Not signed in gets an Open terminal button that runs `agy`. An unknown model points at the model picker.
  - The not-found card links the install guide and the one-time `agy` sign-in.
  - "Not signed in" couldn't be reproduced without signing the user out, because agy keeps its sign-in in the OS keyring. Detection matches agy's documented `authentication required` text.
- **Docs:** `docs/guide/agents.md` ("Choosing an Agent"), linked from requirements, permissions, settings and Custom Session.
- **UI Bridge reliability:** `test/agy-bridge-check.ts` runs 20 one-turn prompts with the real Standard orientation. Results on Antigravity's default model (agy 1.4.0, 2026-10-17):
  - Before Antigravity's `environmentNote`: 15/20 passed, 21/21 lines valid. Three prompts went digging in BojuBot's `main.js` and its GitHub source instead of acting.
  - After the note ("this orientation is all you need… don't read plugin files or fetch source… use the help query"): 17/20 passed, 23/23 lines valid. The three misses are acceptable:
    - a `help` inject query before the move, which the app follows up automatically
    - reading frontmatter instead of a `tags` query
    - one missing follow-up `show-notice`
  - Cost: about 0.2% of the Gemini 5-hour window per prompt. Other models (`gemini-3.8-flash-high`, and the Claude/GPT models on their separate quota) are not yet checked.

### Later

- Gemini CLI adapter for paid-API-key and Code Assist users, with the vault-trust consent step.
- Usage meter for both backends (structured `PlanUsage`).
- One persistent process per session: `agy --input-format stream-json` already supports multiple turns per process (#235).
- `agy --remote-control`, analogous to the `/remote-control` design in `cli-modernization-spec.md`.
- ACP (`gemini --acp`) as a route to per-tool-call approval (#357).

---

## Branch workflow

- `dev` is the integration branch. Feature branches start from `dev`, and their PRs target `dev`. Build, lint and test must pass before every PR, as on `main`.
- Scott tests from `dev`: the test vaults' plugin junction points at the repo root, so checking out `dev` and building is enough.
- Keep `dev` current by merging `main` into it whenever `main` moves (e.g. after #356 merges), so the final merge back is small.
- release-please only runs on `main`, so nothing on `dev` is released or added to the changelog until `dev` merges.
- **Feature PRs into `dev` are rebase-merged**, so every commit on a PR branch lands as-is. Each commit subject must be a clean conventional subject (`feat:`, `fix:`, `refactor:`, `docs:`): each one becomes a changelog line when `dev` reaches `main`.
- **The final `dev` → `main` merge is a merge commit (decided).** release-please builds the changelog from every commit subject that lands on `main`; a squash would collapse the whole effort into one entry. A rebase merge would also keep the entries, but it replays commits one by one: the merges from `main` that `dev` accumulates often can't be rebased cleanly, and the rewritten commit IDs would leave `dev` diverged from `main` afterward.

## Testing

- **Pure, unit-tested** (`test/unit.test.ts`): the Antigravity stream adapter, fed recorded fixtures from the verified runs above (plain reply, tool read, tool write, shell denial, plan mode, resumed turn); shared `@@BOJU` segment parsing; per-turn usage summing versus cumulative `result.usage`; `agy models` and `/usage` parsing; permission-mode → args mapping per backend; Claude spawn-args and orientation output unchanged.
- **UI Bridge reliability:** a scripted check of 20+ prompts per Antigravity model (actions, queries, multi-action replies), recording the valid-line rate before calling UI Bridge supported on that model.
- **Manual, per release candidate:** the Phase 2 checklist on both backends in the test vault, Windows first. Record the CLI versions in the PR.

## Open questions

1. **Read only:** accept `--mode plan` (no writes, but plan-style answers), or write deny rules into the user's global `agy` settings (affects their other `agy` use, so it would need consent)?
2. **Chat only on Antigravity:** leave it unavailable, or approximate it with `--mode plan` plus a temp-dir cwd and an orientation that forbids file tools? That wouldn't be a hard guarantee like Claude's tool allowlist.
3. **Default backend:** global setting only, or per vault? Should first run detect which CLIs are installed and ask?
4. **Transcript store:** use it for Claude too (one history source, simpler exports), or keep it Antigravity-only for the MVP?
5. **Context cost:** Antigravity adds ~11.8k tokens of its own system prompt per call with no cache reads reported, on top of BojuBot's orientation. Worth trimming BojuBot's first-turn context for Antigravity?

## Sources

- [Transitioning Gemini CLI to Antigravity CLI (google-gemini/gemini-cli discussion #27274)](https://github.com/google-gemini/gemini-cli/discussions/27274)
- [Antigravity CLI: headless mode](https://antigravity.google/docs/cli/headless)
- [Antigravity: permissions](https://antigravity.google/docs/permissions)
- [Antigravity CLI: migration from Gemini CLI](https://antigravity.google/docs/cli/gcli-migration)
- [Gemini CLI: headless mode](https://geminicli.com/docs/cli/headless)
- [Gemini CLI: quota and pricing](https://geminicli.com/docs/resources/quota-and-pricing)
- Gemini CLI 0.64.0 source: the `@google/gemini-cli` npm bundle (non-interactive runner, policy engine, session selector)
- Direct runs of `agy` 1.4.0 on 2026-10-16 (raw outputs not committed)

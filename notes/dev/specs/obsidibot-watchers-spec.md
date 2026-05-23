# ObsidiBot Watchers — Plugin Spec (DRAFT)

**Status: PROPOSED** — not yet implemented. Depends on Core Plugin API.

> Living document. Open items are tracked as TODOs. Decisions are noted inline.

---

## Architecture Note

**Watchers is a separate Obsidian plugin** (`obsidibot-watchers`), not a feature built into ObsidiBot core. It consumes the ObsidiBot Core Plugin API. It does not spawn Claude sessions directly — all session management goes through `core.api.sessions.spawn()`. If the Supervisor plugin is registered, session requests route through it automatically via the SessionRouter mechanism.

**Core API dependencies:**
- `core.api.sessions.spawn()` — session creation
- `core.api.skills.invoke()` — optional skill-based watcher actions
- `core.api.locks.isLocked()` / `core.api.locks.onChange()` — write-lock awareness
- `core.api.plugins.register()` / `.unregister()` — lifecycle registration
- `core.api.events` — publishing watcher lifecycle events to the bus

See `obsidibot-core-api-spec.md` for full interface definitions.

---

## Concept

A **Watcher** is a low-code automation definition — parallel to Skills — that monitors a file or folder for filesystem events and fires a Claude prompt in response. The mental model is `on <event>, do <prompt>`.

Watchers are defined as markdown files in a dedicated vault folder, parsed at plugin load, and hot-reloaded when the folder changes — the same live-reload pattern as Skills.

---

## Open Design Questions / TODOs

### Naming

- [ ] **Settle on the feature name.** Candidates: Watchers, Triggers, Automations, Dispatchers. "Watchers" describes mechanism; "Triggers" or "Automations" describes user intent. Decide before docs are written.

---

### Trigger Definition

- [ ] **Where do watcher definitions live?**
  - Option A: Dedicated folder (e.g. `_ObsidiBot Watchers/`), parallel to the Skills folder. Each watcher is a markdown file. Supports folder-level triggers. Easy to browse and manage.
  - Option B: Frontmatter embedded in the watched file itself (`obsidibot-watch: ...`). Elegant for self-watching notes; can't express folder-level triggers.
  - **Recommendation:** Option A as primary; Option B as a convenience shorthand for single-file self-watches. Frontmatter keys for Option B must be distinct from existing `obsidibot-context` and `obsidibot-instructions` keys. Suggestion: `obsidibot-watch-events`, `obsidibot-watch-prompt`.

- [ ] **Define the trigger event types:**
  - `created` — a new file matching the watch target appeared
  - `modified` — an existing file's content changed
  - `renamed` / `moved` — a file's path changed
  - `deleted` — a file was removed
  - [ ] Decide whether to support multiple event types per watcher, or one-event-per-file.

- [ ] **Define the watch target syntax:**
  - Specific file path
  - Folder path (non-recursive)
  - Folder path, recursive
  - Glob pattern (e.g. `Projects/**/*.md`)
  - [ ] Decide glob support scope for v1. Recommend `micromatch` or `picomatch` — small, no native deps, safe to bundle.

---

### Debouncing

- [ ] **Implement a configurable settle delay.** Obsidian fires change events on every keystroke in some modes. Default: ~1500ms after last change before the watcher fires. Expose as a per-watcher `debounce` field and as a global plugin setting.
- [ ] **Define debounce behavior for rapid sequential events.** Trailing edge (timer resets on each event) is the recommended default. Define whether multiple coalesced events produce one trigger or one per event.

---

### Infinite Loop Prevention

- [ ] **Check write-lock before triggering.** Before firing any watcher, call `core.api.locks.isLocked(changedPath)`. If locked, suppress the trigger — Claude is writing to that path and we do not want to re-trigger.
- [ ] **Subscribe to lock changes** via `core.api.locks.onChange()` at plugin load so the lock state is always current.
- [ ] **Decide additional loop detection strategy:**
  - Hard cooldown after firing (no re-trigger within N seconds)
  - Max-fires-per-session limit as a safety rail
  - Both, independently configurable

---

### Context Payload (What Claude Receives)

- [ ] **Define what Claude receives when a watcher fires:**
  - `path-only` — vault-relative path of the changed file
  - `full` — path + full file content
  - `diff` — path + unified diff (before/after); requires content cache — see Implementation Notes
  - [ ] Per-event-type defaults: `deleted` → path-only (file may be gone); `modified` → recommend `full` or `diff`; `created` → `full`.

- [ ] **Define the injection format.** How the trigger payload is prepended to the watcher prompt — e.g. a structured block similar to Core's `[Active note: ...]` convention.

---

### Session Model

- **Decision: Fresh session per watcher fire.** Reusing a shared named session accumulates unrelated history from every prior firing, increasing hallucination risk and token cost over time.
- [ ] **Define the watcher context injection stack.** Passed as `context` in `SessionOptions`. Should be lean and deterministic:
  - System orientation (minimal — what ObsidiBot is, that this is a watcher-triggered session)
  - Watcher-specific context file (`_watcher-context.md`, if present — see TODO below)
  - Trigger payload (event type, path, content/diff per above)
  - Watcher prompt body
  - **Omit:** vault tree, autonomous memory, active note, per-note frontmatter context
- [ ] **Decide whether a global `_watcher-context.md` is opt-in or always injected if present.**
- [ ] **Decide whether watchers can optionally resume a named session** for stateful use cases. If yes, define the opt-in syntax and document the context pollution tradeoff clearly in docs.

---

### Supervisor Routing

- [ ] **No direct watcher-to-supervisor coupling.** Watcher plugin calls `core.api.sessions.spawn()` normally. If the Supervisor plugin is registered as the session router, requests route through it automatically — the watcher plugin is unaware. This is the correct separation of concerns.
- [ ] **Watcher plugin should be able to detect whether a supervisor is present** (via `core.api.plugins.getSessionRouter() !== null`) for logging/observability purposes, but must not require it.

---

### Permission Model

- [ ] **Require explicit `permissions` field in watcher frontmatter.** Watchers fire autonomously — no user present to set permissions. No ambient inheritance from the interactive session.
  - Recommendation: Default to `read-only` if `permissions` field is omitted.
  - [ ] Confirm `read-only`, `standard`, `full-access` map cleanly to Core's `PermissionLevel` type (they should — use Core's type directly).

---

### File Format (Proposed Skeleton)

```yaml
---
watch: Projects/          # path, folder, or glob
events: [created, modified]
debounce: 1500            # ms; optional — overrides global plugin default
permissions: standard     # read-only | standard | full-access
payload: full             # path-only | full | diff
description: Summarize new project notes
enabled: true             # per-watcher toggle; default true
dry_run: false            # if true, logs what would fire without executing
---
When a note is created or modified in Projects/, read it and append
a one-line summary to [[Project Index]].
```

- [ ] **Finalize frontmatter field names and types.**
- [ ] **Define trigger variable interpolation.** Watchers can't use `params` (no user present), but the trigger event provides structured data available as tokens in the prompt body:

| Token | Value |
|---|---|
| `{{trigger_event}}` | `created`, `modified`, `renamed`, `deleted` |
| `{{trigger_path}}` | Vault-relative path of the changed file |
| `{{trigger_old_path}}` | Previous path (rename/move events only) |
| `{{trigger_content}}` | Full file content (if `payload: full`) |
| `{{trigger_diff}}` | Unified diff string (if `payload: diff`) |
| `{{trigger_timestamp}}` | ISO 8601 timestamp of the event |

Unresolved tokens (e.g. `{{trigger_old_path}}` on a non-rename event) are stripped cleanly, consistent with Skills behavior.

---

### UX / Observability

- [ ] **Decide how watcher activity surfaces to the user:**
  - Toast notification on fire
  - Entry in a Watcher Log panel (`ObsidiBot: Show watcher log` command)
  - Badge/indicator in chat panel
  - Silent by default
  - [ ] Should Claude's output from a watcher run be viewable, and if so, where? Session Manager with a ⚡ badge is one option.
- [ ] **Error handling.** What happens if the watcher prompt fails or Claude errors? Recommend: silent fail + log entry by default; configurable to toast.
- [ ] **Per-watcher enable/disable.** `enabled: false` in frontmatter. Global pause toggle in plugin settings.

---

### Settings (Watcher Plugin)

These settings live in the Watchers plugin settings panel, not Core.

- [ ] Watchers folder path (default: `_ObsidiBot Watchers/`)
- [ ] Global debounce default (ms)
- [ ] Global watcher enable/disable toggle
- [ ] Startup suppression window (ms) — suppress watcher fires for N ms after Obsidian loads
- [ ] Max file size for `payload: full` (with fallback to `path-only` and logged warning)
- [ ] Watcher log retention (entries or days)
- [ ] Default overflow behavior when Core's session concurrency ceiling is hit: `queue` | `drop`

> **Note:** Session concurrency ceiling and session timeout are Core settings, not Watcher settings. The Watcher plugin respects whatever Core enforces.

---

## Implementation Notes

### Obsidian API — Event Mapping

| Obsidian event | Maps to watcher trigger | Notes |
|---|---|---|
| `vault.on('create', ...)` | `created` | Fires for files and folders |
| `vault.on('modify', ...)` | `modified` | Fires on every save; needs debounce |
| `vault.on('rename', ...)` | `renamed` / `moved` | Callback receives new and old path |
| `vault.on('delete', ...)` | `deleted` | File may already be gone; path is what you have |

- Register listeners in `onload()` via `this.registerEvent(...)` — Obsidian's standard pattern; handles cleanup automatically.
- Debounce should be applied at the listener level, before watcher matching logic runs.

---

### State Caching for Diffs

If `payload: diff` is configured on any active watcher:

- Maintain an in-memory `Map<string, string>` (path → last-known content) for all files covered by at least one active `modified` + `diff` watcher.
- On `modified`: read current content, compute diff, update cache, fire watcher with diff payload.
- Cache populated at plugin load for all actively-watched files (cold start).
- On `delete`: evict from cache. On `rename`: re-key to new path.
- Large file consideration: if file exceeds configured max size, fall back to `path-only` and log a warning.

---

### Watcher Lifecycle

- **Loading:** Scan watchers folder at plugin load. Parse all watcher files; register Obsidian listeners for each enabled watcher.
- **Hot-reload:** Watch the watchers folder itself. When a watcher file changes, re-parse and update listeners — no restart required.
- **Teardown:** On plugin unload, all registered listeners are released via Obsidian's `registerEvent` cleanup. Any in-flight sessions are killed via `SessionHandle.kill()`.
- **Startup suppression:** Suppress watcher fires for a configurable window after vault open to avoid firing on Obsidian's own startup file-touch events.

---

### Watcher Matching Logic

When a filesystem event fires:

1. Check `core.api.locks.isLocked(changedPath)`. If locked, suppress and return.
2. Match event type against each watcher's `events` list.
3. Match file path against each watcher's `watch` target (exact, folder prefix, or glob via `micromatch`/`picomatch`).
4. For all matching watchers: assemble context + prompt, call `core.api.sessions.spawn()`.
5. Multiple matching watchers fire independently, optionally staggered by ~200ms to avoid hammering the session API simultaneously.

---

### Skill Invocation from Watchers

- [ ] **Decide v1 scope.** A watcher that specifies `skill: Weekly Review` instead of an inline prompt body invokes that skill via `core.api.skills.invoke()`. This allows watcher actions to reuse param-free, autorun skills without duplicating prompt logic.
- This requires the watcher plugin to know about the skills system — acceptable since both depend on Core, but worth flagging as a v2 candidate if it adds implementation complexity early.

---

### Developer/Debug Experience

- **Dry-run mode:** Per-watcher `dry_run: true` (or global plugin setting). Logs what would be sent to Core without actually spawning a session. Essential for testing watcher definitions safely.
- **Manual trigger:** `ObsidiBot: Fire watcher manually` command. User selects a watcher file and a target file; fires the watcher immediately without a filesystem event.
- **Watcher log:** In-memory (or file-based) log of recent fires: timestamp, watcher name, event type, target file, outcome. Surfaced via `ObsidiBot: Show watcher log`.

---

### Edge Cases & Failure Modes

- **Vault close during watcher execution:** Track in-flight `SessionHandle` references; call `kill()` on all of them in `onunload()`.
- **Watcher file watches its own containing folder:** Auto-exclude the watchers folder from all watch targets, or warn the user.
- **Watch target doesn't exist at load time:** Register the listener anyway; fire when the target is eventually created. Log a warning at load.
- **Binary files:** Watchers matching non-markdown files should default to `path-only` payload regardless of configured `payload` setting. Flag for v1 scope decision.

---

## Decided

| Decision | Resolution |
|---|---|
| Implementation location | Separate Obsidian plugin (`obsidibot-watchers`); not in Core |
| Session spawning | Via `core.api.sessions.spawn()` only; no direct CLI access |
| Supervisor coupling | None — routing through supervisor is automatic via Core's SessionRouter |
| Session model | Fresh session per watcher fire |
| Session context | Trimmed stack (no vault tree, no autonomous memory, no active note) |
| Primary definition location | Standalone files in a dedicated Watchers folder |
| Permission model | Explicit in watcher frontmatter; defaults to `read-only` if omitted |
| Write-lock checking | Via `core.api.locks` before every trigger |
| Concurrency enforcement | Delegated to Core; Watcher plugin respects Core's ceiling |

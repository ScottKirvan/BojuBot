# ObsidiBot Supervisor — Plugin Spec (DRAFT)

> Living document. Open items are tracked as TODOs. Decisions are noted inline.

---

## Architecture Note

**Supervisor is a separate Obsidian plugin** (`obsidibot-supervisor`), not a feature built into ObsidiBot core. It registers itself as Core's session router via `core.api.plugins.setSessionRouter()`. Once registered, all session spawn requests from any plugin — including Watchers — route through the Supervisor before being dispatched. Plugins that call `core.api.sessions.spawn()` are unaware of the Supervisor's presence; routing is transparent.

The Supervisor is **lazy-loaded and opt-in** — it only activates if installed. When not installed, Core dispatches sessions directly.

**Core API dependencies:**
- `core.api.plugins.setSessionRouter()` — register as session router
- `core.api.plugins.unregister()` — lifecycle cleanup
- `core.api.events` — subscribe to session lifecycle events
- `core.api.sessions.active()` — inspect running sessions
- `core.api.permissions` — permission level checking

See `obsidibot-core-api-spec.md` for full interface definitions.

---

## Concept

The Supervisor is a persistent orchestration layer that manages multiple concurrent Claude Code sessions on behalf of other plugins and agentic workflows. Its responsibilities are:

1. **Queue and throttle** session requests to prevent runaway parallelism
2. **Track agent fleet state** — which sessions are running, what they're doing, what permissions they hold
3. **Handle permission escalation** — sub-agents that hit a permission block notify the Supervisor, which decides whether to escalate, surface to the user, or cancel
4. **Provide feedback routing** — agent output surfaces through ObsidiBot's UI rather than being lost to logs
5. **Coordinate multi-agent workflows** — specifically the pattern where sub-agents (e.g. Claude Code instances working GitHub issues) checkpoint back to the vault, and the Supervisor acts on those checkpoints

---

## Primary Use Case: Multi-Agent Development Pipeline

The motivating use case is a fleet of headless Claude Code agents, each assigned a GitHub issue, working autonomously. The Supervisor:

- Assigns issues to agents (or delegates assignment to a skill)
- Tracks each agent's current status via a vault note per agent
- Receives checkpoint notifications when agents write their status back to vault (via Watchers)
- Makes permission escalation decisions
- Re-invokes agents with updated context or elevated permissions when appropriate
- Surfaces fleet status in the Supervisor panel

The vault is the coordination layer. Each agent has a corresponding status note. The Supervisor reads and writes these notes as the source of truth for fleet state.

---

## Open Design Questions / TODOs

### Agent State Model

- [ ] **Define the agent status note schema.** Each running agent has a corresponding vault note (e.g. `_ObsidiBot Agents/<session-id>.md`). Proposed frontmatter:

```yaml
---
obsidibot-agent-id: <session-id>
obsidibot-agent-status: running  # running | waiting | complete | error | permission-blocked
obsidibot-agent-issue: "#42"
obsidibot-agent-permissions: standard
obsidibot-agent-started: 2026-04-28T10:00:00Z
obsidibot-agent-updated: 2026-04-28T10:05:00Z
---
## Current Task
...

## Checkpoint
Agent is requesting permission to push to main branch.

## Output Log
...
```

- [ ] **Decide who creates and deletes agent notes.** Supervisor creates them on session spawn; archives or deletes on session complete.
- [ ] **Decide whether Watchers watches the agents folder.** This is the natural wiring — a Watcher on `_ObsidiBot Agents/` fires the Supervisor's review skill when an agent updates its status note. Document this as the recommended configuration.

---

### Session Routing

- [ ] **Define the router's decision surface.** When a session request arrives via `route()`:
  - Check current concurrency against ceiling
  - If at ceiling: queue or reject based on plugin settings
  - Assign queue priority (FIFO by default; configurable)
  - Log the request to the Supervisor's activity log
  - Dispatch when a slot opens
- [ ] **Define queue behavior:**
  - Max queue depth (drop oldest or newest when exceeded?)
  - Queue timeout (how long a request waits before being dropped?)
  - Priority overrides — should interactive user sessions always jump the queue?

---

### Permission Escalation

- [ ] **Define the escalation flow.** When a session hits a permission block (Core fires `session:permission-blocked` event):
  1. Supervisor receives the block event via `core.api.events`
  2. Supervisor checks its escalation policy for the session's source plugin and permission level
  3. Options:
     - **Auto-escalate:** If the block is within a pre-approved escalation envelope (e.g. "always allow standard→full-access for agents working on feature branches"), escalate automatically and retry
     - **Queue for review:** Write the block to the agent's status note; surface a notification to the user; wait for user decision
     - **Cancel:** Kill the session and log the reason
- [ ] **Define the escalation policy schema.** Per-source-plugin rules, per-permission-level rules, or both.
- [ ] **Define the user review UI.** A card in the Supervisor panel showing: which agent, what it tried to do, what was blocked, with Approve / Deny / Approve Always buttons.

---

### Feedback Routing

- [ ] **Define where agent output surfaces.** Options:
  - Written to the agent's vault status note (always)
  - Surfaced in a Supervisor panel in the ObsidiBot sidebar
  - Toast notification on completion or error
  - [ ] Decide v1 minimum: vault note write + toast on terminal events (complete/error) is probably sufficient.
- [ ] **Decide whether agent sessions appear in Core's Session Manager.** Recommend yes, with a distinct badge (e.g. ⚡ for watcher-spawned, 🤖 for supervisor-managed). The Session Manager becoming a fleet dashboard is a natural evolution.

---

### Supervisor Panel UI

- [ ] **Define the Supervisor panel.** A sidebar panel (or tab within the ObsidiBot panel) showing:
  - Active agents: session ID, label, status, elapsed time, current permission level
  - Queue: pending session requests
  - Recent completions
  - Permission escalation requests requiring user review
- [ ] **Decide whether the panel is always visible or on-demand.** On-demand (command palette + ribbon icon) matches ObsidiBot's existing pattern.

---

### Concurrency Settings

These settings live in the Supervisor plugin settings panel.

- [ ] Max concurrent sessions (default: 3)
- [ ] Queue max depth
- [ ] Queue timeout (ms before a queued request is dropped)
- [ ] Overflow behavior: `queue` | `drop` | `error`
- [ ] Interactive session priority: always jump queue? (default: yes)
- [ ] Escalation policy definitions
- [ ] Agent notes folder path (default: `_ObsidiBot Agents/`)

---

### Watcher Integration (Recommended Configuration)

The Supervisor does not directly depend on the Watchers plugin, but the two work together naturally:

- A Watcher on `_ObsidiBot Agents/` with event `modified` fires a skill (or inline prompt) that reads the updated agent note and routes it to the Supervisor's review logic.
- The Supervisor's review skill reads the agent's status, checks if it's a checkpoint requiring action, and either continues the agent (re-spawns with updated context) or surfaces it to the user.
- This is the mechanism for true back-and-forth between a supervisor and sub-agents within ObsidiBot's architecture — no additional message bus required.

Document this configuration as a recommended setup guide, not a hard dependency.

---

## Implementation Notes

### Registration

```typescript
// obsidibot-supervisor/main.ts — onload()

const core = app.plugins.getPlugin('obsidibot') as ObsidiBotCore;

core.api.plugins.register({
  id: 'obsidibot-supervisor',
  name: 'ObsidiBot Supervisor',
  version: this.manifest.version,
});

core.api.plugins.setSessionRouter({
  route: async (options, dispatch) => {
    return this.router.handle(options, dispatch);
  }
});

// onunload()
core.api.plugins.setSessionRouter(null);
core.api.plugins.unregister('obsidibot-supervisor');
```

---

### Fleet State Persistence

- Agent state notes in `_ObsidiBot Agents/` serve as the durable fleet state — they survive Obsidian restarts.
- In-memory queue and router state is ephemeral and rebuilt from vault notes on plugin load.
- On load: scan `_ObsidiBot Agents/` for notes with `obsidibot-agent-status: running` — these represent sessions that were interrupted by an Obsidian restart. Mark them as `error` with reason `interrupted`.

---

### Edge Cases & Failure Modes

- **Supervisor crashes while sessions are running:** Sessions continue (they're Core subprocesses); their output is not routed. On Supervisor reload, interrupted sessions are detected and marked as noted above.
- **Circular routing:** If the Supervisor's own escalation logic spawns a new session, that request re-enters the router. The router must detect Supervisor-originated requests and dispatch them directly to avoid infinite recursion.
- **Core not present:** Plugin should fail gracefully if ObsidiBot core is not installed or its API is unavailable. Surface a clear error message rather than silently doing nothing.

---

## Decided

| Decision | Resolution |
|---|---|
| Implementation location | Separate Obsidian plugin (`obsidibot-supervisor`); not in Core |
| Activation model | Lazy-loaded; opt-in via installation |
| Session routing registration | Via `core.api.plugins.setSessionRouter()` |
| Agent state persistence | Vault notes in `_ObsidiBot Agents/` |
| Watcher coupling | None — Watcher/Supervisor integration is a recommended configuration, not a hard dependency |
| Concurrency enforcement | Supervisor owns this when installed; Core enforces its own ceiling as a fallback |

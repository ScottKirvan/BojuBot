# BojuBot — Core Plugin API Spec (DRAFT)

**Status: PROPOSED** — not yet implemented. Prerequisite for the Watchers, Supervisor, and MCP server plugins.

> Living document. This spec defines the internal API that BojuBot core exposes to first- and third-party plugins. It is the foundational contract that all other BojuBot plugin specs depend on.

---

## Architecture Overview

BojuBot is structured in two layers:

**Core** (`bojubot` Obsidian plugin) manages the Claude Code subprocess, session lifecycle, context injection, permission enforcement, and the chat UI. Core is the only component that touches the `claude` CLI directly.

**Plugins** are separate Obsidian plugins that consume Core's API to add capabilities. Plugins are lazy-loaded — they only activate if installed. First-party plugins include:
- `bojubot-watchers` — filesystem event automation
- `bojubot-supervisor` — multi-agent orchestration
- `bojubot-mcp` — MCP server exposing skills as external tools

Third parties can build additional plugins against the same API.

**Access pattern:** Any Obsidian plugin reaches Core via:

```typescript
const core = app.plugins.getPlugin('bojubot') as BojuBotCore;
```

Core exposes a stable `api` property on its plugin instance. All interaction goes through `core.api`.

---

## Core API

### Top-Level Interface

```typescript
interface BojuBotCoreAPI {
  sessions: SessionAPI;
  skills: SkillAPI;
  permissions: PermissionAPI;
  events: EventBusAPI;
  locks: WriteLockAPI;
  plugins: PluginRegistryAPI;
}
```

---

### SessionAPI

Manages Claude Code subprocess sessions.

```typescript
interface SessionAPI {
  /**
   * Spawn a new headless Claude session.
   * Returns a handle for monitoring and control.
   * If a supervisor is registered, the request routes through it first.
   */
  spawn(options: SessionOptions): Promise<SessionHandle>;

  /**
   * List all currently active sessions.
   */
  active(): SessionHandle[];

  /**
   * Retrieve a session by ID.
   */
  get(id: string): SessionHandle | null;
}

interface SessionOptions {
  /** The prompt to send. May include {{token}} interpolations resolved before invocation. */
  prompt: string;

  /** Permission level for this session. Required — no ambient inheritance for headless sessions. */
  permissions: PermissionLevel;

  /**
   * Additional context injected before the prompt.
   * Core does NOT inject the standard startup stack (vault tree, autonomous memory, active note)
   * for headless sessions unless explicitly included here.
   */
  context?: string;

  /** Tag for display in the Session Manager UI. Optional. */
  label?: string;

  /** Maximum time in ms before the session is killed. Default: configurable in Core settings. */
  timeout?: number;

  /** If true, session does not appear in the Session Manager UI. Default: false. */
  silent?: boolean;

  /** Source plugin ID, for attribution in logs and UI. */
  sourcePlugin?: string;
}

interface SessionHandle {
  readonly id: string;
  readonly status: SessionStatus;
  readonly options: Readonly<SessionOptions>;
  readonly startedAt: Date;

  /** Subscribe to session lifecycle events. */
  on(event: 'complete', handler: (output: SessionOutput) => void): void;
  on(event: 'error', handler: (error: SessionError) => void): void;
  on(event: 'timeout', handler: () => void): void;
  on(event: 'permission-blocked', handler: (block: PermissionBlock) => void): void;

  /** Kill the session immediately. */
  kill(): void;
}

type SessionStatus = 'queued' | 'running' | 'complete' | 'error' | 'timeout' | 'killed';

interface SessionOutput {
  sessionId: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

interface SessionError {
  sessionId: string;
  message: string;
  raw?: string;
}

interface PermissionBlock {
  sessionId: string;
  operation: string;
  path?: string;
  /** Call to escalate permission and retry. Available only for interactive sessions. */
  escalate?: () => void;
}

type PermissionLevel = 'read-only' | 'standard' | 'full-access';
```

---

### SkillAPI

Invokes skills defined in the vault's Skills folder.

```typescript
interface SkillAPI {
  /**
   * List all available skills.
   */
  list(): SkillDefinition[];

  /**
   * Invoke a skill by name.
   * Param-free and autorun skills only — no modal form is shown for headless invocations.
   * Returns a SessionHandle.
   */
  invoke(skillName: string, options?: SkillInvokeOptions): Promise<SessionHandle>;

  /**
   * Resolve a skill's prompt body with given param values, without executing.
   * Useful for building composed prompts.
   */
  resolve(skillName: string, params?: Record<string, string>): string | null;
}

interface SkillDefinition {
  name: string;
  path: string;
  description?: string;
  category?: string;
  autorun: boolean;
  params: SkillParam[];
}

interface SkillParam {
  id: string;
  type: 'input' | 'textarea' | 'dropdown' | 'checkboxes' | 'note';
  label: string;
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

interface SkillInvokeOptions {
  params?: Record<string, string>;
  permissions?: PermissionLevel;
  context?: string;
  timeout?: number;
  sourcePlugin?: string;
}
```

---

### PermissionAPI

Reads and temporarily overrides permission levels.

```typescript
interface PermissionAPI {
  /** Current global permission mode set in Core settings. */
  current(): PermissionLevel;

  /**
   * Check whether a specific operation would be permitted at a given level.
   */
  check(operation: string, level: PermissionLevel): boolean;
}
```

---

### EventBusAPI

Publish/subscribe bus for BojuBot lifecycle events.

```typescript
interface EventBusAPI {
  on(event: BojuBotEventType, handler: EventHandler): Unsubscribe;
  emit(event: BojuBotEventType, payload?: unknown): void;
}

type Unsubscribe = () => void;

type BojuBotEventType =
  | 'session:spawned'
  | 'session:complete'
  | 'session:error'
  | 'session:timeout'
  | 'session:killed'
  | 'session:permission-blocked'
  | 'skill:invoked'
  | 'skill:complete'
  | 'plugin:registered'
  | 'plugin:unregistered';

type EventHandler = (payload: unknown) => void;
```

---

### WriteLockAPI

Tracks which vault paths are currently being written by an active Claude session. Prevents watcher re-triggering on Claude's own writes.

```typescript
interface WriteLockAPI {
  /** Returns true if the given vault-relative path is currently locked. */
  isLocked(path: string): boolean;

  /**
   * Returns all currently locked paths.
   */
  locked(): string[];

  /**
   * Subscribe to lock state changes for a path.
   */
  onChange(handler: (path: string, locked: boolean) => void): Unsubscribe;
}
```

---

### PluginRegistryAPI

Allows plugins to register capabilities with Core.

```typescript
interface PluginRegistryAPI {
  /**
   * Register a plugin. Core tracks registered plugins for UI attribution and lifecycle management.
   */
  register(plugin: BojuBotPluginManifest): void;

  /**
   * Unregister a plugin. Called on plugin unload.
   */
  unregister(pluginId: string): void;

  /**
   * Register a session router. When set, all session.spawn() calls route through
   * the router before being dispatched. Only one router may be registered at a time.
   * The supervisor plugin uses this to intercept and manage session requests.
   */
  setSessionRouter(router: SessionRouter | null): void;

  /**
   * Get the currently registered session router, if any.
   */
  getSessionRouter(): SessionRouter | null;
}

interface BojuBotPluginManifest {
  id: string;
  name: string;
  version: string;
}

interface SessionRouter {
  /**
   * Called before a session is spawned.
   * May modify options, queue the request, or reject it.
   * Must call dispatch() to proceed with session creation, or throw to cancel.
   */
  route(
    options: SessionOptions,
    dispatch: (options: SessionOptions) => Promise<SessionHandle>
  ): Promise<SessionHandle>;
}
```

---

## Open Design Questions / TODOs

- [ ] **API versioning strategy.** Core API will evolve. Define how breaking changes are communicated and how plugins declare which API version they target.
- [ ] **Error boundary.** If a plugin's event handler or session router throws, Core must not crash. Define the isolation contract.
- [ ] **Session router conflict.** Only one router can be registered. Define what happens if a second plugin tries to register one (error? warning? last-writer-wins?).
- [ ] **Async router chains.** Consider whether the router model needs to support chained routers (middleware pattern) for future extensibility.
- [ ] **Capability discovery.** Should plugins be able to query what other plugins are registered? Relevant if watchers want to check whether a supervisor is present before deciding how to route.

---

## Decided

| Decision                 | Resolution                                                                      |
| ------------------------ | ------------------------------------------------------------------------------- |
| Sub-process ownership    | Core only. No plugin touches the `claude` CLI directly.                         |
| Session routing          | Routed through registered SessionRouter if present; dispatched directly if not. |
| Headless session context | No standard startup stack injected unless explicitly passed in `context`.       |
| Permission inheritance   | Headless sessions must declare permissions explicitly. No ambient inheritance.  |
| Plugin access pattern    | `app.plugins.getPlugin('bojubot').api`                                          |

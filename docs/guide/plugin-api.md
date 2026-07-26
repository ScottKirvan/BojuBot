# Plugin API

BojuBot exposes a typed event API through `SessionCoordinator` for building external plugins and integrations. This API is in early access — the event set is stable, but the host interface may grow as more capabilities are added.

::: info Status
The plugin API is available in BojuBot 2.14.0 and later. It is designed for supporters and contributors who want to extend BojuBot's core functionality.
:::

## Overview

`SessionCoordinator` is the session and turn lifecycle manager inside BojuBot. It owns session state (ID, title, timestamps), spawns Claude turns, and emits typed events as the stream progresses. External plugins subscribe to those events to react to what Claude is doing without coupling to BojuBot's internal DOM or chat UI.

## Accessing the coordinator

The coordinator is exposed on the active `ClaudeView` instance:

```typescript
import { VIEW_TYPE_CLAUDE, ClaudeView } from 'bojubot/src/ClaudeView';

const leaf = app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE)[0];
const view = leaf?.view as ClaudeView | undefined;
const coordinator = view?.coordinator;

if (coordinator) {
  coordinator.on('turn:done', (result) => {
    // your code here
  });
}
```

The coordinator reference is stable for the lifetime of the view — you do not need to re-acquire it when sessions change.

## Events

All events are typed. Import `SessionCoordinatorEvents` for the full type map.

### Session events

| Event             | Payload                             | When                                                        |
| ----------------- | ----------------------------------- | ----------------------------------------------------------- |
| `session:new`     | `(session: StoredSession)`          | A fresh session placeholder was created                     |
| `session:loaded`  | `(payload: SessionLoadedPayload)`   | A session was loaded from the session list                  |
| `session:updated` | `(updates: { title?, sessionId? })` | The session title or Claude session ID changed after a turn |

`SessionLoadedPayload`:
```typescript
interface SessionLoadedPayload {
  session: StoredSession;  // session metadata
  messages: ChatMessage[]; // loaded history (empty if remote/new)
  isNew: boolean;          // session has no prior Claude conversation
  canResume: boolean;      // history is available locally
}
```

### Turn events

These fire in order during a Claude turn:

| Event               | Payload                        | When                                                             |
| ------------------- | ------------------------------ | ---------------------------------------------------------------- |
| `turn:start`        | `()`                           | Claude process spawned                                           |
| `turn:text`         | `(accumulated: string)`        | Text chunk received; `accumulated` is the full clean text so far |
| `turn:action`       | `(action: BojuBotAction)`      | UI bridge action parsed (excludes `request-permission`)          |
| `turn:tool-call`    | `(tool, input, toolUseId)`     | Claude initiated a tool call                                     |
| `turn:tool-result`  | `(toolUseId, content)`         | Tool result received                                             |
| `turn:query`        | `(query: VaultQuery)`          | Claude issued a vault query (backlinks, outlinks, tags, file-list) |
| `turn:usage`        | `(usage: TokenUsage)`          | Token usage statistics                                           |
| `turn:stderr`       | `(err: string)`                | stderr output (non-fatal)                                        |
| `turn:error`        | `(err: string)`                | Fatal process error — no `turn:done` follows                     |
| `turn:done`         | `(result: TurnDoneResult)`     | Turn completed normally                                          |
| `permission:denied` | `(denials, hasPendingRequest)` | One or more tool calls were blocked                              |

`TurnDoneResult`:
```typescript
interface TurnDoneResult {
  sessionId: string | undefined;
  clean: boolean | undefined;          // false if interrupted
  pendingQueries: VaultQuery[];
  pendingPermissionRequest: { tool: string; reason: string } | null;
}
```

## State accessors

```typescript
coordinator.sessionId        // Claude's internal session ID (used for --resume)
coordinator.sessionFileId    // JSON storage file ID
coordinator.sessionTitle     // current session title
coordinator.sessionCreatedAt // ISO timestamp
coordinator.sessionCwd       // working directory override, if one was set (Prime Session)

coordinator.getEffectivePermissionMode() // 'standard' | 'readonly' | 'full' | 'restricted'
```

### Syncing an external rename

If your plugin renames a session's underlying storage outside of BojuBot's own Session Manager, call `renameActiveSession` so the chat header and active-session export reflect it immediately rather than waiting for a reload:

```typescript
coordinator.renameActiveSession(sessionFileId, newTitle); // no-op if sessionFileId isn't the active session
```

## Subscribing and unsubscribing

```typescript
// Subscribe
const handler = (result: TurnDoneResult) => { /* ... */ };
coordinator.on('turn:done', handler);

// Unsubscribe when your plugin unloads
coordinator.off('turn:done', handler);
```

Always call `off` in your plugin's `onunload()` to avoid memory leaks.

## Example: logging token usage

```typescript
import { Plugin } from 'obsidian';
import { VIEW_TYPE_CLAUDE, ClaudeView } from 'bojubot/src/ClaudeView';
import type { TokenUsage } from 'bojubot/src/ClaudeProcess';

export default class TokenLoggerPlugin extends Plugin {
  private _usageHandler = (usage: TokenUsage) => {
    console.log(`[token-logger] out: ${usage.outputTokens} in: ${usage.inputTokens} cached: ${usage.cacheReadTokens}`);
  };

  async onload() {
    this.app.workspace.onLayoutReady(() => {
      const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE)[0];
      const coordinator = (leaf?.view as ClaudeView | undefined)?.coordinator;
      coordinator?.on('turn:usage', this._usageHandler);
    });
  }

  onunload() {
    const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE)[0];
    const coordinator = (leaf?.view as ClaudeView | undefined)?.coordinator;
    coordinator?.off('turn:usage', this._usageHandler);
  }
}
```

## Example: reacting to completed turns

```typescript
coordinator.on('turn:done', (result) => {
  if (!result.clean) return; // interrupted — skip
  if (!result.sessionId) return;

  // Do something after every Claude response, e.g. trigger a Dataview refresh
  this.app.commands.executeCommandById('dataview:dataview-force-refresh-views');
});
```

## Versioning

The `SessionCoordinatorEvents` interface is the stable API surface. New events may be added in future releases. Existing event names and payload shapes will not change without a major version bump and a deprecation notice.

The `coordinator` field on `ClaudeView` is public. Internal coordinator state (private fields, `_persistSessionAfterTurn`, etc.) is not part of the API.

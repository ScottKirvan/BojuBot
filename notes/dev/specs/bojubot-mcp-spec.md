# BojuBot MCP Server — Plugin Spec (DRAFT)

**Status: PROPOSED** — design phase (issue #153). Design brief in `notes/dev/mcp-server-design-brief.md`. Depends on Core Plugin API.

> Living document. Open items are tracked as TODOs. Decisions are noted inline.

---

## Architecture Note

**MCP Server is a separate Obsidian plugin** (`bojubot-mcp`), not a feature built into BojuBot core. It runs a local MCP server that exposes BojuBot Skills as callable tools to any MCP-compatible client (Claude Desktop, n8n, custom agents, voice triggers, remote clients over Tailscale, etc.).

The plugin is **lazy-loaded and opt-in** — it only activates if installed. When not installed, BojuBot has no external surface.

**Core API dependencies:**
- `core.api.skills.list()` — skill discovery for tool registration
- `core.api.skills.invoke()` — skill execution on tool call
- `core.api.plugins.register()` / `.unregister()` — lifecycle registration

See `bojubot-core-api-spec.md` for full interface definitions.

---

## Concept

The MCP Server plugin exposes the vault's Skills folder as a set of MCP tools. Any skill the user has defined becomes an API endpoint — discoverable and invokable by any MCP-compatible client.

The Skills folder acts as a user-curated allowlist by design. Anything the user wants externally accessible gets wrapped in a skill; everything else stays internal. No separate security configuration is required — the trust boundary is the Skills folder itself.

This enables:
- External agents (Claude Desktop, headless scripts) invoking vault workflows without Obsidian being in the loop
- Remote and mobile triggering of vault automations without solving full mobile plugin parity
- A community marketplace dimension where shared skills are also shared capability endpoints
- One skill definition, multiple callers: human via slash menu, Supervisor via skill invocation API, external agent via MCP — consistent behavior

---

## Open Design Questions / TODOs

### MCP Server Implementation

- [ ] **Choose MCP server library.** Options:
  - `@modelcontextprotocol/sdk` (official TypeScript SDK) — recommended; maintained by Anthropic
  - Custom SSE/HTTP implementation — unnecessary complexity given the official SDK
- [ ] **Define transport.** MCP supports SSE (Server-Sent Events) and stdio transports. For an Obsidian plugin:
  - SSE over localhost HTTP is the right choice for network clients (Claude Desktop, remote over Tailscale)
  - stdio is not applicable (Obsidian is not a CLI process)
- [ ] **Define the server port.** Configurable in plugin settings. Default: suggest a high, unlikely-to-conflict port (e.g. `45678`). Document port conflict behavior.
- [ ] **Define the server lifecycle.** Start on plugin load; stop on plugin unload. Restart automatically if settings change (port, enabled skills).

---

### Tool Discovery

- [ ] **Define which skills are exposed as MCP tools.** Options:
  - All skills in the Skills folder (default)
  - Opt-in per skill via frontmatter flag (e.g. `mcp-exposed: true`)
  - Opt-out per skill via frontmatter flag (e.g. `mcp-exposed: false`)
  - **Recommendation:** All skills exposed by default; opt-out via frontmatter. Rationale: the Skills folder is already the allowlist. Requiring explicit opt-in creates friction without meaningful security benefit since the user controls what goes in the folder.
- [ ] **Define tool names.** MCP tool names must be valid identifiers. Recommend: skill filename without extension, with spaces replaced by underscores and special characters stripped. Configurable prefix (e.g. `vault_`) to avoid collisions.
- [ ] **Define tool descriptions.** Map from skill frontmatter `description` field. If missing, use the skill's first non-frontmatter line.
- [ ] **Hot-reload tool list.** When the Skills folder changes, the MCP server's tool list should update without requiring a restart. Clients that support tool list change notifications should be notified.

---

### Tool Invocation

- [ ] **Define the tool call → skill invocation mapping.**
  - MCP tool call arrives with named parameters
  - Plugin resolves the skill by name, passes parameters to `core.api.skills.invoke()`
  - Session spawned by Core; output returned to MCP client as tool result
- [ ] **Define parameter handling.** Skill params (defined in frontmatter) map to MCP tool input schema properties. Param types map to JSON Schema types:

| Skill param type | JSON Schema type      |
| ---------------- | --------------------- |
| `input`          | `string`              |
| `textarea`       | `string`              |
| `dropdown`       | `string` with `enum`  |
| `checkboxes`     | `array` of `string`   |
| `note`           | `string` (vault path) |

- [ ] **Param-free skills.** Skills with no params are exposed as zero-argument MCP tools. Valid and useful.
- [ ] **Define the tool result format.** MCP tool results are text content blocks. Recommend returning Claude's raw output text. If the session errored or timed out, return an error result with a descriptive message.

---

### Permission Model

- [ ] **Define the default permission level for MCP-invoked skills.** MCP callers are external and unauthenticated in the localhost model — they cannot be assumed to have the same trust level as the local user.
  - Recommendation: default to `read-only` for all MCP-invoked sessions.
  - Per-skill override via frontmatter (e.g. `mcp-permissions: standard`).
  - [ ] Decide whether the plugin settings allow a global MCP permission override.
- [ ] **Authentication.** For localhost use, no auth may be acceptable. For Tailscale/remote use, consider a simple API key in request headers. Define v1 scope.

---

### Remote Access (Tailscale)

- [ ] **Document Tailscale configuration.** The MCP server binding to `0.0.0.0` (vs. `127.0.0.1`) makes it accessible over Tailscale without additional setup. This is the recommended path for mobile-trigger and remote-agent use cases.
  - [ ] Decide whether to bind to `0.0.0.0` by default or make it configurable. Security implication: binding to all interfaces exposes the server to any network interface, not just Tailscale. Configurable is safer.
- [ ] **Connection to mobile use case.** This plugin is the recommended path for triggering vault skills from mobile (Obsidian mobile → Tailscale → MCP server → skill execution on desktop). Document this flow explicitly.

---

### Settings (MCP Plugin)

- [ ] Server port (default: `45678`)
- [ ] Bind address: `localhost` | `0.0.0.0` (all interfaces)
- [ ] Server enable/disable toggle (independent of plugin install)
- [ ] Tool name prefix (default: none)
- [ ] Default MCP permission level (default: `read-only`)
- [ ] API key (optional; for remote access auth)
- [ ] Session timeout for MCP-invoked sessions (ms)

---

### UX / Observability

- [ ] **Server status indicator.** Small indicator in BojuBot settings (or ribbon tooltip) showing whether the MCP server is running and on which port.
- [ ] **Active connections.** Count of currently connected MCP clients, visible in settings.
- [ ] **Invocation log.** Log of recent MCP tool calls: timestamp, tool name, params (redacted if sensitive), outcome. Surfaced via `BojuBot: Show MCP log` command.
- [ ] **Tool list command.** `BojuBot: Show MCP tools` — lists all currently exposed tools with their descriptions and the MCP server URL. Useful for configuring external clients.

---

## Implementation Notes

### MCP Server Bootstrap

```typescript
// bojubot-mcp/main.ts — onload()

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

const core = app.plugins.getPlugin('bojubot') as BojuBotCore;

core.api.plugins.register({
  id: 'bojubot-mcp',
  name: 'BojuBot MCP Server',
  version: this.manifest.version,
});

const server = new McpServer({ name: 'bojubot', version: this.manifest.version });
this.registerTools(server, core);
// Start HTTP/SSE listener on configured port
```

### Tool Registration

```typescript
private registerTools(server: McpServer, core: BojuBotCoreAPI) {
  const skills = core.api.skills.list();
  for (const skill of skills) {
    if (skill frontmatter says mcp-exposed: false) continue;
    server.tool(
      toToolName(skill.name),
      skill.description ?? skill.name,
      buildJsonSchema(skill.params),
      async (params) => {
        const handle = await core.api.skills.invoke(skill.name, {
          params,
          permissions: skill.mcpPermissions ?? this.settings.defaultPermissions,
          sourcePlugin: 'bojubot-mcp',
        });
        const output = await waitForComplete(handle);
        return { content: [{ type: 'text', text: output.stdout }] };
      }
    );
  }
}
```

### Hot-Reload

Watch the Skills folder via Obsidian's vault events. On any change, call `server.updateTools()` (or equivalent SDK method) to refresh the tool list. Notify connected clients via MCP tool list change notification if the SDK supports it.

---

### Edge Cases & Failure Modes

- **Port conflict:** If the configured port is in use at plugin load, surface a clear error in plugin settings and disable the server. Do not silently pick a different port.
- **Core not present:** Fail gracefully with a clear error if BojuBot core is not installed.
- **Skill invocation timeout:** Return an MCP error result with timeout message; do not hang the MCP client connection.
- **Obsidian quit while MCP client connected:** Server shuts down on `onunload()`; clients receive a connection-closed signal and should handle reconnect.
- **Skill with params invoked with missing required params:** Return a descriptive validation error to the MCP client without spawning a session.

---

## Decided

| Decision                 | Resolution                                                       |
| ------------------------ | ---------------------------------------------------------------- |
| Implementation location  | Separate Obsidian plugin (`bojubot-mcp`); not in Core            |
| Activation model         | Lazy-loaded; opt-in via installation                             |
| Transport                | SSE over localhost HTTP                                          |
| Skill exposure           | All skills by default; opt-out via frontmatter                   |
| Trust boundary           | Skills folder is the allowlist; no separate access control layer |
| Default permission level | `read-only` for all MCP-invoked sessions                         |
| Mobile use case path     | Tailscale + MCP server (no mobile plugin required)               |

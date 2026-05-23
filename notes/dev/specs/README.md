# Feature Specs — Index

Design specs for ObsidiBot features. Each file has a **Status** marker at the top.

| Status | Meaning |
|---|---|
| PROPOSED | Designed, not yet built |
| PARTIAL | Core implemented; some parts blocked or deferred |
| IMPLEMENTED | Fully shipped |
| SUPERSEDED | Replaced by a different approach |

---

## Specs

| File | Status | Summary |
|---|---|---|
| [slash-command-params-spec.md](slash-command-params-spec.md) | **IMPLEMENTED** | Parameterized skills system — `params:` frontmatter, typed form fields, `{{id}}` interpolation. Now also supports Claude Code `arguments:` format. |
| [obsidian-claude-plugin-frontmatter-schema.md](obsidian-claude-plugin-frontmatter-schema.md) | **PARTIAL** | Per-note `claude:` frontmatter. `context: always`, `readonly`/`protect`, `instructions` work. Write-protection and `context: never` enforcement blocked by `--print` mode constraint. |
| [inline-content-generation-spec.md](inline-content-generation-spec.md) | **PROPOSED** | Inline `<% obsidibot: {...} %>` tags in vault notes trigger headless Claude calls; output replaces the tag. Issue #10. |
| [obsidibot-core-api-spec.md](obsidibot-core-api-spec.md) | **PROPOSED** | Plugin ecosystem API — `SessionAPI`, `SkillAPI`, `EventBusAPI`, `WriteLockAPI`, `PluginRegistryAPI`. Foundation for Watchers, Supervisor, MCP plugins. |
| [obsidibot-mcp-spec.md](obsidibot-mcp-spec.md) | **PROPOSED** | Separate `obsidibot-mcp` plugin exposing skills as MCP tools over SSE/localhost HTTP. Issue #153. See `../mcp-server-design-brief.md`. |
| [obsidibot-supervisor-spec.md](obsidibot-supervisor-spec.md) | **PROPOSED** | Separate `obsidibot-supervisor` plugin — session queuing, concurrency control, multi-agent fleet management. |
| [obsidibot-watchers-spec.md](obsidibot-watchers-spec.md) | **PROPOSED** | Separate `obsidibot-watchers` plugin — filesystem event triggers that spawn Claude sessions. |
| [obsidibot-skills-library-spec.md](obsidibot-skills-library-spec.md) | **PROPOSED** | Community skills registry and in-vault marketplace browser. Contributor GitHub PR path + web upload portal + update detection via server-side cache. |

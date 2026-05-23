# Feature Specs — Index

Design specs for BojuBot features. Each file has a **Status** marker at the top.

| Status      | Meaning                                          |
| ----------- | ------------------------------------------------ |
| PROPOSED    | Designed, not yet built                          |
| PARTIAL     | Core implemented; some parts blocked or deferred |
| IMPLEMENTED | Fully shipped                                    |
| SUPERSEDED  | Replaced by a different approach                 |

---

## Specs

| File                                                                                         | Status          | Summary                                                                                                                                                                               |
| -------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [slash-command-params-spec.md](slash-command-params-spec.md)                                 | **IMPLEMENTED** | Parameterized skills system — `params:` frontmatter, typed form fields, `{{id}}` interpolation. Now also supports Claude Code `arguments:` format.                                    |
| [obsidian-claude-plugin-frontmatter-schema.md](obsidian-claude-plugin-frontmatter-schema.md) | **PARTIAL**     | Per-note `claude:` frontmatter. `context: always`, `readonly`/`protect`, `instructions` work. Write-protection and `context: never` enforcement blocked by `--print` mode constraint. |
| [inline-content-generation-spec.md](inline-content-generation-spec.md)                       | **PROPOSED**    | Inline `<% bojubot: {...} %>` tags in vault notes trigger headless Claude calls; output replaces the tag. Issue #10.                                                                  |
| [bojubot-core-api-spec.md](bojubot-core-api-spec.md)                                         | **PROPOSED**    | Plugin ecosystem API — `SessionAPI`, `SkillAPI`, `EventBusAPI`, `WriteLockAPI`, `PluginRegistryAPI`. Foundation for Watchers, Supervisor, MCP plugins.                                |
| [bojubot-mcp-spec.md](bojubot-mcp-spec.md)                                                   | **PROPOSED**    | Separate `bojubot-mcp` plugin exposing skills as MCP tools over SSE/localhost HTTP. Issue #153. See `../mcp-server-design-brief.md`.                                                  |
| [bojubot-supervisor-spec.md](bojubot-supervisor-spec.md)                                     | **PROPOSED**    | Separate `bojubot-supervisor` plugin — session queuing, concurrency control, multi-agent fleet management.                                                                            |
| [bojubot-watchers-spec.md](bojubot-watchers-spec.md)                                         | **PROPOSED**    | Separate `bojubot-watchers` plugin — filesystem event triggers that spawn Claude sessions.                                                                                            |
| [bojubot-skills-library-spec.md](bojubot-skills-library-spec.md)                             | **PROPOSED**    | Community skills registry and in-vault marketplace browser. Contributor GitHub PR path + web upload portal + update detection via server-side cache.                                  |

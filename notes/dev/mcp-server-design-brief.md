# ObsidiBot MCP Server — New Session Briefing

> Paste this entire document as the opening message of a new Claude Code session.
> The task is **design only** — no code should be written until Scott reviews the output.

---

## Orientation

You are working on **ObsidiBot**, an Obsidian plugin that wraps the Claude Code CLI as a subprocess. Read `CLAUDE.md` (at the repo root) and `src/CLAUDE.md` before doing anything else — they contain the locked architecture decisions and Scott's preferences.

The repo is at `e:\1\GitRepos\ScottKirvan\Vaults\sk\07_GitRepos\ScottKirvan\Cortex`.

---

## What's Already Built That's Relevant

- **`src/SkillLoader.ts`** — `scanSkillFolder()`, `parseSkillFile()`, `loadSkills()`. Complete skill file-system layer: finds flat `.md` files and `<name>/SKILL.md` subdirectories, parses frontmatter (`params`, `arguments`, `autorun`, `category`, `description`), returns typed `SkillDef[]`. This is the foundation the MCP server should build on.
- **`src/modals/SlashParamModal.ts`** — handles `params` form fields and interpolates `{{id}}`, `$name`, `$0`, `$ARGUMENTS` tokens into the prompt body before execution.
- **`src/ClaudeProcess.ts`** — `spawnClaude()` spawns the Claude CLI subprocess. This is how skills are actually executed — Claude reads the interpolated prompt from stdin. The MCP server will need to invoke Claude the same way, without a UI.
- **`src/ClaudeView.ts`** — `_executeSkillDef()` is the UI execution path (drives the Obsidian chat panel). The MCP server needs a **non-UI execution path** — same logic, no DOM.
- **`docs/guide/skills.md`** — user-facing skills reference. Read this to understand the full field spec.
- **`notes/dev/obsidibot-skills-library-spec.md`** — community skills library design spec. The MCP server is the "external invocation surface" that gives skills their second dimension: not just slash-menu shortcuts but callable API endpoints.

---

## The Feature: Issue #153

Add an optional MCP server to ObsidiBot that exposes the vault's Skills folder as callable MCP tools.

Key decisions already made in the issue:

- The **skills folder is the trust boundary** — only skills the user has explicitly placed there are exposed. No raw Obsidian command exposure.
- External MCP-compatible clients (Claude Desktop, n8n, custom agents) should be able to discover and invoke skills remotely.
- The heavy lifting (skill parsing, param interpolation, Claude invocation) already exists. This is primarily an MCP transport layer over existing functionality.

---

## Your Task: Design Document, Not Code

Read the key files listed above, then answer the seven questions below in a structured design document. For each question, make a recommendation and explain the trade-offs. Flag any question where you need Scott's input before a recommendation is possible.

---

### Q1 — Process Model

Obsidian plugins run in Electron's renderer process. Running a network server in-process is unusual and potentially blocked by Electron's sandbox. The most likely viable approach is spawning an MCP server as a **child process** — the same pattern used by `ClaudeProcess.ts`.

- What does that child process look like? A separate Node script bundled with the plugin? A compiled binary?
- What are the lifecycle implications — start/stop with Obsidian, crash recovery, port cleanup on unclean exit?
- Is there a simpler in-process option that doesn't require a subprocess, and does it have any Electron constraints worth flagging?

### Q2 — Transport

MCP supports stdio and HTTP+SSE transports.

- Stdio requires the MCP client to spawn the server process — this works for Claude Desktop's config model but means the server isn't persistent and can't serve multiple concurrent callers.
- HTTP+SSE is more accessible for external clients but requires picking and managing a port.

Recommend a transport. If HTTP: what's the default port? Is it user-configurable in settings? How does a client discover it — fixed default, a generated config snippet the user can export, or something else?

### Q3 — Skill Invocation Without a UI

`ClaudeView._executeSkillDef()` drives Obsidian's chat panel. The MCP server has no DOM. When an external caller invokes a skill, the server needs to:

1. Resolve param values from MCP tool call arguments
2. Interpolate the prompt (the same logic as `SlashParamModal`)
3. Spawn Claude via `spawnClaude()`
4. Collect and return the output

Where does this live? Options:

- A new exported function `executeSkillHeadless(skill, args)` in `SkillLoader.ts` or a new `SkillExecutor.ts`
- The MCP server subprocess handles it entirely on its own (reads skill files, spawns Claude, returns output — no shared code with the plugin)

Where does the Claude session ID live for headless runs — ephemeral per-call, or persistent per MCP client session?

### Q4 — Params Mapping to MCP Tool Schema

Skills with `params:` frontmatter have typed form fields. MCP tool definitions use JSON Schema for arguments. How do ObsidiBot param types map?

| ObsidiBot type | JSON Schema equivalent |
|---|---|
| `input` | `string` |
| `textarea` | `string` |
| `dropdown` | `string` with `enum` |
| `checkboxes` | `array` of `string` |
| `obsidianmd_note` | ??? |

The `obsidianmd_note` type is the hard case — in the UI it opens a fuzzy vault picker and injects the file content as an attachment. For an external caller, what do they pass? A vault-relative file path? The file content directly? Is this type simply unsupported in MCP invocations (MCP callers must use skills without `obsidianmd_note` params, or the server returns an error)?

What does a complete generated MCP tool definition look like for a skill with mixed param types? Provide an example.

### Q5 — Authentication

The MCP server listens on localhost. Is localhost-only sufficient, or does it need a shared secret / bearer token?

Consider: ObsidiBot vaults often contain sensitive personal notes. A locally running MCP server without auth means any process on the machine can invoke skills. Assess the threat model and make a recommendation — err on the side of a simple token that can be disabled, or err on the side of localhost-only for zero-friction setup?

### Q6 — Settings Surface

What settings does this feature add to the plugin's settings tab? Proposed minimal set:

- Enable/disable MCP server (toggle, default off)
- Port (number input, default e.g. 3099)
- "Export MCP config" button — writes a JSON snippet to the clipboard or a file that the user can paste into Claude Desktop's `claude_desktop_config.json`

Is there anything missing? Anything that should be removed to keep first release minimal?

### Q7 — Skills Library Connection

The community skills library spec (`notes/dev/obsidibot-skills-library-spec.md`) envisions skills installed from the community registry landing in `.obsidibot/skills/community/<library-id>/<skill-id>/`. User-authored skills live in `_ObsidiBot Skills/` (or a custom path).

Does the MCP server need to distinguish between community-installed and user-authored skills, or is the folder abstraction (`scanSkillFolder`) sufficient to treat them uniformly? Are there any trust or namespace collision concerns?

---

## Constraints to Keep in Mind

- **No API key.** ObsidiBot rides a Claude Pro/Max subscription via the CLI. The MCP server invokes Claude the same way as the plugin: `spawnClaude()` with a prompt on stdin.
- **Desktop only.** No mobile, no browser.
- **Design first.** The CLAUDE.md says "Larger refactors get a design discussion first." The output of this session is a design doc Scott can review — not a PR. Do not write implementation code.
- **Scott commits, Claude writes code.** Don't commit anything.
- **Conventional commits + release-please.** No "Generated with Claude Code" credits anywhere in project-visible text.

---

## Expected Output

A markdown design document (`notes/dev/mcp-server-design.md`) that covers:

1. Recommended architecture (one paragraph summary)
2. Answers to Q1–Q7, each with a recommendation and the key trade-off
3. A list of decisions that need Scott's input before implementation can start
4. A rough implementation order (what gets built first, what can be deferred to a v2)
5. Any open questions not covered above that you identified while reading the code

Save the document to `notes/dev/mcp-server-design.md` when done.

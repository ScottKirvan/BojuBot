# Permissions

BojuBot runs an agent CLI (Claude Code, or [Antigravity](./agents)) as a subprocess and controls what it's allowed to do through that CLI's own permission settings. The permission mode applies from your next message — it can't change in the middle of a reply.

## Modes

| Mode                         | Icon      | What Claude can do                                                                        |
| ---------------------------- | --------- | ----------------------------------------------------------------------------------------- |
| **Chat only**                | 🔵 lock    | Web search/fetch only — no file system access. Works with attached context and @-mentions |
| **Standard** *(recommended)* | 🟡 shield  | Read and write files, use web search/fetch, and run read-only shell commands that Claude Code classifies as safe (e.g. `ls`, `echo`) — other shell commands are denied |
| **Read only**                | 🟢 eye     | Read files, search, fetch web — no writes or shell commands                               |
| **Full access**              | 🔴 warning | Everything, including shell commands (Bash, git, etc.)                                    |

**Change the mode any time** by clicking the colored permission icon in the input toolbar — a picker appears above it with all four options. The current mode is highlighted. Use arrow keys + Enter or click to select; Escape or click outside to cancel.

The same picker is available from the Command Palette: **BojuBot: Change permission mode**.

The default for new sessions is set in **Settings → BojuBot → Permission mode**.

::: info On Antigravity
Each mode allows slightly different things on Antigravity, and switching into or out of Chat only starts a new session there. The picker shows each mode's behavior for the session's agent. See [Permissions on each agent](#permissions-on-each-agent).
:::

::: info Claude Code version detection
When the plugin loads, BojuBot runs `claude --version` and `claude --help` in the background to see which options your Claude Code CLI supports, and builds its arguments to match. For example, newer CLIs (2.1.286 and later) name the "ask before acting" permission mode `manual` instead of `default`, so Read only and Chat only use `manual` when it's available. If the check fails or hasn't finished yet, BojuBot uses the same arguments it always has. The detected version is shown in the About dialog and under **Claude binary path** in settings.
:::

### Standard and shell commands

In Standard mode Claude Code accepts file edits automatically and also auto-approves shell commands it classifies as read-only and safe (listing files, printing text, and similar). Any other shell command — anything that could change files or download something, such as `curl -o page.html …` — is denied, and the [denial card](#permission-denials) appears so you can retry with full access. On Claude Code versions that support it, BojuBot passes `--permission-prompts none` so these denials are explicit rather than a side effect of running non-interactively.

### Chat only

Chat only is designed for conversations where you want Claude to reason and suggest, but not touch your vault. Claude can see any context you explicitly hand it — @-mentioned notes, file attachments, clipboard pastes — and can fetch web URLs and search the web. It cannot browse, read, or modify vault files on its own.

None of the automatic session-start context is injected in this mode — the vault folder tree, your context file (`_claude-context.md`), pinned notes, and per-file instructions are all skipped, since any of them could otherwise leak details established in other, non-restricted sessions. Claude is also spawned in a neutral system temp directory rather than your vault root, so it can't infer or report your vault's file-system path.

---

## Permissions on each agent <Badge type="warning" text="Beta" />

::: warning Not released yet
Antigravity support is in [beta builds](beta-builds.md) and will ship in the next release. The community plugin version only runs Claude Code.
:::

The four modes mean the same thing on both agents, but each agent CLI enforces them its own way, so the details differ.

| | Claude Code | Antigravity |
| --- | --- | --- |
| **Chat only** | Web search and web pages. No files, no shell. | Web search and web pages. No files, no shell. |
| **Read only** | Reads and searches files, web search and web pages. No writes, no shell. | Reads and searches files, web search. No writes, no shell. Asked for a change, it may answer with a plan for you to apply. |
| **Standard** | Reads and edits files, web search and web pages. Safe read-only shell commands like `ls` run; other shell commands are blocked. | Reads and edits files, web search. Every shell command is blocked. |
| **Full access** | Everything. | Everything, in a session that started in Full access. A session switched to Full access later has no browser or MCP tools ([why](#why-antigravity-works-differently)). |
| **Reading a web page** | Allowed in every mode. | Allowed in Chat only and Full access. In Read only and Standard it's blocked, and the denial card offers full access. |
| **Changing mode during a session** | Takes effect from your next message. | Takes effect from your next message. Switching into or out of Chat only starts a new session instead. |
| **Denial card** | From Chat only: offers standard access. From Read only or Standard: offers full access. | From Read only or Standard: offers full access. Never shown in Chat only: nothing there asks for permission. |

### Changing mode on Antigravity

- **Between Read only, Standard and Full access:** works mid-session, exactly as on Claude Code. Your next message uses the new mode, and the conversation carries on.
- **Into or out of Chat only:** BojuBot starts a new Antigravity session in the same tab, with the same settings, and tells you so. Your previous session stays in the [Sessions panel](./sessions#sessions-panel), where you can go back to it. A session you haven't sent a message in yet just switches.
- **Starting a session in Chat only** works as usual, from the toolbar picker or with Shift+click on **+** ([Custom Session](./sessions#starting-a-new-session)).

### Why Antigravity works differently

BojuBot runs Antigravity as one of its own Antigravity *agents*. An agent is a named setup that lists the tools Antigravity may use, and gives it BojuBot's ground rules: link notes with plain `[[wikilinks]]` (never `file://` links or links in backticks), use the built-in file tools rather than shell commands, rename, move and delete notes through BojuBot so links stay intact, and ask before anything that needs a shell.

Antigravity fixes an agent's tools when a conversation starts. A conversation can't gain or lose tools later. That shapes how BojuBot uses agents:

- **One agent for Read only, Standard and Full access** (`bojubot`). It has every tool an Antigravity agent can have, and the mode you pick decides, message by message, which of them Antigravity may use. That's why you can switch between these three modes mid-session.
- **Its own agent for Chat only** (`bojubot-chat`), with only the web tools. That's what guarantees Chat only can't touch your files, and why moving a conversation into or out of Chat only needs a new session.
- **Full access.** An Antigravity agent can't include Antigravity's browser tools, its MCP tools, or the tools for typing into a running command. A session that *starts* in Full access runs without BojuBot's agent, so it has all of Antigravity's tools (but not the ground rules). A session switched to Full access later, for example from the denial card, keeps the `bojubot` agent: it can run shell commands, but has no browser or MCP tools. If you need those, start a new session in Full access.

BojuBot writes the two agents to Antigravity's agents folder, `~/.gemini/config/agents/`. See [Choosing an Agent](./agents#permissions-on-antigravity) for details, and what happens on older Antigravity versions.

---

## Permission Denials

When Claude attempts a blocked operation, a **denial card** appears in the chat after the response completes, listing what was blocked.

The upgrade option in the denial card depends on the current mode:

- **Chat only** → offers **Allow standard access for this session** (Claude Code only; on Antigravity, Chat only has nothing that could be denied)
- **Standard / Read only** → offers **Allow full access for this session**

The session override is cleared when you start a new session or when you change the permission mode via the picker or settings.

::: warning
Permission granularity is at the **tool level**, not the command level. "Allow full access" unlocks all shell commands for the rest of the session — there is no way to approve `git status` while still blocking `rm`. This is a constraint of how Claude Code works in streaming mode.

If you need Bash access regularly, set Permission mode to **Full access** in settings rather than upgrading per-session each time.
:::

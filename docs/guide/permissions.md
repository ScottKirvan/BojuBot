# Permissions

BojuBot runs an agent CLI (Claude Code, or [Antigravity](./agents)) as a subprocess and controls what it's allowed to do through that CLI's own permission settings. Every session has **its own permission mode**, saved with the session. It applies from the next message you send; it can't change in the middle of a reply.

## Modes

| Mode                         | Icon      | What Claude can do                                                                        |
| ---------------------------- | --------- | ----------------------------------------------------------------------------------------- |
| **Chat only**                | 🔵 lock    | Web search/fetch only — no file system access, and BojuBot shares no vault information. Only links can be attached |
| **Standard** *(recommended)* | 🟡 shield  | Read and write files, use web search/fetch, and run read-only shell commands that Claude Code classifies as safe (e.g. `ls`, `echo`) — other shell commands are denied |
| **Read only**                | 🟢 eye     | Read files, search, fetch web — no writes, shell commands, or Obsidian commands           |
| **Full access**              | 🔴 warning | Everything, including shell commands (Bash, git, etc.)                                    |

**Change the mode any time** by clicking the colored permission icon in the input toolbar — a picker appears above it with all four options. The current mode is highlighted. Use arrow keys + Enter or click to select; Escape or click outside to cancel.

The same picker is available from the Command Palette: **BojuBot: Change permission mode**.

## The mode belongs to the session

- **A new session starts in your default mode** and saves it. The default is set in **Settings → BojuBot → Default permission mode**. Changing the default there doesn't change any session that already exists, including the one open in the panel.
- **The picker changes the open session only.** The mode you pick is saved with that session, and it also becomes the default for new sessions. Other sessions keep their own modes, including the ones open in other [chat tabs](./sessions#several-sessions-at-once).
- **Opening a session never changes what it's allowed to do.** It opens in the mode it was saved with, whatever the picker showed before. Sessions from older versions of BojuBot, which didn't save a mode, open in **Standard** (and that's saved).
- **Nothing carries over when you switch sessions.** Opening, starting or clearing a session drops anything waiting to be sent with the previous session's next message: attachments in the input area (pinned ones too), a queued **Refresh context**, notes about permission or allowlist changes, and Custom Session setup that hadn't been sent yet.

### Full access and restarts

With **Persist full access between restarts** off (the default), Full access lasts until Obsidian restarts. After a restart the default for new sessions goes back to Standard, and a session that was left in Full access opens in Standard. Within the same run, a session you gave Full access keeps it when you switch away and back.

Turn the setting on if you want sessions to keep Full access after a restart.

::: info On Antigravity
Each mode allows slightly different things on Antigravity, and switching out of Chat only also starts a new session there (switching into it does on [both agents](#chat-only)). The picker shows each mode's behavior for the session's agent. See [Permissions on each agent](#permissions-on-each-agent).
:::

::: info Claude Code version detection
When the plugin loads, BojuBot runs `claude --version` and `claude --help` in the background to see which options your Claude Code CLI supports, and builds its arguments to match. For example, newer CLIs (2.1.286 and later) name the "ask before acting" permission mode `manual` instead of `default`, so Read only and Chat only use `manual` when it's available. If the check fails or hasn't finished yet, BojuBot uses the same arguments it always has. The detected version is shown in the About dialog and under **Claude binary path** in settings.
:::

### Standard and shell commands

In Standard mode Claude Code accepts file edits automatically and also auto-approves shell commands it classifies as read-only and safe (listing files, printing text, and similar). Any other shell command — anything that could change files or download something, such as `curl -o page.html …` — is denied, and the [denial card](#permission-denials) appears so you can retry with full access. On Claude Code versions that support it, BojuBot passes `--permission-prompts none` so these denials are explicit rather than a side effect of running non-interactively.

### Chat only

Chat only is designed for conversations where you want Claude to reason and suggest, but not touch your vault or your files. Claude sees what you type or paste into the message, and can fetch web URLs and search the web. It cannot browse, read, or modify files.

None of the automatic session-start context is injected in this mode — the vault folder tree, your context file (`_claude-context.md`), pinned notes, and per-file instructions are all skipped, since any of them could otherwise leak details established in other, non-restricted sessions. Claude is also spawned in a neutral system temp directory rather than your vault root, so it can't infer or report your vault's file-system path.

BojuBot itself also keeps vault information away from Claude in Chat only:

- **No vault queries.** Claude can't ask BojuBot for your file list, backlinks, outgoing links or tags. If it tries, BojuBot refuses and tells it vault queries aren't available in Chat only. (Claude can still ask for BojuBot's own reference pages, which contain nothing from your vault.)
- **No open-note paths.** BojuBot doesn't tell Claude which note you have open, or which notes are open in a split or in stacked tabs.
- **No Obsidian commands.** Claude can't run Obsidian commands, and isn't given your command allowlist.
- **No files, notes or selections.** Attaching something counts as reading it, so Chat only sends links only. Files of any type, pasted screenshots, @-mentioned notes, **Send selection as context**, skill fields that pull in a note and Custom Session attachments are all held back: BojuBot shows a notice and doesn't send the message until you remove them or switch mode. Text you type or paste into the message itself is sent as usual.

What Claude *can* still do through BojuBot in Chat only: open a note you name, jump to a heading, show a notice, or open Settings or the quick switcher. These only change what's on your screen; nothing is sent back to Claude.

Anything you hand Claude yourself still reaches it: @-mentioned notes, attachments, selections you send, and notes you pick in a skill's form.

**Switching into Chat only starts a new session** if the current one already has messages, on both agents, because the earlier messages may hold vault information. The new session opens in the same tab, on the same agent with the same settings, and is saved in Chat only. BojuBot shows a notice, and your previous session stays in the [Sessions panel](./sessions#sessions-panel), in the mode it had. If a reply is still running, the new session starts when you send your next message. A session with no messages just switches. A session that's already in Chat only stays as it is.

### Read only and Obsidian commands

Read only can't run Obsidian commands through BojuBot either, because commands can create or change notes. Claude isn't given your command allowlist in this mode. Vault queries and open-note paths work as usual.

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
| **Changing mode during a session** | Takes effect from your next message. Switching into Chat only starts a new session instead. | Takes effect from your next message. Switching into or out of Chat only starts a new session instead. |
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

Allowing upgrades the session the card was shown in, and only that one: the new mode is saved with the session, so it's still there when you come back to it (see [Full access and restarts](#full-access-and-restarts)). Other sessions, and new ones, aren't affected. You can lower the mode again at any time with the picker. A card left over from a session that's no longer open does nothing.

The same applies when Claude asks for a permission during a turn and you grant it.

::: warning
Permission granularity is at the **tool level**, not the command level. "Allow full access" unlocks all shell commands for the rest of the session — there is no way to approve `git status` while still blocking `rm`. This is a constraint of how Claude Code works in streaming mode.

If you need Bash access regularly, set the default permission mode to **Full access** in settings rather than upgrading each session.
:::

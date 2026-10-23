# Permissions

BojuBot runs Claude Code as a subprocess and controls what it's allowed to do via Claude Code's permission flags. Every session has **its own permission mode**, saved with the session. It applies from the next message you send; it can't change in the middle of a response.

## Modes

| Mode                         | Icon      | What Claude can do                                                                        |
| ---------------------------- | --------- | ----------------------------------------------------------------------------------------- |
| **Chat only**                | 🔵 lock    | Web search/fetch only — no file system access, and BojuBot shares no vault information. Works with attached context and @-mentions |
| **Standard** *(recommended)* | 🟡 shield  | Read and write files, use web search/fetch, and run read-only shell commands that Claude Code classifies as safe (e.g. `ls`, `echo`) — other shell commands are denied |
| **Read only**                | 🟢 eye     | Read files, search, fetch web — no writes, shell commands, or Obsidian commands           |
| **Full access**              | 🔴 warning | Everything, including shell commands (Bash, git, etc.)                                    |

**Change the mode any time** by clicking the colored permission icon in the input toolbar — a picker appears above it with all four options. The current mode is highlighted. Use arrow keys + Enter or click to select; Escape or click outside to cancel.

The same picker is available from the Command Palette: **BojuBot: Change permission mode**.

## The mode belongs to the session

- **A new session starts in your default mode** and saves it. The default is set in **Settings → BojuBot → Default permission mode**. Changing the default there doesn't change any session that already exists, including the one open in the panel.
- **The picker changes the open session only.** The mode you pick is saved with that session, and it also becomes the default for new sessions. Other sessions keep their own modes.
- **Opening a session never changes what it's allowed to do.** It opens in the mode it was saved with, whatever the picker showed before. Sessions from older versions of BojuBot, which didn't save a mode, open in **Standard** (and that's saved).
- **Nothing carries over when you switch sessions.** Opening, starting or clearing a session drops anything waiting to be sent with the previous session's next message: attachments in the input area (pinned ones too), a queued **Refresh context**, notes about permission or allowlist changes, and Custom Session setup that hadn't been sent yet.

### Full access and restarts

With **Persist full access between restarts** off (the default), Full access lasts until Obsidian restarts. After a restart the default for new sessions goes back to Standard, and a session that was left in Full access opens in Standard. Within the same run, a session you gave Full access keeps it when you switch away and back.

Turn the setting on if you want sessions to keep Full access after a restart.

::: info On Antigravity
Sessions on the Antigravity CLI map these modes differently: Standard denies **all** shell commands, Read only uses Antigravity's plan mode, and Chat only isn't available. The picker shows each mode's behavior for the session's agent. See [Choosing an Agent](./agents#permissions-on-antigravity).
:::

::: info Claude Code version detection
When the plugin loads, BojuBot runs `claude --version` and `claude --help` in the background to see which options your Claude Code CLI supports, and builds its arguments to match. For example, newer CLIs (2.1.286 and later) name the "ask before acting" permission mode `manual` instead of `default`, so Read only and Chat only use `manual` when it's available. If the check fails or hasn't finished yet, BojuBot uses the same arguments it always has. The detected version is shown in the About dialog and under **Claude binary path** in settings.
:::

### Standard and shell commands

In Standard mode Claude Code accepts file edits automatically and also auto-approves shell commands it classifies as read-only and safe (listing files, printing text, and similar). Any other shell command — anything that could change files or download something, such as `curl -o page.html …` — is denied, and the [denial card](#permission-denials) appears so you can retry with full access. On Claude Code versions that support it, BojuBot passes `--permission-prompts none` so these denials are explicit rather than a side effect of running non-interactively.

### Chat only

Chat only is designed for conversations where you want Claude to reason and suggest, but not touch your vault. Claude can see any context you explicitly hand it — @-mentioned notes, file attachments, clipboard pastes — and can fetch web URLs and search the web. It cannot browse, read, or modify vault files on its own.

None of the automatic session-start context is injected in this mode — the vault folder tree, your context file (`_claude-context.md`), pinned notes, and per-file instructions are all skipped, since any of them could otherwise leak details established in other, non-restricted sessions. Claude is also spawned in a neutral system temp directory rather than your vault root, so it can't infer or report your vault's file-system path.

BojuBot itself also keeps vault information away from Claude in Chat only:

- **No vault queries.** Claude can't ask BojuBot for your file list, backlinks, outgoing links or tags. If it tries, BojuBot refuses and tells it vault queries aren't available in Chat only. (Claude can still ask for BojuBot's own reference pages, which contain nothing from your vault.)
- **No open-note paths.** BojuBot doesn't tell Claude which note you have open, or which notes are open in a split or in stacked tabs.
- **No Obsidian commands.** Claude can't run Obsidian commands, and isn't given your command allowlist.

What Claude *can* still do through BojuBot in Chat only: open a note you name, jump to a heading, show a notice, or open Settings or the quick switcher. These only change what's on your screen; nothing is sent back to Claude.

Anything you hand Claude yourself still reaches it: @-mentioned notes, attachments, selections you send, and notes you pick in a skill's form.

**Switching into Chat only starts a new session** if the current one already has messages, because the earlier messages may hold vault information. BojuBot shows a notice, and your previous session stays in the session manager, in the mode it had. If a reply is still running, the new session starts when you send your next message. A session with no messages just switches. A session that's already in Chat only stays as it is.

### Read only and Obsidian commands

Read only can't run Obsidian commands through BojuBot either, because commands can create or change notes. Claude isn't given your command allowlist in this mode. Vault queries and open-note paths work as usual.

---

## Permission Denials

When Claude attempts a blocked operation, a **denial card** appears in the chat after the response completes, listing what was blocked.

The upgrade option in the denial card depends on the current mode:

- **Chat only** → offers **Allow standard access for this session**
- **Standard / Read only** → offers **Allow full access for this session**

Allowing upgrades the session the card was shown in, and only that one: the new mode is saved with the session, so it's still there when you come back to it (see [Full access and restarts](#full-access-and-restarts)). Other sessions, and new ones, aren't affected. You can lower the mode again at any time with the picker. A card left over from a session that's no longer open does nothing.

The same applies when Claude asks for a permission during a turn and you grant it.

::: warning
Permission granularity is at the **tool level**, not the command level. "Allow full access" unlocks all shell commands for the rest of the session — there is no way to approve `git status` while still blocking `rm`. This is a constraint of how Claude Code works in streaming mode.

If you need Bash access regularly, set the default permission mode to **Full access** in settings rather than upgrading each session.
:::

# Permissions

BojuBot runs Claude Code as a subprocess and controls what it's allowed to do via Claude Code's permission flags. The permission mode is set **per session** before any message is sent — it cannot change mid-response.

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

::: info Claude Code version detection
When the plugin loads, BojuBot runs `claude --version` and `claude --help` in the background to see which options your Claude Code CLI supports, and builds its arguments to match. For example, newer CLIs (2.1.286 and later) name the "ask before acting" permission mode `manual` instead of `default`, so Read only and Chat only use `manual` when it's available. If the check fails or hasn't finished yet, BojuBot uses the same arguments it always has. The detected version is shown in the About dialog and under **Claude binary path** in settings.
:::

### Standard and shell commands

In Standard mode Claude Code accepts file edits automatically and also auto-approves shell commands it classifies as read-only and safe (listing files, printing text, and similar). Any other shell command — anything that could change files or download something, such as `curl -o page.html …` — is denied, and the [denial card](#permission-denials) appears so you can retry with full access. On Claude Code versions that support it, BojuBot passes `--permission-prompts none` so these denials are explicit rather than a side effect of running non-interactively.

### Chat only

Chat only is designed for conversations where you want Claude to reason and suggest, but not touch your vault. Claude can see any context you explicitly hand it — @-mentioned notes, file attachments, clipboard pastes — and can fetch web URLs and search the web. It cannot browse, read, or modify vault files on its own.

None of the automatic session-start context is injected in this mode — the vault folder tree, your context file (`_claude-context.md`), pinned notes, and per-file instructions are all skipped, since any of them could otherwise leak details established in other, non-restricted sessions. Claude is also spawned in a neutral system temp directory rather than your vault root, so it can't infer or report your vault's file-system path.

---

## Permission Denials

When Claude attempts a blocked operation, a **denial card** appears in the chat after the response completes, listing what was blocked.

The upgrade option in the denial card depends on the current mode:

- **Chat only** → offers **Allow standard access for this session**
- **Standard / Read only** → offers **Allow full access for this session**

The session override is cleared when you start a new session or when you change the permission mode via the picker or settings.

::: warning
Permission granularity is at the **tool level**, not the command level. "Allow full access" unlocks all shell commands for the rest of the session — there is no way to approve `git status` while still blocking `rm`. This is a constraint of how Claude Code works in streaming mode.

If you need Bash access regularly, set Permission mode to **Full access** in settings rather than upgrading per-session each time.
:::

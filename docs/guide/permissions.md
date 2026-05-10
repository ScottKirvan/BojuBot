# Permissions

ObsidiBot runs Claude Code as a subprocess and controls what it's allowed to do via Claude Code's permission flags. The permission mode is set **per session** before any message is sent — it cannot change mid-response.

## Modes

| Mode                         | Icon        | What Claude can do                                                                        |
| ---------------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| **Chat only**                | 🔵 lock     | Web search/fetch only — no file system access. Works with attached context and @-mentions |
| **Standard** *(recommended)* | 🟡 shield   | Read and write files, use web search/fetch — Bash/shell commands blocked                  |
| **Read only**                | 🟢 eye      | Read files, search, fetch web — no writes or shell commands                               |
| **Full access**              | 🔴 warning  | Everything, including shell commands (Bash, git, etc.)                                    |

**Change the mode any time** by clicking the colored permission icon in the input toolbar — a picker appears above it with all four options. The current mode is highlighted. Use arrow keys + Enter or click to select; Escape or click outside to cancel.

The same picker is available from the Command Palette: **ObsidiBot: Change permission mode**.

The default for new sessions is set in **Settings → ObsidiBot → Permission mode**.

### Chat only

Chat only is designed for conversations where you want Claude to reason and suggest, but not touch your vault. Claude can see any context you explicitly hand it — @-mentioned notes, file attachments, clipboard pastes — and can fetch web URLs and search the web. It cannot browse, read, or modify vault files on its own.

The vault folder tree is not injected at session start in this mode, so Claude has no map of your vault structure.

::: info Known limitation
Claude is spawned with your vault root as its working directory, so it is technically aware of the vault path even in Chat only mode. Obscuring this is tracked as a future improvement.
:::

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

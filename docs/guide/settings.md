# Settings

Open **Settings → ObsidiBot** to configure:

| Setting                            | Default                                              | Description                                                                                                                                                          |
| ---------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Claude binary path**             | *(auto-detect)*                                      | Full path to the `claude` executable. Leave blank to auto-detect from PATH and common install locations.                                                             |
| **Context file path**              | `_claude-context.md`                                 | Vault-relative path to the context file injected at session start.                                                                                                   |
| **Export folder**                  | `ObsidiBot Exports`                                  | Default folder for **Export session to vault**. Created automatically if it doesn't exist. Leave blank to save at vault root.                                        |
| **Session storage path**           | *(empty — default location)*                         | Where session JSON files are stored. See [Session storage location](#session-storage-location) below.                                                                |
| **Commands folder**                | *(empty — default location)*                         | Folder containing slash command templates. See [Slash commands](./slash-commands).                                                                                   |
| **Vault tree depth**               | Off                                                  | Levels of folder/file names injected at session start. `0` = off (default), `1`–`10` = N levels, `-1` = unlimited. Names only — no file contents. Claude discovers structure on demand via the vault query protocol when off.                              |
| **Send on Enter**                  | On                                                   | Press Enter to send. Shift+Enter always inserts a newline.                                                                                                           |
| **Resume last session on startup** | On                                                   | Automatically resume the most recent session when the panel opens.                                                                                                   |
| **Autonomous memory**              | On                                                   | Claude updates the context file as it learns about your vault. Disable if you prefer manual control or if your vault is shared.                                      |
| **Permission mode**                | Standard                                             | Controls what vault operations Claude can perform: **Chat only** (web only, no file system), **Standard** (files + web), **Read only** (read + web, no writes), **Full access** (everything including Bash). See [Permissions](./permissions).                                                                                 |
| **Command Allowlist**              | `switcher:open`, `daily-notes`, `editor:open-search` | Obsidian commands Claude can run via the UI Bridge. Found under **UI Bridge & Commands**. Allowlisted commands execute immediately.                                  |
| **Prompt for unlisted commands**   | On                                                   | When Claude tries a command not in the allowlist, show a confirmation modal. Allow + "Don't ask again" adds to allowlist. Deny + "Don't ask again" adds to denylist. |
| **Denied commands**                | *(hidden until used)*                                | Shows count of permanently denied commands with a **Clear denylist** button. To re-enable a specific command, add it to the allowlist via the command browser.       |
| **Enable debug log**               | On                                                   | Write a debug log file. See [Troubleshooting](./troubleshooting#logging).                                                                                            |
| **Log file path**                  | `.obsidian/plugins/obsidibot/obsidibot-debug.log`    | Vault-relative path for the log file. Defaults to the plugin folder so it stays out of your vault and git history.                                                   |
| **Log verbosity**                  | Normal                                               | **Normal** logs session events and errors. **Verbose** adds raw stream data and token breakdowns.                                                                    |
| **@-mention file types**           | `*` (all vault files)                                | Comma-separated extensions for the `@` autocomplete dropdown. `*` includes all vault files. To restrict, list extensions explicitly (e.g. `md, pdf, txt`). Add a trailing comma to also match files with no extension (e.g. `md, txt,`). |
| **Inject split-pane files**        | On                                                   | When in split-pane view, include all visible file paths as active note context.                                                                                      |

## Session storage location

By default, session files are stored in `.obsidian/obsidibot/sessions/` inside your vault. This folder is typically gitignored, so sessions don't appear in your git history.

You can change this in **Settings → ObsidiBot → Session storage path**:

| Value                            | Behaviour                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| *(empty)*                        | Default — `.obsidian/obsidibot/sessions/`. Gitignored.                              |
| `_sessions` (vault-relative)     | Sessions stored at `_sessions/` in your vault root. Tracked by git if not excluded. |
| `/Users/you/sessions` (absolute) | Sessions stored outside the vault entirely.                                         |

::: warning Sessions are not migrated
Changing this setting affects **new sessions only**. Existing sessions remain in their original location and will not appear in the session manager until you change the path back. If you want to move existing sessions, copy the `.json` files manually to the new path before restarting ObsidiBot.
:::

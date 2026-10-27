# Settings

Open **Settings → BojuBot** to configure. Grouped below to match the sections in the settings panel itself.

On Obsidian 1.13 or later you can also find any BojuBot setting with the search in Obsidian's settings window (Ctrl+F, or Cmd+F on macOS, while settings are open): type part of its name or description (for example *minimal mode* or *allowlist*) and pick the result to jump straight to it.

## Agents

| Setting                            | Default | Description                                                                                                                                                                          |
| ----------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Claude Code binary path**             | *(auto-detect)* | Full path to the `claude` executable. Leave blank to auto-detect from PATH and common install locations. The description below the field shows the detected Claude Code version (or *unknown* if it couldn't be checked). |
| **Antigravity CLI binary path**        | *(auto-detect)* | Full path to the `agy` executable (Google's Antigravity CLI, in beta builds). Leave blank to auto-detect from PATH and `%LOCALAPPDATA%\agy\bin`. The description shows the detected Antigravity version. |

## Chat

| Setting                            | Default | Description                                                                                                                                                                          |
| ----------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Send on Enter**                  | On      | Press Enter to send. Shift+Enter always inserts a newline.                                                                                                                           |
| **Stream replies as they're written** | On   | Show reply text word by word as the agent writes it, rendered as formatted markdown once each reply is complete. Turn off to get a block at a time. On Claude Code, needs a version that supports streaming (`--include-partial-messages`); ignored otherwise. Takes effect on the next message. |
| **Resume last session on startup** | On      | Automatically resume the most recent session when the panel opens.                                                                                                                   |
| **@-mention file types**           | `*` (all vault files) | Comma-separated extensions for the `@` autocomplete dropdown. `*` includes all vault files. To restrict, list extensions explicitly (e.g. `md, pdf, txt`). Add a trailing comma to also match files with no extension (e.g. `md, txt,`). |

## Context & memory

| Setting                              | Default                                              | Description                                                                                                                                                                                                                     |
| ------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Minimal mode**                     | Off                                                    | Skip all context injection — no orientation, vault tree, context file, or active note. Reduces session start cost to zero. UI Bridge actions and vault queries will not work. Skills still work. Affected settings are greyed out when enabled. |
| **Show context file setup prompt**       | On        | Show the setup dialog on launch when no context file is found (see [Context System](./context-system#getting-started)). Disable if you prefer to create the file manually.                                                    |
| **Context file path**                | `_claude-context.md`                                 | Vault-relative path to the context file injected at session start.                                                                                                                                                              |
| **Vault tree depth**                 | Off                                                    | Levels of folder/file names injected at session start. `0` = off (default), `1`–`10` = N levels, `-1` = unlimited. Names only — no file contents. The agent discovers structure on demand via the vault query protocol when off.  |
| **Autonomous memory**                | On                                                     | The agent updates the context file as it learns about your vault. Disable if you prefer manual control or if your vault is shared. Disabled in minimal mode.                                                                      |
| **Memory file size limit (tokens)**  | `0` (no limit)                                        | When the context file exceeds this token count, the agent is instructed to compact it before the session ends — summarizing redundant entries and dropping outdated observations. `0` disables the cap. Disabled in minimal mode. |
| **Inject split-pane files as context** | On                                                   | When notes are open side by side in split panes, include all visible file paths in the active note context.                                                                                                                    |
| **Inject stacked tab files as context** | Off                                                  | When multiple notes are open as stacked tabs in the same pane, include all open tab file paths in the active note context.                                                                                                     |
| **Max canvas size (characters)**     | `50000`                                               | Canvas files converted to text and injected as context are truncated at this character limit. `0` = no limit.                                                                                                                   |

## Permissions

| Setting                                  | Default   | Description                                                                                                                                                                                                                     |
| ----------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Default permission mode**              | Standard  | The mode new sessions start in: **Chat only** (web only, no file system), **Standard** (files + web, plus read-only shell commands Claude Code classifies as safe; other shell commands are denied, and with Gemini (Antigravity CLI) all shell commands are denied), **Read only** (read + web, no writes), **Full access** (everything, including shell commands). Each session saves its own mode, so changing this doesn't affect existing sessions or the open one. See [Permissions](./permissions). |
| **Persist full access between restarts** | Off       | Only shown while the default or the open session is in Full access. When off, Full access lasts until Obsidian restarts: then the default goes back to Standard and sessions left in Full access reopen in Standard, so an elevated mode never silently survives a reboot. |

## UI bridge & commands

| Setting                           | Default                                              | Description                                                                                                                                                        |
| ---------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **UI bridge**                     | On                                                     | Master switch for the agent's ability to trigger Obsidian UI actions at all — opening files, navigating, running commands, and the other actions on the [Chat Panel](./chat-panel) page. Turn off to make BojuBot purely conversational. |
| **Prompt for unlisted commands**  | On                                                    | When the agent tries a command not in the allowlist, show a confirmation modal. Allow + "Don't ask again" adds to allowlist. Deny + "Don't ask again" adds to denylist. |
| **Denied commands**               | *(hidden until used)*                                 | Shows count of permanently denied commands with a **Clear denylist** button. To re-enable a specific command, add it to the allowlist via the command browser.    |
| **Command Allowlist**             | `switcher:open`, `daily-notes`, `editor:open-search`  | Obsidian commands the agent can run directly, in Standard and Full access only (Chat only and Read only never run commands). Search and check commands in the browser below this setting to enable them.                                            |

## Sessions

| Setting                              | Default                                              | Description                                                                                                                                                                                                                     |
| ------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Session storage path**             | *(empty — default location)*                          | Where session JSON files are stored. See [Session storage location](#session-storage-location) below.                                                                                                                          |
| **Export folder**                    | `BojuBot Exports`                                     | Default folder for **Export session to vault**. Created automatically if it doesn't exist. Follows the display name set under [Branding](#branding) — e.g. `Acme Exports` on a white-labeled build.                            |

## Skills

| Setting                              | Default                                              | Description                                                                                                                                                                                                                     |
| ------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Skills folder**                    | *(empty — default: `_BojuBot Skills/` at vault root)* | Folder containing skill files. See [Slash commands](./slash-commands).                                                                                                                                                         |
| **Register skills as Ctrl+P commands** | On                                                   | Expose each skill as a command palette entry (prefixed "Skill: …"). Run **BojuBot: Reload skills** after adding or removing skill files. Disable if the extra commands clutter your palette.                                   |

## Branding

Every branding setting is optional and defaults to the stock BojuBot identity — leaving all of them blank is byte-for-byte the same experience as today. This exists for white-label distributions (teams, template vaults) that want to present the plugin under their own name without patching the bundle.

Configure under **Settings → BojuBot → Branding**:

| Setting                        | Default                    | Description                                                                                                                                       |
| ------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Display name**                | `BojuBot`                   | Shown in the panel title, ribbon tooltip, welcome header, notices, and prompts.                                                                    |
| **Ribbon icon**                 | `brain-circuit`              | [Lucide](https://lucide.dev/icons/) icon ID for the ribbon and view tab.                                                                            |
| **Logo**                       | *(bundled logo)*            | `data:` URI or vault-relative image path for the welcome header logo and About modal.                                                              |
| **Welcome sprite**              | *(bundled sprite)*          | `data:` URI or vault-relative image path for the welcome-screen mascot.                                                                            |
| **Documentation link**          | Official BojuBot guide      | About-modal Documentation card.                                                                                                                    |
| **Community link**              | Official Discord            | About-modal community card.                                                                                                                        |
| **Source link**                | Official GitHub repo        | About-modal source-code card.                                                                                                                      |
| **Support link**                | Official BojuBot guide      | Support URL shown to the agent in its own system prompt — only used when **Rebrand assistant identity** is on.                                        |
| **Rebrand assistant identity**  | Off                          | When on, the system prompt the agent receives uses your display name and support links too. Off = the agent still refers to itself as "BojuBot" internally, even with a custom display name set above. |
| **Lock branding**              | Off                          | One-way toggle: hides the entire Branding section from this panel once you're done configuring it, so end users can't discover or revert it. See below.                                            |

**Locking branding:** useful for enterprise or managed distributions — configure everything above, then flip **Lock branding** on and the whole section disappears from Settings for anyone using that install. There's deliberately no toggle back once it's hidden; unlocking requires editing `brand.locked` to `false` in `data.json` directly, then reloading the plugin (disable/re-enable it, or restart Obsidian) — editing the file alone has no effect until BojuBot re-reads it. This is a UX convenience to stop casual tampering, not a security boundary — anyone with file access to their own vault can always edit `data.json` regardless of what the Settings UI shows.

**Blank vs. hidden:** for the four link fields, a blank field always means "use the default" — clearing it puts the card back to the bundled URL. To hide a card entirely (for example, a white-label build that runs no community server), use the eye icon next to the field — this is a distinct, deliberate action from leaving the field blank. The icon reflects which state you're in: an open eye means the card is currently hidden, and clicking it restores the default link with no need to retype the original URL.

**Reload to apply:** most changes take effect the next time the panel or Settings tab is reopened. Restart Obsidian to be sure ribbon icon and tab-title changes have taken effect everywhere.

::: info Attribution stays intact
Once any display name other than "BojuBot" is set, the About modal adds a small "Based on BojuBot by Scott Kirvan · MIT" credit line below the usual content. This line isn't configurable — it's how upstream attribution is preserved on white-label builds.
:::

## Logging

| Setting                | Default                                       | Description                                                                                                        |
| ------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Enable debug log**    | **Off**                                        | Write a debug log file. See [Troubleshooting](./troubleshooting#logging).                                          |
| **Log file path**       | `.obsidian/plugins/bojubot/bojubot-debug.log` | Vault-relative path for the log file. Defaults to the plugin folder so it stays out of your vault and git history. |
| **Log verbosity**       | Normal                                         | **Normal** logs session events and errors. **Verbose** adds raw stream data and token breakdowns.                  |

## Help & feedback

Links to the [documentation](/) and help on [Discord](https://discord.gg/TN6XJSNK5Y), plus **Report a problem** and **Request a feature**, which open the [report form](./chat-panel#reporting-a-problem). On white-labeled installs these follow the brand's own links.

## Support the project

The last section in settings: ways to support BojuBot (Ko-fi, GitHub Sponsors, starring the repo, and [more ways to help](https://www.scottkirvan.com/BojuBot/support)), plus one setting:

| Setting                        | Default | Description |
| ------------------------------ | ------- | ----------- |
| **Hide the support message**   | Off     | Stop the [occasional welcome-screen message](./chat-panel#welcome-screen) and the small support link. Shares its setting with the message's **I already donated** checkbox. |

This section isn't shown on white-labeled installs.

## Custom models

For Claude Code sessions, BojuBot ships with a hardcoded list of Claude models (Haiku, Sonnet, Opus). When new models are released you can add them without waiting for a plugin update by creating a file at:

```
<vault>/.obsidian/plugins/bojubot/custom-models.json
```

The file is a JSON array of model objects. Any valid entries are appended to the built-in list in the `/model` picker:

```json
[
  {
    "id": "claude-sonnet-4-7",
    "displayName": "Claude Sonnet 4.7",
    "description": "Latest Sonnet model"
  }
]
```

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Full model ID passed to `--model` at spawn time |
| `displayName` | Yes | Name shown in the picker |
| `description` | No | Short note shown below the name |

The file is read each time the picker opens, so changes take effect immediately with no restart needed. If the file is missing or malformed, it is silently ignored and only the built-in models are shown.

Gemini sessions don't use this file: their models come from the Antigravity CLI.

## Session storage location

By default, session files are stored in `.obsidian/bojubot/sessions/` inside your vault. This folder is typically gitignored, so sessions don't appear in your git history.

You can change this in **Settings → BojuBot → Session storage path**:

| Value                            | Behaviour                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| *(empty)*                        | Default — `.obsidian/bojubot/sessions/`. Gitignored.                                |
| `_sessions` (vault-relative)     | Sessions stored at `_sessions/` in your vault root. Tracked by git if not excluded. |
| `/Users/you/sessions` (absolute) | Sessions stored outside the vault entirely.                                         |

When you close settings after changing the path, BojuBot offers to move your existing sessions (and Gemini session transcripts) to the new folder. A file that already exists in the new folder is never overwritten; it stays in the old folder, and a notice says how many were left. If you choose **Leave them**, those sessions stay in the old folder and aren't listed until you set the old path again. No restart is needed either way.

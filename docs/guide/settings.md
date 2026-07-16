# Settings

Open **Settings → BojuBot** to configure:

| Setting                            | Default                                              | Description                                                                                                                                                                                                                                    |
| ---------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Claude binary path**             | *(auto-detect)*                                      | Full path to the `claude` executable. Leave blank to auto-detect from PATH and common install locations.                                                                                                                                       |
| **Context file path**              | `_claude-context.md`                                 | Vault-relative path to the context file injected at session start.                                                                                                                                                                             |
| **Branding**                        | *(stock BojuBot identity)*                           | Customize name, icon, logo, mascot, and links for white-label distributions. See [Branding](#branding) below.                                                                                                                                   |
| **Export folder**                  | `BojuBot Exports`                                    | Default folder for **Export session to vault**. Created automatically if it doesn't exist. Follows the display name set under [Branding](#branding) — e.g. `Acme Exports` on a white-labeled build.                                            |
| **Session storage path**           | *(empty — default location)*                         | Where session JSON files are stored. See [Session storage location](#session-storage-location) below.                                                                                                                                          |
| **Skills folder**                  | *(empty — default: `_BojuBot Skills/` at vault root)* | Folder containing skill files. See [Slash commands](./slash-commands).                                                                                                                                                                        |
| **Vault tree depth**               | Off                                                  | Levels of folder/file names injected at session start. `0` = off (default), `1`–`10` = N levels, `-1` = unlimited. Names only — no file contents. Claude discovers structure on demand via the vault query protocol when off.                  |
| **Send on Enter**                  | On                                                   | Press Enter to send. Shift+Enter always inserts a newline.                                                                                                                                                                                     |
| **Resume last session on startup** | On                                                   | Automatically resume the most recent session when the panel opens.                                                                                                                                                                             |
| **Autonomous memory**              | On                                                   | Claude updates the context file as it learns about your vault. Disable if you prefer manual control or if your vault is shared. Disabled in minimal mode.                                                                                      |
| **Memory file size limit (tokens)** | `0` (no limit)                                      | When the context file exceeds this token count, Claude is instructed to compact it before the session ends — summarizing redundant entries and dropping outdated observations. `0` disables the cap. Disabled in minimal mode.                  |
| **Minimal mode**                   | Off                                                  | Skip all context injection — no orientation, vault tree, context file, or active note. Reduces session start cost to zero. UI Bridge actions and vault queries will not work. Skills still work. Affected settings are greyed out when enabled. |
| **Permission mode**                | Standard                                             | Controls what vault operations Claude can perform: **Chat only** (web only, no file system), **Standard** (files + web), **Read only** (read + web, no writes), **Full access** (everything including Bash). See [Permissions](./permissions). |
| **Command Allowlist**              | `switcher:open`, `daily-notes`, `editor:open-search` | Obsidian commands Claude can run via the UI Bridge. Found under **UI Bridge & Commands**. Allowlisted commands execute immediately.                                                                                                            |
| **Prompt for unlisted commands**   | On                                                   | When Claude tries a command not in the allowlist, show a confirmation modal. Allow + "Don't ask again" adds to allowlist. Deny + "Don't ask again" adds to denylist.                                                                           |
| **Denied commands**                | *(hidden until used)*                                | Shows count of permanently denied commands with a **Clear denylist** button. To re-enable a specific command, add it to the allowlist via the command browser.                                                                                 |
| **Enable debug log**               | On                                                   | Write a debug log file. See [Troubleshooting](./troubleshooting#logging).                                                                                                                                                                      |
| **Log file path**                  | `.obsidian/plugins/bojubot/bojubot-debug.log`        | Vault-relative path for the log file. Defaults to the plugin folder so it stays out of your vault and git history.                                                                                                                             |
| **Log verbosity**                  | Normal                                               | **Normal** logs session events and errors. **Verbose** adds raw stream data and token breakdowns.                                                                                                                                              |
| **@-mention file types**           | `*` (all vault files)                                | Comma-separated extensions for the `@` autocomplete dropdown. `*` includes all vault files. To restrict, list extensions explicitly (e.g. `md, pdf, txt`). Add a trailing comma to also match files with no extension (e.g. `md, txt,`).       |
| **Inject split-pane files**        | On                                                   | When in split-pane view, include all visible file paths as active note context.                                                                                                                                                                |

## Custom models

BojuBot ships with a hardcoded list of Claude models (Haiku, Sonnet, Opus). When new models are released you can add them without waiting for a plugin update by creating a file at:

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
| **Support link**                | Official BojuBot guide      | Support URL shown to Claude in its own system prompt — only used when **Rebrand assistant identity** is on.                                        |
| **Rebrand assistant identity**  | Off                          | When on, the system prompt Claude receives uses your display name and support links too. Off = Claude still refers to itself as "BojuBot" internally, even with a custom display name set above. |
| **Lock branding**              | Off                          | One-way toggle: hides the entire Branding section from this panel once you're done configuring it, so end users can't discover or revert it. See below.                                            |

**Locking branding:** useful for enterprise or managed distributions — configure everything above, then flip **Lock branding** on and the whole section disappears from Settings for anyone using that install. There's deliberately no toggle back once it's hidden; unlocking requires editing `brand.locked` to `false` in `data.json` directly. This is a UX convenience to stop casual tampering, not a security boundary — anyone with file access to their own vault can always edit `data.json` regardless of what the Settings UI shows.

**Blank vs. hidden:** for the four link fields, a blank field always means "use the default" — clearing it puts the card back to the bundled URL. To hide a card entirely (for example, a white-label build that runs no community server), use the eye icon next to the field — this is a distinct, deliberate action from leaving the field blank. The icon reflects which state you're in: an open eye means the card is currently hidden, and clicking it restores the default link with no need to retype the original URL.

**Reload to apply:** most changes take effect the next time the panel or Settings tab is reopened. Restart Obsidian to be sure ribbon icon and tab-title changes have taken effect everywhere.

::: info Attribution stays intact
Once any display name other than "BojuBot" is set, the About modal adds a small "Based on BojuBot by Scott Kirvan · MIT" credit line below the usual content. This line isn't configurable — it's how upstream attribution is preserved on white-label builds.
:::

## Session storage location

By default, session files are stored in `.obsidian/bojubot/sessions/` inside your vault. This folder is typically gitignored, so sessions don't appear in your git history.

You can change this in **Settings → BojuBot → Session storage path**:

| Value                            | Behaviour                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| *(empty)*                        | Default — `.obsidian/bojubot/sessions/`. Gitignored.                                |
| `_sessions` (vault-relative)     | Sessions stored at `_sessions/` in your vault root. Tracked by git if not excluded. |
| `/Users/you/sessions` (absolute) | Sessions stored outside the vault entirely.                                         |

::: warning Sessions are not migrated
Changing this setting affects **new sessions only**. Existing sessions remain in their original location and will not appear in the session manager until you change the path back. If you want to move existing sessions, copy the `.json` files manually to the new path before restarting BojuBot.
:::

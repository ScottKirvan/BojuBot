# Commands

Press **Ctrl+P** (Windows/Linux) or **Cmd+P** (Mac) to open the Command Palette and search for any of the following:

## Panel & Navigation

| Command                               | ID                               | Description                                                                           |
| ------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| **ObsidiBot: Open agent panel**       | `open-obsidibot-agent`           | Opens or focuses the chat panel. Also available via the wave icon in the left ribbon. |
| **ObsidiBot: Toggle ObsidiBot panel** | `toggle-obsidibot-panel`         | Quickly hide or show the chat panel without closing it.                               |
| **ObsidiBot: Show session history**   | `show-obsidibot-session-history` | Show all saved sessions and resume a previous conversation.                           |

## Session Management

| Command                              | ID                        | Description                                                                              |
| ------------------------------------ | ------------------------- | ---------------------------------------------------------------------------------------- |
| **ObsidiBot: New session**           | `new-obsidibot-session`   | Start a fresh conversation. The current session is saved automatically.                  |
| **ObsidiBot: Clear current session** | `clear-obsidibot-session` | Clear all messages from the current session. Context is re-injected on the next message. |

## Communication & Settings

| Command                                  | ID                              | Description                                                                                                                     |
| ---------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **ObsidiBot: Export conversation**       | `export-obsidibot-conversation` | Copy the current conversation as markdown to the clipboard.                                                                     |
| **ObsidiBot: Export session to vault**   | `export-obsidibot-to-vault`     | Save the current conversation as a vault note. Prompts for a path (defaults to configured Export folder).                       |
| **ObsidiBot: Copy last response**        | `copy-obsidibot-last-response`  | Copy Claude's last response to the clipboard.                                                                                   |
| **ObsidiBot: Change permission mode**    | `change-obsidibot-permission-mode` | Open a picker to switch the active permission mode (Chat only / Read only / Standard / Full access). Takes effect on the next message. |
| **ObsidiBot: Open settings**             | `open-obsidibot-settings`       | Jump directly to the ObsidiBot settings panel.                                                                                  |
| **ObsidiBot: Send selection as context** | `send-selection-to-obsidibot`   | Highlight text in any note, then run this command to attach it as context.                                                      |
| **ObsidiBot: Focus chat input**          | `focus-obsidibot-input`         | Open the ObsidiBot panel and place the cursor in the chat input. Good for hotkey binding.                                       |
| **ObsidiBot: Open context file**         | `open-obsidibot-context-file`   | Open `_claude-context.md` (or your configured path) for editing.                                                                |
| **ObsidiBot: Refresh session context**   | `refresh-obsidibot-context`     | Re-inject the context file, command allowlist, and frontmatter into the active session. Queued and sent with your next message. |
| **ObsidiBot: About ObsidiBot**           | `show-obsidibot-about`          | Show version info and links.                                                                                                    |
| **ObsidiBot: Reload skills**             | `reload-obsidibot-skills`       | Re-scan the skills folder and update Ctrl+P registrations. Run this after adding or removing skill files.                       |

## Skills API

When **Settings → Register skills as Ctrl+P commands** is enabled, each skill file is registered as an Obsidian command at plugin load (and on every "Reload skills" call). This turns your skills folder into a lightweight automation API for your vault.

### Command ID format

Skill commands follow the pattern:

```
obsidibot:skill-<slugified-filename>
```

Where the slug is the filename (minus `.md`) lowercased with non-alphanumeric characters replaced by hyphens. For example:

| File | Command ID |
|---|---|
| `Weekly Review.md` | `obsidibot:skill-weekly-review` |
| `Bug Report.md` | `obsidibot:skill-bug-report` |
| `summarize-note.md` | `obsidibot:skill-summarize-note` |

### Assigning hotkeys

Any skill can be given a keyboard shortcut via **Settings → Hotkeys**. Search for `Skill:` to find all registered skills. This means you can bind your most-used agentic workflows to a single keypress.

### Using skills from other plugins

Because skills are standard Obsidian commands, any plugin that can trigger commands can trigger skills — including Templater, QuickAdd, Commander, and others. Reference the command ID directly:

```
obsidibot:skill-weekly-review
```

This makes ObsidiBot skills composable with the rest of your Obsidian automation stack.

### Behaviour when the panel is closed

If the ObsidiBot chat panel is not open when a skill command runs, the panel opens automatically before the skill executes. For parameterized skills, the form modal appears on top of the newly opened panel.

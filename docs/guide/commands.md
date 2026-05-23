# Commands

Press **Ctrl+P** (Windows/Linux) or **Cmd+P** (Mac) to open the Command Palette and search for any of the following:

## Panel & Navigation

| Command                           | ID                             | Description                                                                           |
| --------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------- |
| **BojuBot: Open agent panel**     | `open-bojubot-agent`           | Opens or focuses the chat panel. Also available via the wave icon in the left ribbon. |
| **BojuBot: Toggle BojuBot panel** | `toggle-bojubot-panel`         | Quickly hide or show the chat panel without closing it.                               |
| **BojuBot: Show session history** | `show-bojubot-session-history` | Show all saved sessions and resume a previous conversation.                           |

## Session Management

| Command                            | ID                      | Description                                                                              |
| ---------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------- |
| **BojuBot: New session**           | `new-bojubot-session`   | Start a fresh conversation. The current session is saved automatically.                  |
| **BojuBot: Clear current session** | `clear-bojubot-session` | Clear all messages from the current session. Context is re-injected on the next message. |

## Communication & Settings

| Command                                | ID                               | Description                                                                                                                            |
| -------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **BojuBot: Export conversation**       | `export-bojubot-conversation`    | Copy the current conversation as markdown to the clipboard.                                                                            |
| **BojuBot: Export session to vault**   | `export-bojubot-to-vault`        | Save the current conversation as a vault note. Prompts for a path (defaults to configured Export folder).                              |
| **BojuBot: Copy last response**        | `copy-bojubot-last-response`     | Copy Claude's last response to the clipboard.                                                                                          |
| **BojuBot: Change permission mode**    | `change-bojubot-permission-mode` | Open a picker to switch the active permission mode (Chat only / Read only / Standard / Full access). Takes effect on the next message. |
| **BojuBot: Open settings**             | `open-bojubot-settings`          | Jump directly to the BojuBot settings panel.                                                                                           |
| **BojuBot: Send selection as context** | `send-selection-to-bojubot`      | Highlight text in any note, then run this command to attach it as context.                                                             |
| **BojuBot: Focus chat input**          | `focus-bojubot-input`            | Open the BojuBot panel and place the cursor in the chat input. Good for hotkey binding.                                                |
| **BojuBot: Open context file**         | `open-bojubot-context-file`      | Open `_claude-context.md` (or your configured path) for editing.                                                                       |
| **BojuBot: Refresh session context**   | `refresh-bojubot-context`        | Re-inject the context file, command allowlist, and frontmatter into the active session. Queued and sent with your next message.        |
| **BojuBot: About BojuBot**             | `show-bojubot-about`             | Show version info and links.                                                                                                           |
| **BojuBot: Reload skills**             | `reload-bojubot-skills`          | Re-scan the skills folder and update Ctrl+P registrations. Run this after adding or removing skill files.                              |

## Skills API

When **Settings → Register skills as Ctrl+P commands** is enabled, each skill file is registered as an Obsidian command at plugin load (and on every "Reload skills" call). This turns your skills folder into a lightweight automation API for your vault.

### Command ID format

Skill commands follow the pattern:

```
bojubot:skill-<slugified-filename>
```

Where the slug is the filename (minus `.md`) lowercased with non-alphanumeric characters replaced by hyphens. For example:

| File                | Command ID                     |
| ------------------- | ------------------------------ |
| `Weekly Review.md`  | `bojubot:skill-weekly-review`  |
| `Bug Report.md`     | `bojubot:skill-bug-report`     |
| `summarize-note.md` | `bojubot:skill-summarize-note` |

### Assigning hotkeys

Any skill can be given a keyboard shortcut via **Settings → Hotkeys**. Search for `Skill:` to find all registered skills. This means you can bind your most-used agentic workflows to a single keypress.

### Using skills from other plugins

Because skills are standard Obsidian commands, any plugin that can trigger commands can trigger skills — including Templater, QuickAdd, Commander, and others. Reference the command ID directly:

```
bojubot:skill-weekly-review
```

This makes BojuBot skills composable with the rest of your Obsidian automation stack.

### Behaviour when the panel is closed

If the BojuBot chat panel is not open when a skill command runs, the panel opens automatically before the skill executes. For parameterized skills, the form modal appears on top of the newly opened panel.

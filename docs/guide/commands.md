# Commands

Press **Ctrl+P** (Windows/Linux) or **Cmd+P** (Mac) to open the Command Palette and search for any of the following.

::: info Command ID format
Obsidian namespaces every plugin command as `<plugin-id>:<command-id>`. BojuBot's plugin ID is `bojubot`, so **BojuBot: Open agent panel** has the full ID `bojubot:open-agent` — that's the string to reference from a hotkey config, `run-command`, or another plugin (Templater, QuickAdd, Commander, etc.). The tables below show the ID without the `bojubot:` prefix for brevity.
:::

## Panel & Navigation

| Command                           | ID                      | Description                                                                            |
| ---------------------------------- | ------------------------ | --------------------------------------------------------------------------------------- |
| **BojuBot: Open agent panel**     | `open-agent`            | Opens or focuses the chat panel. Also available via the ribbon icon.                    |
| **BojuBot: Toggle panel**         | `toggle-panel`          | Quickly hide or show the chat panel without closing it.                                 |
| **BojuBot: Show session history** | `show-session-history`  | Show all saved sessions and resume a previous conversation.                             |
| **BojuBot: Focus chat input**     | `focus-input`           | Open the BojuBot panel and place the cursor in the chat input. Good for hotkey binding.  |

## Session Management

| Command                             | ID                        | Description                                                                              |
| ------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------- |
| **BojuBot: New session**            | `new-session`             | Start a fresh conversation. The current session is saved automatically.                 |
| **BojuBot: Clear current session**  | `clear-session`           | Clear all messages from the current session. Context is re-injected on the next message. |
| **BojuBot: Switch model**           | `switch-model`            | Open the model picker. Switching starts a new session — see [Model Indicator](./chat-panel#model-indicator). |
| **BojuBot: Change permission mode** | `change-permission-mode`  | Open a picker to switch the active permission mode (Chat only / Read only / Standard / Full access). Takes effect on the next message. |

## Context & Memory

| Command                                | ID                    | Description                                                                                                                        |
| ----------------------------------------| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **BojuBot: Open context file**         | `open-context-file`   | Open `_claude-context.md` (or your configured path) for editing.                                                                   |
| **BojuBot: Refresh session context**   | `refresh-context`     | Re-inject the context file, command allowlist, and frontmatter into the active session. Queued and sent with your next message.    |
| **BojuBot: Audit memory file**         | `audit-memory-file`   | Starts a new session and asks Claude to review your context file for prompt-injection-style content — instructions or directives that look out of place, encoded/obfuscated text, or anything a third party may have slipped in. Run this if autonomous memory is on and you want a sanity check. |
| **BojuBot: Send selection as context** | `send-selection`      | Highlight text in any note, then run this command to attach it as context.                                                         |

## Communication & Settings

| Command                               | ID                     | Description                                                                    |
| ---------------------------------------| ------------------------ | --------------------------------------------------------------------------------- |
| **BojuBot: Export conversation**      | `export-conversation`  | Copy the current conversation as markdown to the clipboard.                    |
| **BojuBot: Export session to vault**  | `export-to-vault`      | Save the current conversation as a vault note. Prompts for a path (defaults to configured Export folder). |
| **BojuBot: Copy last response**       | `copy-last-response`   | Copy Claude's last response to the clipboard.                                  |
| **BojuBot: Open settings**            | `open-settings`        | Jump directly to the BojuBot settings panel.                                   |
| **BojuBot: About**                    | `show-about`           | Show version info and links — see [About Dialog](./chat-panel#about-dialog).  |
| **BojuBot: Reload skills**            | `reload-skills`        | Re-scan the skills folder and update Ctrl+P registrations. Run this after adding or removing skill files. |

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

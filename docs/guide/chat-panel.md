# Chat Panel

The chat panel opens as a sidebar. Type your message and press **Enter** to send. Use **Shift+Enter** to insert a newline without sending. The "Send on Enter" behaviour can be toggled in **Settings → ObsidiBot**.

Claude has access to your full vault — it can read, write, create, move, and organize notes. The vault root is Claude's working directory.

---

## Attaching Context

Attached items appear in a bar above the input field. Click **×** to remove an item, or the **pin icon** to keep it attached for every subsequent message in the session.

### @-mention a note

Type `@` anywhere in the input to open an autocomplete dropdown. The currently open note is pre-selected — press **Enter** immediately to attach it. Start typing to filter by name. Press **↑ / ↓** to navigate, **Enter** or **Tab** to select, **Escape** to dismiss. The full contents of the selected note are prepended to your message.

Non-Markdown files show their extension in the dropdown. By default all vault files are included. To restrict to specific types, change **@-mention file types** in [Settings](./settings.md).

### Attachment button (paperclip)

| Option          | What it does                                                                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Attach file** | Opens your system file picker. Text files (`.md`, `.txt`, `.js`, etc.) are read inline. Images and PDFs are copied to a temporary folder so Claude can read them. |
| **Attach URL**  | Passes a URL to Claude as-is. Claude fetches or references it based on your message.                                                                              |
| **@ Add note**  | Opens the same vault note search as the `@` shortcut.                                                                                                             |

### Paste from clipboard

Paste images directly with **Ctrl+V** / **Cmd+V**:

- **Screenshots** — take a screenshot, paste into ObsidiBot
- **Files from Explorer/Finder** — copy a `.png`, `.jpg`, `.gif`, `.webp`, or `.pdf` and paste

Pasted images appear in the context bar. They're saved to `.obsidian/plugins/obsidibot/tmp/` and are not automatically cleaned up.

### Drag and drop

Drag any file from your filesystem and drop it onto the ObsidiBot panel. The panel highlights with a dashed border while dragging. Text files are read inline; images and PDFs are handled the same as the file picker.

### Send selected text

Highlight text in any open note, then run **ObsidiBot: Send selection as context** from the Command Palette (or bind it to a hotkey). The selection is attached as a labeled snippet.

---

## Context Gauge

A **ring icon** appears in the input bar after your first message. Hover to see how much of the 200K token context window remains. Click it to manually compact the session history if it's filling up.

---

## Tool Call Visibility

While Claude is working, tool calls appear above the response bubble in real time — you can see what Claude is reading, writing, or searching. When the response completes, the tool list collapses to a single toggle line. Click to expand or collapse.

---

## Running Obsidian Commands

Claude can execute Obsidian commands directly. Three are pre-approved by default:

| Command                   | ID                   |
| ------------------------- | -------------------- |
| Quick switcher            | `switcher:open`      |
| Daily notes: Open today's | `daily-notes`        |
| Search current file       | `editor:open-search` |

You can manage the full list in **Settings → ObsidiBot → UI Bridge & Commands**.

### How permission works

| Situation                                     | What happens                                              |
| --------------------------------------------- | --------------------------------------------------------- |
| Command in **allowlist**                      | Runs immediately                                          |
| Command **not** in allowlist (prompt mode on) | Modal appears: Allow or Deny, with **Don't ask again**    |
| Allow + Don't ask again                       | Runs and added to allowlist permanently                   |
| Deny + Don't ask again                        | Added to denylist — future attempts silently blocked      |
| Command in **denylist**                       | Silently blocked (add to allowlist to re-enable)          |
| Prompt mode off                               | Unlisted commands hard-blocked with an explanatory notice |

---

## Example Prompts

```
"Summarize the note [[Project Alpha]]"
"Find all notes tagged #meeting from last week and create a summary"
"Rename all notes in 03_Cards that start with 'Untitled' based on their content"
"Open today's daily note"
"Refresh the Dataview on this page"
"Create a new note from my Project template"
```

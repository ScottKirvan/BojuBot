# Sessions

## Starting a new session

Click the **+** button in the toolbar to start a new session with default settings.

**Shift+click +** to open a **Custom Session** dialog and configure the session before it starts:

| Field | What it does |
|---|---|
| **Agent** | Which agent CLI the session runs on (Claude Code or Antigravity), pre-filled from the **Agent** setting. Changing it refills the model and effort fields for that agent. Agents that aren't installed are listed but can't be picked. See [Choosing an Agent](./agents). |
| **Session name** | Pre-fills the title instead of waiting for auto-naming from the first message. Leave blank to use the default. |
| **Working directory** | Sets the directory Claude runs in (useful for code projects outside the vault). The folder browser opens at your vault root. Leave blank to use the vault root. |
| **Permission mode** | Pre-filled with your current default (with its colored icon), so you can see exactly what you're starting from. Click a different mode to start the session in it instead. Every session keeps its own mode; see [Permissions](./permissions#the-mode-belongs-to-the-session). |
| **Model** | Pre-filled with your current global default model. Pick a different one to pin this session to it instead. |
| **Effort** | Pre-filled with your current global [effort](./chat-panel.md#effort) level. Pick a level to pin this session to it; **Default** leaves it unpinned so it follows the global setting. Hidden when your Claude Code CLI doesn't support effort levels. |
| **Raw session** | Skips *all* BojuBot context injection — no orientation, vault tree, context file, active-note note, or UI Bridge. The CLI still reads its own instruction files (e.g. Claude Code's `CLAUDE.md`) from the working directory, exactly as it would from a terminal. This is the per-session equivalent of the global Minimal mode setting. |
| **Initial instructions** | A system prompt injected at session start — role, focus, standing rules. Leave blank for none. |
| **Include vault context** | Checked by default. Uncheck to suppress the vault tree, `_claude-context.md`, and pinned notes — useful for focused code sessions where Obsidian-specific context is noise. The system orientation (permission mode, tools) is always injected regardless. Ignored when "Raw session" is on, since that already suppresses everything. |
| **Context attachments** | Attach files, vault notes, or URLs before the first message. Same attachment support as the main chat. |

Empty fields fall back to normal defaults — you can fill in one field and leave the rest blank.

::: tip
Shift+click is a common power-user shortcut in browsers and file managers for "do the thing, but with options." Normal click stays fast; Shift+click unlocks the full setup.
:::

::: info Custom cwd persists
The working directory you set is saved in the session JSON and used on every turn, including when you resume the session after a restart. Claude always runs in the directory you picked.
:::

::: info Permission mode, model, and raw-session persist too
Like the working directory, these are saved in the session JSON and re-applied every time the session is resumed — they aren't a one-time setup step. (Every session saves its permission mode, not only custom ones.)

Initial instructions and context attachments are sent with the session's first message. If you open a different session before sending one, they're dropped.

A pinned model isn't locked in: switching models from the [model picker](./chat-panel.md#model-indicator) mid-session updates the pin, and the session continues with the new model.
:::

---

## Sessions Panel

The **Sessions** panel lists every saved session. It opens in the left sidebar, next to the file explorer, and stays open while you chat, so you can jump between sessions without opening a dialog each time. Like any Obsidian sidebar panel, you can drag its tab to the other sidebar or into the main area.

Open it by clicking the **session name** in the chat toolbar, **More…** under the welcome screen's recent sessions, `/` → **Show sessions** in the chat, or **BojuBot: Show sessions panel** in the Command Palette.

### Rows

Each session takes two lines:

- **The title** on top (a pin icon in front when it's pinned).
- **The agent and model** below, in small text: the agent's icon (the Claude mark for Claude Code, the Gemini sparkle for Antigravity), the agent and model names, and when the session was last active ("5m ago", "yesterday", "Mar 4").

Hover a row for the details that don't fit on it: the full last-active date and time, an estimated token count of its saved history (with a "+context" figure: the estimated context a brand-new session would start with under your current settings), and whether it's **New** (no messages yet) or **Remote** (its history isn't on this machine, for example a session from another computer; Remote rows are dimmed).

A session always stays on its agent, so opening it switches to that agent. See [Choosing an Agent](./agents).

### Groups

Sessions are grouped by when they were last active: **Today**, **This week** (the past seven days) and **Older**. **Pinned** sessions sit above all of them.

### Actions

| Action               | How                                                                  |
| -------------------- | -------------------------------------------------------------------- |
| **Open a session**   | Click its row (or select it and press **Enter**)                     |
| **New session**      | Click the **+** button next to the filter                            |
| **Filter**           | Type in the filter box at the top                                    |
| **Rename**           | Right-click the row, or click **⋯** → **Rename** → edit → **Enter**  |
| **Pin / Unpin**      | Right-click or **⋯** → **Pin** keeps the session at the top          |
| **Save to vault**    | Right-click or **⋯** → **Save to vault** → enter the export path     |
| **Delete**           | Right-click or **⋯** → **Delete** → confirm                          |
| **Reorder**          | Drag a row up or down within its group                               |

### Active session

The session open in the chat panel is highlighted, with an accent-coloured left edge and a bold title.

## Storage Location

Sessions are stored as JSON files in `.obsidian/bojubot/sessions/` by default (gitignored). You can change this to a vault-relative or absolute path in **Settings → BojuBot → Session storage path** — for example, to track sessions in git alongside your notes.

::: warning
Changing the storage path only affects new sessions. Existing sessions stay where they are and won't appear in the Sessions panel until you switch back. Move the `.json` files manually if you want to bring them along.
:::

## Sort Order

Inside each group, sessions are listed most-recent-first by default. Once you drag any row, that order is saved and persists across restarts. New sessions are always inserted at the top of the list.

A session can only be dragged within its own group: to move a session to the top, pin it.

::: tip
Dragging is turned off while the filter is active. Filtering shows a subset, so reordering would produce confusing results.
:::

---

## Token Cost Model

Understanding when tokens are spent helps you use BojuBot efficiently.

| Action                                    | Token cost     | Notes                                             |
| ----------------------------------------- | -------------- | ------------------------------------------------- |
| Opening the panel                         | Free           | No API call                                       |
| Switching sessions in the Sessions panel  | Free           | Local disk read only                              |
| Browsing the Sessions panel               | Free           | All local                                         |
| **First message of a new session**        | **Full price** | Context injection + prompt; cache created         |
| **Continuing a session (within ~1 hour)** | **Cheap**      | History from prompt cache (~10× cheaper)          |
| **Resuming after restart or 1+ hour gap** | **Full price** | Cache expired; history re-charged as fresh tokens |
| Starting a new session                    | Free           | No API call until you send                        |

::: tip
Claude's prompt cache expires after ~1 hour. For sessions you haven't used in a while, starting a new session (paying only for context injection) may be cheaper than resuming a large accumulated one.
:::

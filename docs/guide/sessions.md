# Sessions

## Starting a new session

Click the **+** button in the toolbar to start a new session with default settings. **Ctrl+click** (**Cmd+click** on Mac) opens the new session in a new chat tab instead, keeping the current one open.

**Shift+click +** to open a **Custom Session** dialog and configure the session before it starts:

| Field | What it does |
|---|---|
| **Agent and model** | Which agent the session runs on (**Claude (Claude Code)** or **Gemini (Antigravity CLI)**) and its model, picked from the same agent + model picker as the [model indicator](./chat-panel#model-indicator). Pre-filled with the agent and model new sessions use (the ones you picked last). Picking another agent's model refills the effort field for it. Agents that aren't installed are listed but can't be picked. See [Choosing an Agent](./agents). |
| **Session name** | Pre-fills the title instead of waiting for auto-naming from the first message. Leave blank to use the default. |
| **Working directory** | Sets the directory the agent runs in (useful for code projects outside the vault). The folder browser opens at your vault root. Leave blank to use the vault root. |
| **Permission mode** | Pre-filled with your current default (with its colored icon), so you can see exactly what you're starting from. Click a different mode to start the session in it instead. Every session keeps its own mode; see [Permissions](./permissions#the-mode-belongs-to-the-session). |
| **Model** | Pre-filled with the chosen agent's default model. Pick a different one to pin this session to it instead. |
| **Effort** | Pre-filled with your current global [effort](./chat-panel.md#effort) level. Pick a level to pin this session to it; **Default** leaves it unpinned so it follows the global setting. Hidden when the chosen agent's CLI doesn't support effort levels. |
| **Raw session** | Skips *all* BojuBot context injection — no orientation, vault tree, context file, active-note note, or UI Bridge. The CLI still reads its own instruction files (e.g. Claude Code's `CLAUDE.md`) from the working directory, exactly as it would from a terminal. This is the per-session equivalent of the global Minimal mode setting. |
| **Initial instructions** | A system prompt injected at session start — role, focus, standing rules. Leave blank for none. |
| **Include vault context** | Checked by default. Uncheck to suppress the vault tree, `_claude-context.md`, and pinned notes — useful for focused code sessions where Obsidian-specific context is noise. The system orientation (permission mode, tools) is always injected regardless. Ignored when "Raw session" is on, since that already suppresses everything. |
| **Context attachments** | Attach files, vault notes, or URLs before the first message. Same attachment support as the main chat. |

Empty fields fall back to normal defaults — you can fill in one field and leave the rest blank.

::: tip
Shift+click is a common power-user shortcut in browsers and file managers for "do the thing, but with options." Normal click stays fast; Shift+click unlocks the full setup.
:::

::: info Custom cwd persists
The working directory you set is saved in the session JSON and used on every turn, including when you resume the session after a restart. The agent always runs in the directory you picked.
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
- **The agent and model** below, in small text: the agent's icon (the Claude mark for Claude, the Gemini sparkle for Gemini), the agent and model names, and when the session was last active ("5m ago", "yesterday", "Mar 4").

Hover a row for the details that don't fit on it: the full last-active date and time, an estimated token count of its saved history (with a "+context" figure: the estimated context a brand-new session would start with under your current settings), and whether it's **New** (no messages yet) or **Remote** (its history isn't on this machine, for example a session from another computer; Remote rows are dimmed).

A session always stays on its agent, so opening it switches to that agent. See [Choosing an Agent](./agents).

### Groups

Sessions are grouped by when they were last active: **Today**, **This week** (the past seven days) and **Older**. **Pinned** sessions sit above all of them.

### Actions

| Action               | How                                                                  |
| -------------------- | -------------------------------------------------------------------- |
| **Open a session**   | Click its row (or select it and press **Enter**). See below for which tab it opens in |
| **Open in a new tab** | **Ctrl/Cmd+click** the row, or right-click → **Open in new tab**    |
| **New session**      | Click the **+** button next to the filter (**Ctrl/Cmd+click** for a new tab) |
| **Filter**           | Type in the filter box at the top                                    |
| **Rename**           | Right-click the row, or click **⋯** → **Rename** → edit → **Enter**  |
| **Pin / Unpin**      | Right-click or **⋯** → **Pin** keeps the session at the top          |
| **Save to vault**    | Right-click or **⋯** → **Save to vault** → enter the export path     |
| **Delete**           | Right-click or **⋯** → **Delete** → confirm                          |
| **Reorder**          | Drag a row up or down within its group                               |

### Active session

The session in the chat panel you used last is highlighted, with an accent-coloured left edge and a bold title. Sessions open in any chat tab have a small ring before their title, or a coloured dot showing what they're doing (see [Live status](#live-status)).

## Several sessions at once

You can have several chat panels open, each running its own session, using Obsidian's own tabs and splits. A session keeps running when you switch to another tab, so you can start a long task on one agent and keep working in another session meanwhile. Each tab's title is its session's name, and tabs come back with their sessions when you restart Obsidian.

- **Open a new chat tab** with **Ctrl/Cmd+click** on **+** (in the chat toolbar or the Sessions panel), or **BojuBot: Open new chat tab**. Drag tabs to split them side by side, or between the sidebars and the main area, like any Obsidian tab.
- **Opening a session** from the Sessions panel or the recent-sessions list: if it's already open in a tab, BojuBot switches to that tab. A session is never open in two tabs. Otherwise it opens in the chat panel you used last when that panel is free (a new session you haven't typed in, with nothing running), or in a new tab next to it.
- **Starting a new session while a reply is running** keeps that reply running and opens the new session in a new tab.
- **Commands** that act on a chat panel (send selection, switch model, show plan usage, export, skills, and so on) use the chat panel you used last. Changing settings, the permission mode or the default model applies to every open chat panel.
- **Closing a chat tab:** click **✕** at the right of the chat toolbar (sidebar tabs show only an icon, so this is the easy way). The session stays in the Sessions panel. If a reply is running, BojuBot asks first: **Keep waiting**, or **Stop it and close**, which saves the reply so far with its session. Closing a tab some other way (right-click → **Close**) while it's replying stops the reply.

::: tip Plan limits
Sessions running at the same time each use your plan or quota, so limits run out faster.
:::

### Live status

A dot in the Sessions panel (before the title) and on each chat tab (on its icon in a sidebar, before its title in the main area) shows what a session is doing. Hover the dot in the Sessions panel for its name.

| Dot | Status | Means |
| --- | --- | --- |
| Pulsing accent | **Replying…** | A reply is running. |
| Orange | **Waiting for you** | The session needs a decision: a permission request, a denial card offering more access, or a command confirmation. |
| Green | **Finished** | A reply arrived while the session wasn't on screen. Clears when you look at it. |
| Red | **Error** | The reply stopped with an error while the session wasn't on screen. Clears when you look at it. |
| Ring | Open | Open in a chat tab, nothing to report. |

When a session you can't see finishes, stops with an error or needs you, a notice says so (for example "Vault cleanup is waiting for you"). Click it to switch to that session's tab. Notices for sessions waiting for you stay until you click them.

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

Understanding when tokens are spent helps you use BojuBot efficiently. This table describes Claude (Claude Code), which caches the conversation between messages. For Gemini, the Antigravity CLI doesn't report cache reads and adds its own instructions to every message; see [Choosing an Agent](./agents#what-s-different-with-gemini).

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
Claude Code's prompt cache expires after ~1 hour. For sessions you haven't used in a while, starting a new session (paying only for context injection) may be cheaper than resuming a large accumulated one.
:::

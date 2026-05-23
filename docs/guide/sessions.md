# Session Manager

Open the session manager by clicking the **session name** in the panel toolbar, or via **BojuBot: Show session history** in the Command Palette.

## Actions

| Action               | How                                                           |
| -------------------- | ------------------------------------------------------------- |
| **Resume a session** | Click any row                                                 |
| **Save to vault**    | Hover a row → click the **download icon** → enter export path |
| **Rename**           | Click the **pencil icon** → edit inline → Enter or click away |
| **Delete**           | Click the **trash icon** → confirm                            |
| **Reorder**          | Drag the ⠿ grip handle up or down                             |
| **Filter**           | Type in the search box at the top                             |

## Active Session

The currently open session is marked with an accent-coloured left border and bold title.

## Storage Location

Sessions are stored as JSON files in `.obsidian/bojubot/sessions/` by default (gitignored). You can change this to a vault-relative or absolute path in **Settings → BojuBot → Session storage path** — for example, to track sessions in git alongside your notes.

::: warning
Changing the storage path only affects new sessions. Existing sessions stay where they are and won't appear in the manager until you switch back. Move the `.json` files manually if you want to bring them along.
:::

## Sort Order

Sessions are listed most-recent-first by default. Once you drag any row, that order is saved and persists across restarts. New sessions are always inserted at the top of the list — drag them into position afterwards.

::: tip
Drag handles are hidden while the search filter is active — filtering shows a subset, so reordering would produce confusing results.
:::

---

## Token Cost Model

Understanding when tokens are spent helps you use BojuBot efficiently.

| Action                                    | Token cost     | Notes                                             |
| ----------------------------------------- | -------------- | ------------------------------------------------- |
| Opening the panel                         | Free           | No API call                                       |
| Switching sessions in History             | Free           | Local disk read only                              |
| Browsing session history                  | Free           | All local                                         |
| **First message of a new session**        | **Full price** | Context injection + prompt; cache created         |
| **Continuing a session (within ~1 hour)** | **Cheap**      | History from prompt cache (~10× cheaper)          |
| **Resuming after restart or 1+ hour gap** | **Full price** | Cache expired; history re-charged as fresh tokens |
| Starting a new session                    | Free           | No API call until you send                        |

::: tip
Claude's prompt cache expires after ~1 hour. For sessions you haven't used in a while, starting a new session (paying only for context injection) may be cheaper than resuming a large accumulated one.
:::

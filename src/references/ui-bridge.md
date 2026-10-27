## UI Bridge — Full Reference

@@BOJU {"action":"<name>",...params} — emit on its own line; intercepted by BojuBot, never shown to user.

Actions:
- open-file(path): open note in current leaf
- open-file-split(path, direction:vertical|horizontal): open in split pane
- open-file-new-tab(path): open in a new stacked tab (doesn't replace current tab or split the pane)
- navigate-heading(path, heading): scroll to heading in file
- show-notice(message, [duration_ms=4000]): toast notification
- focus-search: open quick switcher — confirm first
- open-settings([tab]): open settings, optionally to tab e.g. "bojubot" — confirm first
- run-command(commandId): execute command palette command — confirm first; always read obsidian-commands.md first. Requires Standard or Full permission mode (commands can create or change notes) — refused with a notice to the user otherwise.
- request-permission(tool, reason): when a blocked tool is clearly the right approach; emit at response end, user decides next turn; use when manual repetition across many files isn't practical
- set-label(user, assistant): update names when user states/corrects their name, asks to stop using one, or persona changes; defaults "User" and "BojuBot"
- report-problem(type:bug|feature|feedback, title, description): when the user asks you to report a bug, request a feature or send feedback about BojuBot itself, open its Report a problem form filled in. The user reviews it and decides whether to send it; you can't send it. title: one short line. description: Markdown; for a bug, what happened, what was expected, and numbered steps to reproduce. The form adds version, agent and model details itself, so leave those out. Reports are public GitHub issues: leave out note contents, names and paths unless the user asks for them.
- thanked(): only if your orientation has a "Thanks" section, emit when the user thanks you (in addition to replying normally); BojuBot may show a short note from its author
- rename-file(path, newName): rename a file in place via Obsidian's API so wikilinks/embeds update automatically. Requires Standard or Full permission mode — silently no-ops (with a notice to the user) otherwise.
- move-file(path, newPath): move a file to a different folder, same link-updating guarantee as rename-file. Requires Standard or Full permission mode.
- delete-file(path): move a file to trash per the vault's configured trash preference (not a permanent delete). Requires Standard or Full permission mode.

Confirm-first protocol: ask in response text → wait for explicit yes → emit action in following response. Never ask and act in the same response.

Always emit show-notice after open-file, open-file-split, open-file-new-tab, open-settings, focus-search, run-command, rename-file, move-file, delete-file.

Fallback: UI Bridge is convenience only. Direct file edits, .obsidian config files (.obsidian/*.json, snippets/, plugins/*/data.json), CSS snippets, and shell commands are always available alternatives.

Examples:
@@BOJU {"action":"open-file","path":"Notes/My Note.md"}
@@BOJU {"action":"show-notice","message":"Created and opened My Note.md"}
@@BOJU {"action":"open-file-split","path":"Notes/Reference.md","direction":"vertical"}
@@BOJU {"action":"open-file-new-tab","path":"Notes/Reference.md"}
@@BOJU {"action":"navigate-heading","path":"Notes/Project.md","heading":"Next Steps"}
@@BOJU {"action":"run-command","commandId":"editor:toggle-bold"}
@@BOJU {"action":"set-label","user":"Scott","assistant":"BojuBot"}
@@BOJU {"action":"request-permission","tool":"Write","reason":"Need to create 12 note files"}
@@BOJU {"action":"report-problem","type":"bug","title":"Gauge doesn't update after compact","description":"The context gauge stays full after compacting.\n\nExpected: it drops.\n\nSteps to reproduce:\n1. Chat until the gauge is over half full\n2. Click the gauge to compact\n3. Send a message"}
@@BOJU {"action":"rename-file","path":"04_Extras/media/old-name.png","newName":"new-name.png"}
@@BOJU {"action":"move-file","path":"Notes/some-note.md","newPath":"Archive/some-note.md"}
@@BOJU {"action":"delete-file","path":"04_Extras/media/unwanted-image.png"}

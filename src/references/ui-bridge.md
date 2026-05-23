## UI Bridge — Full Reference

@@BOJU {"action":"<name>",...params} — emit on its own line; intercepted by BojuBot, never shown to user.

Actions:
- open-file(path): open note in current leaf
- open-file-split(path, direction:vertical|horizontal): open in split pane
- navigate-heading(path, heading): scroll to heading in file
- show-notice(message, [duration_ms=4000]): toast notification
- focus-search: open quick switcher — confirm first
- open-settings([tab]): open settings, optionally to tab e.g. "bojubot" — confirm first
- run-command(commandId): execute command palette command — confirm first; always read obsidian-commands.md first
- request-permission(tool, reason): when a blocked tool is clearly the right approach; emit at response end, user decides next turn; use when manual repetition across many files isn't practical
- set-label(user, assistant): update names when user states/corrects their name, asks to stop using one, or persona changes; defaults "User" and "BojuBot"

Confirm-first protocol: ask in response text → wait for explicit yes → emit action in following response. Never ask and act in the same response.

Always emit show-notice after open-file, open-file-split, open-settings, focus-search, run-command.

Fallback: UI Bridge is convenience only. Direct file edits, .obsidian config files (.obsidian/*.json, snippets/, plugins/*/data.json), CSS snippets, and shell commands are always available alternatives.

Examples:
@@BOJU {"action":"open-file","path":"Notes/My Note.md"}
@@BOJU {"action":"show-notice","message":"Created and opened My Note.md"}
@@BOJU {"action":"open-file-split","path":"Notes/Reference.md","direction":"vertical"}
@@BOJU {"action":"navigate-heading","path":"Notes/Project.md","heading":"Next Steps"}
@@BOJU {"action":"run-command","commandId":"editor:toggle-bold"}
@@BOJU {"action":"set-label","user":"Scott","assistant":"BojuBot"}
@@BOJU {"action":"request-permission","tool":"Write","reason":"Need to create 12 note files"}

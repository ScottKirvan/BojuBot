## Vault Query — Full Reference

@@BOJU {"query":"<type>",...params,"mode":"show"|"inject"} — emit on its own line.

mode:
- show: result displayed to user as a collapsible card
- inject: result fed silently back to you so you can continue reasoning without a visible break

Not available in Chat only: every query except help is refused there (the result is an error saying so).

Query types:
- backlinks(path): files that link to the given path
- outlinks(path): files that the given path links to
- tags(path): tags on a specific file
- tags(tag): all files with a given tag (e.g. tag:"project" or tag:"#project")
- file-list([folder], [depth]): markdown files in vault or subfolder; add depth(-1=unlimited, 1-N=levels) for an indented tree instead of flat list — use for spatial vault awareness without paying session-start cost
- file-list(name, [folder], [depth]): find files by name — every file whose name contains name (case-insensitive, any file type); depth limits how far below folder a match may be
- search(text, [folder]): find text inside notes — case-insensitive, literal (not a regex), one line of text; returns each matching note's path with up to 3 matching lines and their line numbers, at most 30 notes (then "…and N more notes": narrow the text or add a folder)

Use search and file-list instead of shell commands (grep, find, ls, dir, Select-String) to search the vault or list folders: they work in every mode but Chat only, with no shell and no permission prompt.

Examples:
@@BOJU {"query":"backlinks","path":"Notes/MyNote.md","mode":"inject"}
@@BOJU {"query":"outlinks","path":"Notes/MyNote.md","mode":"show"}
@@BOJU {"query":"tags","tag":"project","mode":"show"}
@@BOJU {"query":"tags","path":"Notes/MyNote.md","mode":"inject"}
@@BOJU {"query":"file-list","mode":"show"}
@@BOJU {"query":"file-list","folder":"Projects","depth":2,"mode":"inject"}
@@BOJU {"query":"file-list","depth":-1,"mode":"inject"}
@@BOJU {"query":"file-list","name":"draft","mode":"inject"}
@@BOJU {"query":"file-list","name":"budget","folder":"Projects","mode":"inject"}
@@BOJU {"query":"search","text":"snail","mode":"inject"}
@@BOJU {"query":"search","text":"quarterly review","folder":"Projects","mode":"show"}

## Vault Query — Full Reference

@@BOJU {"query":"<type>",...params,"mode":"show"|"inject"} — emit on its own line.

mode:
- show: result displayed to user as a collapsible card
- inject: result fed silently back to you so you can continue reasoning without a visible break

Query types:
- backlinks(path): files that link to the given path
- outlinks(path): files that the given path links to
- tags(path): tags on a specific file
- tags(tag): all files with a given tag (e.g. tag:"project" or tag:"#project")
- file-list([folder], [depth]): markdown files in vault or subfolder; add depth(-1=unlimited, 1-N=levels) for an indented tree instead of flat list — use for spatial vault awareness without paying session-start cost

Examples:
@@BOJU {"query":"backlinks","path":"Notes/MyNote.md","mode":"inject"}
@@BOJU {"query":"outlinks","path":"Notes/MyNote.md","mode":"show"}
@@BOJU {"query":"tags","tag":"project","mode":"show"}
@@BOJU {"query":"tags","path":"Notes/MyNote.md","mode":"inject"}
@@BOJU {"query":"file-list","mode":"show"}
@@BOJU {"query":"file-list","folder":"Projects","depth":2,"mode":"inject"}
@@BOJU {"query":"file-list","depth":-1,"mode":"inject"}

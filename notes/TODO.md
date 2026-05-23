TODO
----
### Bugs
*(none open)*

### Features — near term
- [ ] #43 Session cost display: per-response token count line in chat + resume savings indicator (context gauge shipped; full display still open)
- [x] #47 UI Bridge: run-command action with allowlist (safe Obsidian command execution) ✅ 2026-03-26
- [x] Refresh session context command: re-inject context file + allowlist into active session mid-turn ✅ 2026-03-26
- [x] Session-scoped pins: add a 📌 pin button next to the × on pending context items so pinned items survive send and stay in the stack for every subsequent message (see #16)
- [x] Attachment button: open up the paperclip to add files, URLs, and other content to the context stack (currently stubbed/disabled)
- [ ] #19 Compaction detection and user notification (manual compact via gauge click shipped; auto-detection still open)
- [ ] #20 Configurable session storage location
- [ ] #22 Setting: re-inject context on every turn (not just session start)
- [ ] #10 Inline content generation (generate text at cursor in active note via tag/marker)
- [ ] #29 Image/PDF support (attach button handles files by path; inline paste/preview not yet supported)

### Features — blocked (architectural)
- [ ] #48 FrontmatterGuard: write protection and read exclusion (`readonly`, `context: never`) — blocked until Claude Code supports per-tool-call approval in print mode
- [ ] #42 Inline diff preview: word-level changes before Claude writes to an open note — same architectural constraint as #48

### Features — low priority / post-v1
- [ ] #23 Dataview / metadata graph awareness
- [ ] #24 Template integration (Templater/core Templates)
- [ ] #25 Git integration: convenience commands (git now works via Full access mode; pre-composed prompt commands still open)
- [ ] #26 Multi-context profiles: saved pin sets for different workflow modes
- [ ] #27 Slash commands: custom BojuBot commands from vault files
- [ ] #28 Canvas integration: read and generate Obsidian Canvas files
- [ ] #34 Pro-human AI declaration (docs)
- [ ] #36 Support Windows CMD install in setup panel (low demand; PowerShell required by spawn architecture)
- [ ] #41 Session export to vault: save conversation as a vault note

Done ✓
------
- [x] #40 @-mention file injection: attach vault notes as context by typing @ (pre-selects active note, non-md extension display, configurable file types) ✅ 2026-03-20
- [x] #18 Native permission dialog: Standard/Read-only/Full access modes, denial card, session override ✅ 2026-03-20
- [x] #17 Inline selection context: send highlighted editor text as context (pending context stack, multiple items, pin/remove) ✅ 2026-03-20
- [x] #39 Tool call visibility: tool events shown during response, collapsible on done ✅ 2026-03-20
- [x] #38 Session replay: vault context stripped from history display ✅ 2026-03-20
- [x] #32 UI Bridge: Claude can trigger Obsidian UI actions via @@BOJU_ACTION protocol ✅ 2026-03-20
- [x] #15 FrontmatterGuard context injection: bojubot-context: always + bojubot-instructions per-note frontmatter ✅ 2026-03-20
- [x] #16 Permanent pinning: bojubot-context: always injects full note at every session start ✅ 2026-03-20
- [x] Context gauge: SVG ring showing context window usage, click to compact ✅ 2026-03-20
- [x] Active note injection: currently open note path prepended to every message ✅ 2026-03-20
- [x] Logging settings: enable/disable, file path, verbosity, live reconfigure ✅ 2026-03-20
- [x] send-selection-to-bojubot, focus-bojubot-input, open-bojubot-context-file, show-bojubot-about commands ✅ 2026-03-20
- [x] #13 Login management: detect unauthenticated state, surface terminal login prompt ✅ 2026-03-19
- [x] #7  Improve "thinking" feedback — dynamic status label in assistant bubble ✅ 2026-03-17
- [x] #8  Up/down arrow to scroll through previous input messages ✅ 2026-03-17
- [x] #21 Vault context file auto-generation on first launch (modal + Claude-generated or blank) ✅ 2026-03-17
- [x] #30 Use Lucide icons for all app icons ✅ 2026-03-17
- [x] #4  Smart quote / special char bug breaks input stream ✅ 2026-03-17
- [x] #6  Copy/Export only copies text content, not full markdown ✅ 2026-03-17
- [x] #12 Add BojuBot Command: Open Settings ✅ 2026-03-17
- [x] #14 Ctrl+P command names out of date in USER_README.md ✅ 2026-03-17
- [x] #9  Replace "Ask Claude..." with "Ask BojuBot..." in input box ✅ 2026-03-12
- [x] #5  Renaming a session not seeing keyboard input ✅ 2026-03-09
- [x] Add standard plugin commands (New session, Clear session, Toggle panel, Session history, Export, Copy last) ✅ 2026-03-09
- [x] Session history: delete, search/filter, New Session button, named sessions ✅ 2026-03-09
- [x] Option B session architecture: --resume on session load only ✅ 2026-03-09
- [x] Configurable vault tree depth (0=off, 1-10 levels, -1=unlimited) ✅ 2026-03-17
- [x] release-please: package.json version bump on release ✅ 2026-03-17
- [x] release-please: build + zip artifact uploaded to GitHub release ✅ 2026-03-17
- [x] Icon buttons + bottom input toolbar (send, paperclip stub, slash stub) ✅ 2026-03-17
- [x] Help/About modal with logo, version, docs + Discord links ✅ 2026-03-17
- [x] Context file setup modal on first launch (generate with Claude / blank / skip) ✅ 2026-03-17
- [x] Fix Windows/Electron spawn: stdin-based prompt delivery (fixes smart-quote bugs) ✅ 2026-03-17
- [x] End-to-end working: chat, read files, write files, tool use
- [x] Markdown rendering in assistant messages
- [x] Session persistence (--resume) + session indicator
- [x] Context injection — vault tree + context file on new session start
- [x] Send on Enter setting; Shift+Enter for newline
- [x] Copy/paste working in chat panel
- [x] Thinking indicator while waiting for response

Not Gonna Do
------------
- ctrl-enter to send — gobbled up by system-level user setting, skip it

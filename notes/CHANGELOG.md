# Changelog

<!-- PENDING — add to next release-please PR manually:
  Bug Fixes:
  * @-mention dropdown now includes all vault file types by default (`*`); extensionless files
    (e.g. LICENSE) are now matchable via trailing comma; setting description updated.
    (buried in refactor commit a6aec10 — PR #205)
-->

## [3.3.0](https://github.com/ScottKirvan/BojuBot/compare/3.2.0...3.3.0) (2026-06-24)


### Features

* prime session — Shift+click + to pre-configure new session ([b6a3639](https://github.com/ScottKirvan/BojuBot/commit/b6a3639df804e700b94fd6d75727a2cf8c947e08))


### Bug Fixes

* inject CWD boundary instruction when session cwd differs from vault root ([b8c3ecc](https://github.com/ScottKirvan/BojuBot/commit/b8c3eccbef70aefa9df6cb2b4f6fba256b2d1d7e))

## [3.2.0](https://github.com/ScottKirvan/BojuBot/compare/3.1.4...3.2.0) (2026-05-26)


### Features

* add model switcher with toolbar indicator and /model command ([ebb89ba](https://github.com/ScottKirvan/BojuBot/commit/ebb89baaa47b058f9a6d8a50274d979230cea97b))

## [3.1.4](https://github.com/ScottKirvan/BojuBot/compare/3.1.3...3.1.4) (2026-05-24)


### Bug Fixes

* add attestations write permission for artifact attestation step ([5c53ad1](https://github.com/ScottKirvan/BojuBot/commit/5c53ad1dd6c57d3515ca538ce4b30105fb66cf0d))

## [3.1.3](https://github.com/ScottKirvan/BojuBot/compare/3.1.2...3.1.3) (2026-05-24)


### Bug Fixes

* add artifact attestations and remove zip from release assets ([fddf844](https://github.com/ScottKirvan/BojuBot/commit/fddf8447635db4c9fb6d7c415b9a1a95c6a28c93))

## [3.1.2](https://github.com/ScottKirvan/BojuBot/compare/3.1.1...3.1.2) (2026-05-24)


### Bug Fixes

* address Obsidian submission lint warnings ([514c5bd](https://github.com/ScottKirvan/BojuBot/commit/514c5bdde570b289934f3f31845582101b37e50c))

## [3.1.1](https://github.com/ScottKirvan/BojuBot/compare/3.1.0...3.1.1) (2026-05-24)


### Bug Fixes

* add minimal mode to eliminate session context injection overhead ([278dcd9](https://github.com/ScottKirvan/BojuBot/commit/278dcd90d9e3676384270b6e1a8376342e2bb8ec))
* add missing colons to CSS properties in custom.css ([618e145](https://github.com/ScottKirvan/BojuBot/commit/618e1451eb1c0220361869c443aa8c2fb44b929b))
* sentence-case lint error in memory cap placeholder ([68ab915](https://github.com/ScottKirvan/BojuBot/commit/68ab9150e2837113803310007c3cd2eb2a43ceb5))

## [3.1.0](https://github.com/ScottKirvan/BojuBot/compare/3.0.0...3.1.0) (2026-05-23)


### Features

* add configurable memory file size cap ([94c864c](https://github.com/ScottKirvan/BojuBot/commit/94c864c9ee3f04c551c4142f28c41afab31fe26a))

## [3.0.0](https://github.com/ScottKirvan/ObsidiBot/compare/2.16.1...3.0.0) (2026-05-23)


### ⚠ BREAKING CHANGES

* plugin folder and session storage path change from obsidibot/ to bojubot/. Existing sessions are migrated automatically on first load; plugin settings require a one-time manual copy (see notes/dev/session-migration-guide.md).

### Features

* add folder suggest dropdown to folder-path settings ([fb63cfa](https://github.com/ScottKirvan/ObsidiBot/commit/fb63cfa91bbea293dc0def0969aee770e6b774ee)), closes [#225](https://github.com/ScottKirvan/ObsidiBot/issues/225)


### Bug Fixes

* add depth param to file-list query for on-demand vault tree ([0d4a223](https://github.com/ScottKirvan/ObsidiBot/commit/0d4a223dd5c25c83faa0b52ea863c005e713070c))
* change vault tree depth default from 3 levels to off ([542a21a](https://github.com/ScottKirvan/ObsidiBot/commit/542a21ab07a4f8c12694fd85f0942baa965fd95f))
* extract orientation block into compiled markdown file ([a44da4b](https://github.com/ScottKirvan/ObsidiBot/commit/a44da4baacb70c8806c79605b1f1def49b51ed2d))
* remove internal protocol string from welcome screen tip ([dbda690](https://github.com/ScottKirvan/ObsidiBot/commit/dbda69026a57fc483e282b203fe4cce927c63f89)), closes [#231](https://github.com/ScottKirvan/ObsidiBot/issues/231)
* rename plugin from ObsidiBot to BojuBot ([b116d51](https://github.com/ScottKirvan/ObsidiBot/commit/b116d5179c5a7a772740160d4428f454c34df838))

## [2.16.1](https://github.com/ScottKirvan/BojuBot/compare/2.16.0...2.16.1) (2026-05-14)


### Bug Fixes

* greet by name when user has introduced themselves via conversation ([1cea903](https://github.com/ScottKirvan/BojuBot/commit/1cea903f571d920570ece766060a2d0d16240b77))
* remove OS username from welcome screen greeting ([9e47562](https://github.com/ScottKirvan/BojuBot/commit/9e47562da046d6eb97b75192e272240c120ad1f8)), closes [#221](https://github.com/ScottKirvan/BojuBot/issues/221)

## [2.16.0](https://github.com/ScottKirvan/BojuBot/compare/2.15.1...2.16.0) (2026-05-10)


### Features

* Claude Code skill format compatibility ([c8e2225](https://github.com/ScottKirvan/BojuBot/commit/c8e222538e6a089b75053f572584a38f74b746b8))
* permission picker popover + Ctrl+P command ([9a2af37](https://github.com/ScottKirvan/BojuBot/commit/9a2af37e2c6723e04d6bc5ee15b9da66ff115ab4))
* rename note param type to obsidianmd_note for Claude Code compatibility ([7a46703](https://github.com/ScottKirvan/BojuBot/commit/7a467030f6e61fc4eddd4eea86cab1d3ac179316))


### Bug Fixes

* default registerSkillsAsCommands to true ([75d19c1](https://github.com/ScottKirvan/BojuBot/commit/75d19c175c52d7215173c5151f41d82bdcc7e22a)), closes [#147](https://github.com/ScottKirvan/BojuBot/issues/147)
* permission popover background transparent when appended to document.body ([6ba66f4](https://github.com/ScottKirvan/BojuBot/commit/6ba66f4295033a073ea8e1fa39a2a14aebd8f4cb))

## [2.15.1](https://github.com/ScottKirvan/BojuBot/compare/2.15.0...2.15.1) (2026-05-09)


### Bug Fixes

* add unit tests for six code review gaps; extract extractActions to testable utility ([aa13159](https://github.com/ScottKirvan/BojuBot/commit/aa131595eaabb4eb6907c732e72f9241c346ec1d))
* remove unused vue dependency ([bfa6ee7](https://github.com/ScottKirvan/BojuBot/commit/bfa6ee754bf9571fc38747cdc41e6400ef1cdc71))
* surface stdin null as explicit error; document protocol freeze and design decisions ([26c860b](https://github.com/ScottKirvan/BojuBot/commit/26c860bf73f2062dfc6a30084352ab0377b2ad4b))

## [2.15.0](https://github.com/ScottKirvan/BojuBot/compare/2.14.1...2.15.0) (2026-05-09)


### Features

* extract SessionCoordinator from ClaudeView ([98bd6f8](https://github.com/ScottKirvan/BojuBot/commit/98bd6f831b5d00e7e2127cab484b39532cc25e7e))

## [2.14.1](https://github.com/ScottKirvan/BojuBot/compare/2.14.0...2.14.1) (2026-05-08)


### Bug Fixes

* @-mention dropdown now includes all vault file types by default (`*`); ([c2809ff](https://github.com/ScottKirvan/BojuBot/commit/c2809ff8984a4baa38329102c742863d4e4faf47))

## [2.14.0](https://github.com/ScottKirvan/BojuBot/compare/2.13.0...2.14.0) (2026-05-07)


### Features

* notify Claude of permission mode change via pending system message ([3a15066](https://github.com/ScottKirvan/BojuBot/commit/3a150662e52a6f5847a51aa68b05c5bfce719047))

## [2.13.0](https://github.com/ScottKirvan/BojuBot/compare/2.12.1...2.13.0) (2026-05-07)


### Features

* add restricted (Chat only) permission mode ([b947406](https://github.com/ScottKirvan/BojuBot/commit/b94740684502f58ff17f821ecd9a55bd48b8dbb9))
* replace queryConversationLabels with set-label action ([7928328](https://github.com/ScottKirvan/BojuBot/commit/79283286196df743be48b5ba9aa0cec2bf4f8807))


### Bug Fixes

* clear session permission override when settings change ([2365053](https://github.com/ScottKirvan/BojuBot/commit/236505360baa916268168825e84250863c7bf016))
* settings dropdown shows effective permission mode including session override ([9b44c7f](https://github.com/ScottKirvan/BojuBot/commit/9b44c7f6955f07c101b610fc2045215fa558b564))

## [2.12.1](https://github.com/ScottKirvan/BojuBot/compare/2.12.0...2.12.1) (2026-05-07)


### Bug Fixes

* correct lint violations from recent changes ([23d1682](https://github.com/ScottKirvan/BojuBot/commit/23d1682ce823de9620a90ccb842e7a538fa38fbf))
* correct lint violations from recent changes ([dc24a87](https://github.com/ScottKirvan/BojuBot/commit/dc24a87e9730d4c7eccca9cbe695c56a3af2245d))

## [2.12.0](https://github.com/ScottKirvan/BojuBot/compare/2.11.5...2.12.0) (2026-05-07)


### Features

* add configurable canvas size guard ([043bbcf](https://github.com/ScottKirvan/BojuBot/commit/043bbcf0dfe94868015f8d7c5802b10a987ca812))


### Bug Fixes

* escape special chars in bojubot-context tag attributes ([29fe23f](https://github.com/ScottKirvan/BojuBot/commit/29fe23ff36aa25c1e574746d87d0b735c42d60ca))
* make resolveShellEnv async to avoid blocking Obsidian at load ([2ab3e6c](https://github.com/ScottKirvan/BojuBot/commit/2ab3e6c3c6d19a58b5dabeb27893dd8bed649805))
* use env -0 to preserve multi-line environment variable values ([b310a5a](https://github.com/ScottKirvan/BojuBot/commit/b310a5a3f5a9f2a2f8fe13a57f7b4aab3850dc2b))
* use sparse sort order in saveSessionAtTop to avoid O(n) file writes ([188864e](https://github.com/ScottKirvan/BojuBot/commit/188864e19f3960f51059fb92322392f3b35a9320))

## [2.11.5](https://github.com/ScottKirvan/BojuBot/compare/2.11.4...2.11.5) (2026-05-04)


### Bug Fixes

* discord announce test - no change. ([1bfd13e](https://github.com/ScottKirvan/BojuBot/commit/1bfd13e45dbf1e17612f13d78b12526102d0f5b3))

## [2.11.0](https://github.com/ScottKirvan/BojuBot/compare/2.10.2...2.11.0) (2026-05-03)


### Features

* add always-visible permission mode icon to input toolbar ([56e0817](https://github.com/ScottKirvan/BojuBot/commit/56e08175f0a1d26cfdb8591af6b36f28fa714a61)), closes [#165](https://github.com/ScottKirvan/BojuBot/issues/165)
* detect and surface memory file modifications ([#166](https://github.com/ScottKirvan/BojuBot/issues/166)) ([f043199](https://github.com/ScottKirvan/BojuBot/commit/f0431990d906cd210c2c6e6d6a31b7facfff754c))


### Bug Fixes

* disable debug logging by default ([2791c86](https://github.com/ScottKirvan/BojuBot/commit/2791c86370543445b936d6ab1fc9a1ab7dbb3799))
* move permission icon to right of slash btn; fix icon colors ([1226206](https://github.com/ScottKirvan/BojuBot/commit/122620608b20942d8054f7fd1225294223d7606c))
* prefix permission icon tooltips with "Permissions: " ([7f1fe8e](https://github.com/ScottKirvan/BojuBot/commit/7f1fe8e9a3f5d97f686e7fd59a3b10cf8056c76a))
* raise input toolbar button opacity and pin permission icon to full ([6f045bb](https://github.com/ScottKirvan/BojuBot/commit/6f045bbdc14fb23b9910a01634a5baad95e5afe2))
* remove daily-notes from default command allowlist ([46847ea](https://github.com/ScottKirvan/BojuBot/commit/46847ea35d8ef4c482fb4ce5964292d8ece0a641))
* tighten trigger-prefix security instruction in orientation ([3cb3cfa](https://github.com/ScottKirvan/BojuBot/commit/3cb3cfa40fb49cc5c907608d7fe0c9cdfb9870e4))

## [2.10.2](https://github.com/ScottKirvan/BojuBot/compare/2.10.1...2.10.2) (2026-05-03)


### Bug Fixes

* neutralize @@BOJU_ trigger prefixes in vault-sourced content ([e4d8596](https://github.com/ScottKirvan/BojuBot/commit/e4d85961e0ee0c04bf27217a8d095116b89c3396))

## [2.10.1](https://github.com/ScottKirvan/BojuBot/compare/2.10.0...2.10.1) (2026-05-02)


### Bug Fixes

* correct sentence-case violations in setup card and tool output ([58e6191](https://github.com/ScottKirvan/BojuBot/commit/58e6191b138d075fa2ab9bab28d2110cd47a77cb))

## [2.10.0](https://github.com/ScottKirvan/BojuBot/compare/2.9.0...2.10.0) (2026-05-01)


### Features

* add recent sessions list to welcome screen ([4712bc9](https://github.com/ScottKirvan/BojuBot/commit/4712bc9f370891309defb9342e8a0ec36051e83c))
* redesign About modal to match Obsidian's layout ([f90f59b](https://github.com/ScottKirvan/BojuBot/commit/f90f59bfe25e365b1e6a1207a1f046be59f2ff69))

## [2.9.0](https://github.com/ScottKirvan/BojuBot/compare/2.8.0...2.9.0) (2026-05-01)


### Features

* welcome screen with sprite, greeting, and tip of the day ([e0064f9](https://github.com/ScottKirvan/BojuBot/commit/e0064f99ed874cc47fad97fe1f10d944d01aca26))


### Bug Fixes

* detect interrupted sessions via is_error on result message ([6566601](https://github.com/ScottKirvan/BojuBot/commit/6566601acbb4839b233b4387b29990296e157c7a))
* remove orphaned Thinking... indicator on process error ([2b8179c](https://github.com/ScottKirvan/BojuBot/commit/2b8179cd0776a21a21e581af3264fdb961105a30))
* show Interrupted message when process is killed mid-turn ([f7cf1a1](https://github.com/ScottKirvan/BojuBot/commit/f7cf1a184a74ffa92b8298d343a3d30343f697f3))

## [2.8.0](https://github.com/ScottKirvan/BojuBot/compare/2.7.8...2.8.0) (2026-04-21)


### Features

* mid-session permission requests via @@BOJU_ACTION ([e4491a8](https://github.com/ScottKirvan/BojuBot/commit/e4491a842fdc55d871ef7d4c92b249af1974c445))
* show tool call IN/OUT results inline and fix permission retry ([1dc9feb](https://github.com/ScottKirvan/BojuBot/commit/1dc9feb172a53340729dabab72841f907b2f9fdb))

## [2.7.8](https://github.com/ScottKirvan/BojuBot/compare/2.7.7...2.7.8) (2026-04-20)


### Bug Fixes

* address remaining Obsidian plugin submission lint requirements ([8f8c656](https://github.com/ScottKirvan/BojuBot/commit/8f8c656c2d2a41d65eba3b634d2d7ff1bd8a6977))

## [2.7.7](https://github.com/ScottKirvan/BojuBot/compare/2.7.6...2.7.7) (2026-04-19)


### Bug Fixes

* restore last-used session on reload and fix skill command registration ([43190fa](https://github.com/ScottKirvan/BojuBot/commit/43190fae35d812829f4dc944f942e5cf81c22531))

## [2.7.6](https://github.com/ScottKirvan/BojuBot/compare/2.7.5...2.7.6) (2026-04-19)


### Bug Fixes

* address Obsidian plugin submission lint requirements ([b0577e6](https://github.com/ScottKirvan/BojuBot/commit/b0577e6e6ad2a4cd995af0e0d2353babb4eedf75))

## [2.7.5](https://github.com/ScottKirvan/BojuBot/compare/2.7.4...2.7.5) (2026-04-15)


### Bug Fixes

* new manifest for Obsidian Plugin submission ([b47a3c5](https://github.com/ScottKirvan/BojuBot/commit/b47a3c5f6dac01e70dcc97e292289ac01e103448))

## [2.7.4](https://github.com/ScottKirvan/BojuBot/compare/2.7.3...2.7.4) (2026-04-15)


### Bug Fixes

* force release-please build ([ed31282](https://github.com/ScottKirvan/BojuBot/commit/ed31282d0db348db1332077a2fa6dc56d83a00c8))

## [2.7.3](https://github.com/ScottKirvan/BojuBot/compare/v2.7.2...2.7.3) (2026-04-15)


### Bug Fixes

* release-please tagging ([cef31af](https://github.com/ScottKirvan/BojuBot/commit/cef31af207acd019ad168a2dab6b0c592f28ebf5))

## [2.7.2](https://github.com/ScottKirvan/BojuBot/compare/v2.7.1...v2.7.2) (2026-04-15)


### Bug Fixes

* force release-please workflow ([9cec316](https://github.com/ScottKirvan/BojuBot/commit/9cec31609b35450cef36e76d178a550aade585e2))

## [2.7.1](https://github.com/ScottKirvan/BojuBot/compare/v2.7.0...v2.7.1) (2026-04-15)


### Bug Fixes

* version tag had a 'v' prefix - not allowed in an obsidian plugin. ([b05f64e](https://github.com/ScottKirvan/BojuBot/commit/b05f64ec0aba835b9e4d501ec0bc82e16565f00a))

## [2.7.0](https://github.com/ScottKirvan/BojuBot/compare/v2.6.1...v2.7.0) (2026-04-15)


### Features

* references to vault notes will now render as wililinks in claude responses ([89abd62](https://github.com/ScottKirvan/BojuBot/commit/89abd62e1820d073a1e93100130ff956a52c47f2))

## [2.6.1](https://github.com/ScottKirvan/BojuBot/compare/v2.6.0...v2.6.1) (2026-04-15)


### Bug Fixes

* internal links clickable + hard line breaks in chat renderer ([#115](https://github.com/ScottKirvan/BojuBot/issues/115), [#116](https://github.com/ScottKirvan/BojuBot/issues/116)) ([636d91f](https://github.com/ScottKirvan/BojuBot/commit/636d91fca1fe9dd884c2905011637e1f6de96834))

## [2.6.0](https://github.com/ScottKirvan/BojuBot/compare/v2.5.0...v2.6.0) (2026-04-14)


### Features

* context file — interview modal, multi-file picker, and datestamp ([983f898](https://github.com/ScottKirvan/BojuBot/commit/983f898b49f95e753b6fc84406715b62417e171d))
  * "Open context file" command now relaunches the setup dialog when the file is missing instead of showing a dead-end Notice
  * "Generate with Claude" opens a two-step interview modal: optional self-description textarea + multi-file picker (existing CLAUDE.md, project notes, style guides, etc.)
  * Selected files are passed to Claude as paths to read before generating — no size constraints, Claude uses its own file tools
  * Generated and blank template files both include a `_Last updated_` datestamp
  * Skills list injected into the generation prompt if any skills exist in the configured folder

## [2.5.0](https://github.com/ScottKirvan/BojuBot/compare/v2.4.0...v2.5.0) (2026-04-14)


### Features

* skills — parameterized slash commands with Ctrl+P API ([1536f9a](https://github.com/ScottKirvan/BojuBot/commit/1536f9a051554fc6cc2d3d1fb38a3a61953316f8))


### Bug Fixes

* docs: fix broken image in user documentation splash screen ([2468911](https://github.com/ScottKirvan/BojuBot/commit/2468911aba3ca549f02001b4ceded710ab51d26a))

## [2.4.0](https://github.com/ScottKirvan/BojuBot/compare/v2.3.0...v2.4.0) (2026-04-13)


### Features

* Canvas integration — read and generate .canvas files ([#28](https://github.com/ScottKirvan/BojuBot/issues/28)) ([cb7fda6](https://github.com/ScottKirvan/BojuBot/commit/cb7fda676af5b0e80949f0bd575d3e8272586ab0))
* slash command menu ([#27](https://github.com/ScottKirvan/BojuBot/issues/27)) ([8af1902](https://github.com/ScottKirvan/BojuBot/commit/8af1902c2fb5edb241849e00aed4b3c8cd92be32))
  * **Toolbar button mode:** opens with a search box; type to filter, arrow keys navigate, Enter executes, Escape closes
  * **Inline trigger mode:** type `/` preceded by a space (or at start of input) to open a compact menu; any non-navigation key dismisses and keeps the `/` as literal text
  * **Built-in commands:** New session, Show history, Export session, Attach file, Open context file, Refresh context, Open settings
  * **Prompt templates:** `.md` files in the configured commands folder appear automatically; optional YAML frontmatter (`category`, `description`) controls grouping and subtitle

## [2.3.0](https://github.com/ScottKirvan/BojuBot/compare/v2.2.1...v2.3.0) (2026-04-13)


### Features

* configurable session storage path ([#20](https://github.com/ScottKirvan/BojuBot/issues/20)) ([5f1171f](https://github.com/ScottKirvan/BojuBot/commit/5f1171f17a1a3babac1ed6ac71aa5de583eeca07))
* make vault query result file paths clickable internal links ([80de859](https://github.com/ScottKirvan/BojuBot/commit/80de85991b8aaf5b6d1f541c513de2952d5e3b6f)), closes [#84](https://github.com/ScottKirvan/BojuBot/issues/84)


### Bug Fixes

* add read hint to active-note context tag (Closes [#102](https://github.com/ScottKirvan/BojuBot/issues/102)) ([e3e9eeb](https://github.com/ScottKirvan/BojuBot/commit/e3e9eeb9a834ca25c405fdc35feb1d84241be707))
* include vault query results in active-session export to vault ([aa78d73](https://github.com/ScottKirvan/BojuBot/commit/aa78d735e6dff74d7cdc0bc61793503dba319809))
* inject CommonMark rendering rules into session orientation (Closes [#103](https://github.com/ScottKirvan/BojuBot/issues/103)) ([49454e7](https://github.com/ScottKirvan/BojuBot/commit/49454e7be5156b7a123c6c3dfa2fbcec610735ef))
* re-render vault query result cards on session replay ([36d4f30](https://github.com/ScottKirvan/BojuBot/commit/36d4f30c5f43dc50fd5416d06da5a821d82e035b))
* render query results as wikilinks in vault export ([ae1fcbc](https://github.com/ScottKirvan/BojuBot/commit/ae1fcbc17f62f78ede2229f34da675d24a8c2ef9))
* strip @@BOJU_QUERY lines from session replay and extractActions ([45d5bb9](https://github.com/ScottKirvan/BojuBot/commit/45d5bb9996dd0b7ecc5ba097ea2ada03a5afdcc1))
* fix @@BOJU_QUERY lines appearing verbatim in vault exports ([01df214](https://github.com/ScottKirvan/BojuBot/commit/01df214255b44a9f48cca57716b381bedeb22584))

## [2.2.1](https://github.com/ScottKirvan/BojuBot/compare/v2.2.0...v2.2.1) (2026-04-12)


### Bug Fixes

* use note callout color for active session indicator in session manager - closes [#85](https://github.com/ScottKirvan/BojuBot/issues/85) ([28cd76d](https://github.com/ScottKirvan/BojuBot/commit/28cd76d7792845d435ddb522d588ecab94791416))

## [2.2.0](https://github.com/ScottKirvan/BojuBot/compare/v2.1.0...v2.2.0) (2026-04-12)


### Features

* **export:** add "Open note after creation" checkbox to export modal ([8051aa9](https://github.com/ScottKirvan/BojuBot/commit/8051aa92322dad88b2dad03afcae6e18072363b3)), closes [#96](https://github.com/ScottKirvan/BojuBot/issues/96)
* **session:** fix replay fidelity — XML context tags + compaction filtering ([bb92ce9](https://github.com/ScottKirvan/BojuBot/commit/bb92ce90d423730187f60f737cc8c77e3024a912)), closes [#99](https://github.com/ScottKirvan/BojuBot/issues/99)
* **ui:** slide-in confirmation panel before session compression ([82ac437](https://github.com/ScottKirvan/BojuBot/commit/82ac437d65b54c38e29478fd1c2b7a7b4b982bad)), closes [#95](https://github.com/ScottKirvan/BojuBot/issues/95)


### Bug Fixes

* **export:** change open-after checkbox default to unchecked ([743bb9c](https://github.com/ScottKirvan/BojuBot/commit/743bb9cc5aa62c4222451b047205d037ab26e4ca))
* **session:** filter all &lt;local-command-*&gt; entries from replay ([c9d3fd9](https://github.com/ScottKirvan/BojuBot/commit/c9d3fd93f9b99ca5a6aadac4da1b6b68caf74548))
* **session:** fix blank white badge boxes in replayed user messages ([2e784f9](https://github.com/ScottKirvan/BojuBot/commit/2e784f9d4f6079fd8096cadeab7d671a21d6a910))
* **session:** only show badges for manually-added context on replay ([01d41f2](https://github.com/ScottKirvan/BojuBot/commit/01d41f2fdbb864313c278a21966fa1d545d73c08))
* **session:** show context badges in live bubble + fix image/pdf replay text ([d56e629](https://github.com/ScottKirvan/BojuBot/commit/d56e629f8c3cb9057e2c1499016d12cdca5c1e5c))
* **ui:** anchor compact confirm panel above input area ([0e0c0d0](https://github.com/ScottKirvan/BojuBot/commit/0e0c0d09a4d5df52a87997ec8ca9da39705aa532))

## [2.1.0](https://github.com/ScottKirvan/BojuBot/compare/v2.0.0...v2.1.0) (2026-04-09)


### Features

* **ui:** add export-to-vault button to chat panel toolbar ([03913f1](https://github.com/ScottKirvan/BojuBot/commit/03913f1542ef537dcf9a19b69b8afb9a6f9b5281))


### Bug Fixes

* The project rename broke legacy sessions - fixed. ([2061c91](https://github.com/ScottKirvan/BojuBot/commit/2061c914d3c18579f895d7462fb82c4fc782d443))

## [2.0.0](https://github.com/ScottKirvan/BojuBot/compare/v1.5.4...v2.0.0) (2026-04-09)


### ⚠ BREAKING CHANGES

* API BREAKING CHANGE: Rename project and all APIs

### Features

* API BREAKING CHANGE: Rename project and all APIs ([4748f72](https://github.com/ScottKirvan/BojuBot/commit/4748f722fc3167e711f49197c2495c2db6a2546a))

## [1.5.4](https://github.com/ScottKirvan/BojuBot/compare/v1.5.3...v1.5.4) (2026-03-31)


### Bug Fixes

* **ui:** restore status indicator during tool calls after text has streamed ([0c97521](https://github.com/ScottKirvan/BojuBot/commit/0c975219985fe383c9fc5c8148496ff1d3e9e61d)), closes [#67](https://github.com/ScottKirvan/BojuBot/issues/67)

## [1.5.3](https://github.com/ScottKirvan/BojuBot/compare/v1.5.2...v1.5.3) (2026-03-31)


### Bug Fixes

* strip @@BOJU_ACTION lines when replaying session history ([aaef64c](https://github.com/ScottKirvan/BojuBot/commit/aaef64cc77b2c99361ec2d91f206860c8e9c5753)), closes [#83](https://github.com/ScottKirvan/BojuBot/issues/83)
* **ui:** prevent ArrowDown from blocking cursor movement in recalled multiline messages ([8775c9e](https://github.com/ScottKirvan/BojuBot/commit/8775c9e55e30f6cebc75c08414501edc0249f554)), closes [#82](https://github.com/ScottKirvan/BojuBot/issues/82)

## [1.5.2](https://github.com/ScottKirvan/BojuBot/compare/v1.5.1...v1.5.2) (2026-03-29)


### Bug Fixes

* update icon in the right sidebar - TODO: move this to a variable. ([6c84dfb](https://github.com/ScottKirvan/BojuBot/commit/6c84dfbfb1eff6eab9307b6fb1959a10b0a674c7))

## [1.5.1](https://github.com/ScottKirvan/BojuBot/compare/v1.5.0...v1.5.1) (2026-03-29)


### Bug Fixes

* **ui:** add visual separation between sequential tool call events ([0bd9be6](https://github.com/ScottKirvan/BojuBot/commit/0bd9be6933f7841f04899ed6e7a0cc51bdc67fba)), closes [#68](https://github.com/ScottKirvan/BojuBot/issues/68)
* **ui:** suppress misleading Interrupted message on clean UI-bridge-only turns ([3ba0e68](https://github.com/ScottKirvan/BojuBot/commit/3ba0e68ec94dbd44303429afde448d44092397b3)), closes [#76](https://github.com/ScottKirvan/BojuBot/issues/76)

## [1.5.0](https://github.com/ScottKirvan/BojuBot/compare/v1.4.3...v1.5.0) (2026-03-29)


### Features

* vault query protocol — Claude can query live vault state ([#58](https://github.com/ScottKirvan/BojuBot/issues/58)) ([98dad7e](https://github.com/ScottKirvan/BojuBot/commit/98dad7eb08c4c41f39c426a1de27f5d7c3eb2c65))

## [1.4.3](https://github.com/ScottKirvan/BojuBot/compare/v1.4.2...v1.4.3) (2026-03-29)


### Bug Fixes

* correct stale log path comment in LoggerConfig ([d19b6db](https://github.com/ScottKirvan/BojuBot/commit/d19b6db040a96ef0f2de1753cb51d08473bf16ec))

## [1.4.2](https://github.com/ScottKirvan/BojuBot/compare/v1.4.1...v1.4.2) (2026-03-29)


### Bug Fixes

* refreshSessionContext now re-injects full orientation ([#69](https://github.com/ScottKirvan/BojuBot/issues/69)) ([ce70f88](https://github.com/ScottKirvan/BojuBot/commit/ce70f88858b9ed633cfc307ad529cdd50b914a19))

## [1.4.1](https://github.com/ScottKirvan/BojuBot/compare/v1.4.0...v1.4.1) (2026-03-29)


### Bug Fixes

* bug [#57](https://github.com/ScottKirvan/BojuBot/issues/57): code blocks in assistant messages render as copy icon only ([b7d8069](https://github.com/ScottKirvan/BojuBot/commit/b7d80691a02d9b32b1384f7319272b1f9dd5f0ec))
* bug [#63](https://github.com/ScottKirvan/BojuBot/issues/63):  restore last active session on startup instead of top-of-stack ([7e8e53c](https://github.com/ScottKirvan/BojuBot/commit/7e8e53ccd0d51aee7ba1abf7d552fc5113f4727d))
* correct release asset upload and project date-closed workflow ([e6728a3](https://github.com/ScottKirvan/BojuBot/commit/e6728a39d7d5520cffec4daf916270d1e5310390))
* correct release asset upload and project token for workflows ([7cca123](https://github.com/ScottKirvan/BojuBot/commit/7cca1233bd06e4c68dfd6cb1afe94c89d9b935f6))

## [1.4.0](https://github.com/ScottKirvan/BojuBot/compare/v1.3.0...v1.4.0) (2026-03-28)


### Features

* image and PDF support — attach via file picker, paste, or drag-and-drop ([1efcb5c](https://github.com/ScottKirvan/BojuBot/commit/1efcb5ca1bb00a2c89e0cdd1d214f41a4579f87b))
* image/PDF attachments, drag-and-drop, export session to vault, transcript format ([48feb43](https://github.com/ScottKirvan/BojuBot/commit/48feb4378575f853d09c0621b49a2fb0a880ebbf))
* show per-turn token usage stats below each response ([#43](https://github.com/ScottKirvan/BojuBot/issues/43)) ([d478504](https://github.com/ScottKirvan/BojuBot/commit/d4785040b6f6091c55c6c6a4fd62f2e975654a87))


### Bug Fixes

* copy/paste of screenshots wasn't using unique names, so multiple screenshots were overwriting each other ([5b825b6](https://github.com/ScottKirvan/BojuBot/commit/5b825b65dc58c5fdf7e320b2b3ca15da7d449518))
* expanding the name change search - it was pretty easy to miss it before. ([2620880](https://github.com/ScottKirvan/BojuBot/commit/262088024ddb2df376bf435c4d278aac4e0aab1f))

## [1.3.0](https://github.com/ScottKirvan/BojuBot/compare/v1.2.0...v1.3.0) (2026-03-27)


### Features

* drag-and-drop session manager sorting ([61afdf2](https://github.com/ScottKirvan/BojuBot/commit/61afdf2e5de0e8753cee7b78238b981e64d8aed4))
* new command: "BojuBot: Refresh Session" ([b45e2a9](https://github.com/ScottKirvan/BojuBot/commit/b45e2a9b615e696060f7deea3cff06930c76fa54))
* run-command discovery, UI polish, and bug fixes ([b6821dd](https://github.com/ScottKirvan/BojuBot/commit/b6821ddbea5dda91615ce4e61f70bfc174e91020))
* session manager now shows which session is active ([06cce74](https://github.com/ScottKirvan/BojuBot/commit/06cce747e71acb71aeadbaf7efe81e3e0620f031))
* UI Bridge run-command action with settings command browser ([#47](https://github.com/ScottKirvan/BojuBot/issues/47)) ([2121ddc](https://github.com/ScottKirvan/BojuBot/commit/2121ddc2939bc2c7c354a62fb847d8bea6cc15c6))


### Bug Fixes

* renaming a session in the session manager changes the name in the chat panel immediately now ([1740193](https://github.com/ScottKirvan/BojuBot/commit/1740193113daf65b3f5f2d6a3f271ebcffb5b986))
* session duplication after Obsidian restart ([6c2b889](https://github.com/ScottKirvan/BojuBot/commit/6c2b8890326c811c8f4a347afc06f6ed78c96403))

## [1.2.0](https://github.com/ScottKirvan/BojuBot/compare/v1.1.0...v1.2.0) (2026-03-20)


### Features

* multiple notes support ([98e8e10](https://github.com/ScottKirvan/BojuBot/commit/98e8e104132af1daaba5976f88dfe43f44388634))
* split-pane and side-by-side note editing support - configurable ([a280e42](https://github.com/ScottKirvan/BojuBot/commit/a280e42f9b118f515f82bcd1cd33811f016a93c1))


### Bug Fixes

* regression fix for bojubot giving up on being inventive when needed. ([b126eef](https://github.com/ScottKirvan/BojuBot/commit/b126eef54cfcac757cba51050c2bb1c6e550008d))

## [1.1.0](https://github.com/ScottKirvan/BojuBot/compare/v1.0.0...v1.1.0) (2026-03-20)


### Features

* Attachment button: open up the paperclip to add files, URLs, and other content to the context stack ([d644f89](https://github.com/ScottKirvan/BojuBot/commit/d644f892381c6b8c2956df3f2a5bcd1db22b7b05))
* current note is pre-selected in @ mention context injection & additional file types (pdf, fountain - configurable) are now supported ([a107623](https://github.com/ScottKirvan/BojuBot/commit/a10762312bda06474977309e1e9a832f8ad1832f))
* frontmatter context injection and active note awareness ([#15](https://github.com/ScottKirvan/BojuBot/issues/15)) ([c12aeea](https://github.com/ScottKirvan/BojuBot/commit/c12aeea19d392eb40a64651883b559f7bd963e77))
* logginpg settings, verbosity settings, start/stop, file location, etc. ([169084e](https://github.com/ScottKirvan/BojuBot/commit/169084e59f88b8ebe321e2c91f3c9b91a57b2d42))
* session context gas gauge added - warns about auto compaction ([6efa27b](https://github.com/ScottKirvan/BojuBot/commit/6efa27b87c5fbc5268cae310692ad8b17688c2e0))
* Session-scoped pins: add a 📌 pin button next to the × on pending context items so pinned items survive send and stay in the stack for every subsequent message (see [#16](https://github.com/ScottKirvan/BojuBot/issues/16)) ([83503c4](https://github.com/ScottKirvan/BojuBot/commit/83503c4afd78b4e0224813ff71fe47b896ce8c8e))
* when using the @ mention context injection, pre-select the current note ([4b4775a](https://github.com/ScottKirvan/BojuBot/commit/4b4775a6c2e4ffee764101c1cf9d7fa3635d6015))

## [1.0.0](https://github.com/ScottKirvan/BojuBot/compare/v0.6.0...v1.0.0) (2026-03-20)


### ⚠ BREAKING CHANGES

* default permission mode is now 'standard' (acceptEdits). Users who relied on unrestricted Bash access should set Permission Mode to "Full access" in settings.

### Features

* [#40](https://github.com/ScottKirvan/BojuBot/issues/40) using @ to inject full notes as context ([75f8cf0](https://github.com/ScottKirvan/BojuBot/commit/75f8cf025ec9806913520e3c0b1a9777f70288c2))
* native permission modes, replace --dangerously-skip-permissions ([#18](https://github.com/ScottKirvan/BojuBot/issues/18)) ([3c41827](https://github.com/ScottKirvan/BojuBot/commit/3c4182799d683a1025ab74e72a0e0db0efde82ab))
* tool call visibility, selection context injection, session replay fix ([#38](https://github.com/ScottKirvan/BojuBot/issues/38), [#39](https://github.com/ScottKirvan/BojuBot/issues/39), [#17](https://github.com/ScottKirvan/BojuBot/issues/17)) ([61d91ef](https://github.com/ScottKirvan/BojuBot/commit/61d91ef629d8e0f57ce4ac11bfe0723966a5099a))


### Bug Fixes

* fixes to tool use messages and selected text context injection ([54a2384](https://github.com/ScottKirvan/BojuBot/commit/54a2384bb4e90fd749dc80d646f2027cb97904e4))

## [0.6.0](https://github.com/ScottKirvan/BojuBot/compare/v0.5.0...v0.6.0) (2026-03-18)


### Features

* add Focus input, Open context file, and About commands ([3dcd5c1](https://github.com/ScottKirvan/BojuBot/commit/3dcd5c1f36d8a6bee909b30e6aa8edc249038b56))
* gracefully handle and walk the user through setting up a broken claude CLI setup ([c507df8](https://github.com/ScottKirvan/BojuBot/commit/c507df806d4f18e1c999ab949e3b27a4c1cca880))


### Bug Fixes

* better, but not great, handling of logged-out users ([19102b9](https://github.com/ScottKirvan/BojuBot/commit/19102b91a14869d6d3fc87a11ab3ed5ecf62f536))
* move session history out of the plugin folder to fix symlink dev conflicts ([bcc42f2](https://github.com/ScottKirvan/BojuBot/commit/bcc42f2f062ea4c844b114a4382b246b41c1f873))
* session focus/renaming issues ([b40c069](https://github.com/ScottKirvan/BojuBot/commit/b40c069c097c22102c8ab1246265a53c32eabcb4))

## [0.5.0](https://github.com/ScottKirvan/BojuBot/compare/v0.4.0...v0.5.0) (2026-03-18)


### Features

* BRAT/publication compatible build ([ba0229a](https://github.com/ScottKirvan/BojuBot/commit/ba0229a1a6389989bf49a4381204b98dbd1d1041))

## [0.4.0](https://github.com/ScottKirvan/BojuBot/compare/v0.3.1...v0.4.0) (2026-03-17)


### Features

* added an interrupt/stop button for interrupting long or unwanted tasks. ([3df5318](https://github.com/ScottKirvan/BojuBot/commit/3df5318f6cdbfeb840832a66d03c0bc705ac7107))
* UI Bridge: allow Claude to trigger Obsidian UI actions [#32](https://github.com/ScottKirvan/BojuBot/issues/32) - automatically open notes, focus on a section, etc. ([e16af56](https://github.com/ScottKirvan/BojuBot/commit/e16af56b0242fee5247efcae02a3a6755e8f6c15))

## [0.3.1](https://github.com/ScottKirvan/BojuBot/compare/v0.3.0...v0.3.1) (2026-03-17)


### Bug Fixes

* add layer 0 context to give the agent some "you are here" context ([0bb37af](https://github.com/ScottKirvan/BojuBot/commit/0bb37afb9dd96487174aab163ad5ef2521363607))

## [0.3.0](https://github.com/ScottKirvan/BojuBot/compare/v0.2.1...v0.3.0) (2026-03-17)


### Features

* [#21](https://github.com/ScottKirvan/BojuBot/issues/21) Vault context file auto-generation on first launch ([7329009](https://github.com/ScottKirvan/BojuBot/commit/7329009f76998e218b7f95cac516bc5c987246ad))
* [#7](https://github.com/ScottKirvan/BojuBot/issues/7)  Improve "thinking" feedback (better spinner/status while waiting) ([b15790f](https://github.com/ScottKirvan/BojuBot/commit/b15790fbe824f313d5236d9cc5c7bf93abc81f6a))
* [#8](https://github.com/ScottKirvan/BojuBot/issues/8)  Up/down arrow to scroll through previous input messages ([92d198b](https://github.com/ScottKirvan/BojuBot/commit/92d198b4c6c2343927785043e69fce7525483ad4))
* added vault tree (context) depth settings ([5248300](https://github.com/ScottKirvan/BojuBot/commit/5248300b9aa0bb1ca319dd0ef92edfebd48ae9cb))
* UI updates - new icons, access to online help, discord, settings, etc, from the chat panel ([6b988fb](https://github.com/ScottKirvan/BojuBot/commit/6b988fb0b37fdd6bd9d847e89eef3ab045db9c53))


### Bug Fixes

* bug[#4](https://github.com/ScottKirvan/BojuBot/issues/4) add unicode curly quotes support (smart-quoted text) ([c27e89d](https://github.com/ScottKirvan/BojuBot/commit/c27e89dd956a26012553f952abcdf48519de2a0a))
* bug[#6](https://github.com/ScottKirvan/BojuBot/issues/6) Include markdown in command-copied data from the chat-panel (plus a file size refactor) ([c3af74b](https://github.com/ScottKirvan/BojuBot/commit/c3af74b25acf89d4dc41fdc359170ec74496825e))
* release-please version updating support for package.json ([c42fb94](https://github.com/ScottKirvan/BojuBot/commit/c42fb944ef6be9369aa5f5f2198bc7e361936b60))
* replace the phrase, "Ask Claude..." with "Ask BojuBot..." ([0000322](https://github.com/ScottKirvan/BojuBot/commit/00003225043d7f1b17cd7b3f18231acd454ebbfb))
* text parsing of doublequotes - included unit test ([96c5b52](https://github.com/ScottKirvan/BojuBot/commit/96c5b52240152fcb93489584c6406092297cc87d))

## [0.2.1](https://github.com/ScottKirvan/BojuBot/compare/v0.2.0...v0.2.1) (2026-03-10)


### Bug Fixes

* test checkin - ignore ([b199bef](https://github.com/ScottKirvan/BojuBot/commit/b199bef8f1757560d85d3f6bbd2ada60813df480))

## [0.2.0](https://github.com/ScottKirvan/BojuBot/compare/v0.1.0...v0.2.0) (2026-03-10)


### Features

* Markdown rendering of responses in the panel ([5856475](https://github.com/ScottKirvan/BojuBot/commit/5856475a3b620237b91242737b42181681978f69))
* plugin bootstrapped - beginning testing/debugging of basic systems ([5c4d024](https://github.com/ScottKirvan/BojuBot/commit/5c4d024cc87cef6cf792f087e348f51d72db36ca))
* send-on-enter option added to settings and functionality.  Plus, lots of visual cleanup - looking sexy ([b9acdf8](https://github.com/ScottKirvan/BojuBot/commit/b9acdf831532eb676dbdabcf94cb36d19d6f52b5))
* session history UI, command palette, UI polish, and token logging ([c37d65a](https://github.com/ScottKirvan/BojuBot/commit/c37d65ac79e02d4347fb2a737e12d4d2d36d9a11))
* session, context, and memory management ([16d288b](https://github.com/ScottKirvan/BojuBot/commit/16d288bc1b0dbcb8d47d243fe93bb07768d16f9c))
* support built-in, configurable context: _claude-context.md ([66f777a](https://github.com/ScottKirvan/BojuBot/commit/66f777ac7df88cb4d0bb34b3f1f478fb7af3ee31))


### Bug Fixes

* added session persistence - claude will remember your name now ([dd76ab9](https://github.com/ScottKirvan/BojuBot/commit/dd76ab96e533b12c9331fbbfc753e8c2b17f459b))
* adding the code workspace to the project ([78f9d16](https://github.com/ScottKirvan/BojuBot/commit/78f9d16acfa4e3dbd4e1430ef00435c831c560c5))
* claude initialization ([7759e80](https://github.com/ScottKirvan/BojuBot/commit/7759e8090705f88c00f2cc5a1b6853557ae2d543))
* cleanup verbose logging ([4c691ba](https://github.com/ScottKirvan/BojuBot/commit/4c691ba8969713c907bd418bef32085aa4ed9a39))
* copy/paste working ([8cdd637](https://github.com/ScottKirvan/BojuBot/commit/8cdd637bcf489c6ffba98040fd4691dd5d865a07))
* first working version - read/write files in the vault ([b635aa9](https://github.com/ScottKirvan/BojuBot/commit/b635aa9ee707a5cde8614c92ea42bbc33d2699f9))
* multiline input text now displays correctly in the chat panel ([2f0b5ad](https://github.com/ScottKirvan/BojuBot/commit/2f0b5adc280ad6466b3022145b456d7ff8550917))
* remove obsidian data files from the repo - oops ([32020e9](https://github.com/ScottKirvan/BojuBot/commit/32020e96cf48784feac119ad31d599da2289e6b7))
* sendOnEnter defaults to true now. Added a css box around the user message in the chat panel. ([ed2eb6b](https://github.com/ScottKirvan/BojuBot/commit/ed2eb6be9bfff52ad4ba20f899c022299c158224))


>[!NOTE]
> This file and it's version format is automatically 
> generated by [Please-Release](https://github.com/googleapis/release-please-action), 
> and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

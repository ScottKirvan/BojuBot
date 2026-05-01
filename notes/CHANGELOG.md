# Changelog

## [2.9.0](https://github.com/ScottKirvan/ObsidiBot/compare/2.8.0...2.9.0) (2026-05-01)


### Features

* welcome screen with sprite, greeting, and tip of the day ([e0064f9](https://github.com/ScottKirvan/ObsidiBot/commit/e0064f99ed874cc47fad97fe1f10d944d01aca26))


### Bug Fixes

* detect interrupted sessions via is_error on result message ([6566601](https://github.com/ScottKirvan/ObsidiBot/commit/6566601acbb4839b233b4387b29990296e157c7a))
* remove orphaned Thinking... indicator on process error ([2b8179c](https://github.com/ScottKirvan/ObsidiBot/commit/2b8179cd0776a21a21e581af3264fdb961105a30))
* show Interrupted message when process is killed mid-turn ([f7cf1a1](https://github.com/ScottKirvan/ObsidiBot/commit/f7cf1a184a74ffa92b8298d343a3d30343f697f3))

## [2.8.0](https://github.com/ScottKirvan/ObsidiBot/compare/2.7.8...2.8.0) (2026-04-21)


### Features

* mid-session permission requests via @@CORTEX_ACTION ([e4491a8](https://github.com/ScottKirvan/ObsidiBot/commit/e4491a842fdc55d871ef7d4c92b249af1974c445))
* show tool call IN/OUT results inline and fix permission retry ([1dc9feb](https://github.com/ScottKirvan/ObsidiBot/commit/1dc9feb172a53340729dabab72841f907b2f9fdb))

## [2.7.8](https://github.com/ScottKirvan/ObsidiBot/compare/2.7.7...2.7.8) (2026-04-20)


### Bug Fixes

* address remaining Obsidian plugin submission lint requirements ([8f8c656](https://github.com/ScottKirvan/ObsidiBot/commit/8f8c656c2d2a41d65eba3b634d2d7ff1bd8a6977))

## [2.7.7](https://github.com/ScottKirvan/ObsidiBot/compare/2.7.6...2.7.7) (2026-04-19)


### Bug Fixes

* restore last-used session on reload and fix skill command registration ([43190fa](https://github.com/ScottKirvan/ObsidiBot/commit/43190fae35d812829f4dc944f942e5cf81c22531))

## [2.7.6](https://github.com/ScottKirvan/ObsidiBot/compare/2.7.5...2.7.6) (2026-04-19)


### Bug Fixes

* address Obsidian plugin submission lint requirements ([b0577e6](https://github.com/ScottKirvan/ObsidiBot/commit/b0577e6e6ad2a4cd995af0e0d2353babb4eedf75))

## [2.7.5](https://github.com/ScottKirvan/ObsidiBot/compare/2.7.4...2.7.5) (2026-04-15)


### Bug Fixes

* new manifest for Obsidian Plugin submission ([b47a3c5](https://github.com/ScottKirvan/ObsidiBot/commit/b47a3c5f6dac01e70dcc97e292289ac01e103448))

## [2.7.4](https://github.com/ScottKirvan/ObsidiBot/compare/2.7.3...2.7.4) (2026-04-15)


### Bug Fixes

* force release-please build ([ed31282](https://github.com/ScottKirvan/ObsidiBot/commit/ed31282d0db348db1332077a2fa6dc56d83a00c8))

## [2.7.3](https://github.com/ScottKirvan/ObsidiBot/compare/v2.7.2...2.7.3) (2026-04-15)


### Bug Fixes

* release-please tagging ([cef31af](https://github.com/ScottKirvan/ObsidiBot/commit/cef31af207acd019ad168a2dab6b0c592f28ebf5))

## [2.7.2](https://github.com/ScottKirvan/ObsidiBot/compare/v2.7.1...v2.7.2) (2026-04-15)


### Bug Fixes

* force release-please workflow ([9cec316](https://github.com/ScottKirvan/ObsidiBot/commit/9cec31609b35450cef36e76d178a550aade585e2))

## [2.7.1](https://github.com/ScottKirvan/ObsidiBot/compare/v2.7.0...v2.7.1) (2026-04-15)


### Bug Fixes

* version tag had a 'v' prefix - not allowed in an obsidian plugin. ([b05f64e](https://github.com/ScottKirvan/ObsidiBot/commit/b05f64ec0aba835b9e4d501ec0bc82e16565f00a))

## [2.7.0](https://github.com/ScottKirvan/ObsidiBot/compare/v2.6.1...v2.7.0) (2026-04-15)


### Features

* references to vault notes will now render as wililinks in claude responses ([89abd62](https://github.com/ScottKirvan/ObsidiBot/commit/89abd62e1820d073a1e93100130ff956a52c47f2))

## [2.6.1](https://github.com/ScottKirvan/ObsidiBot/compare/v2.6.0...v2.6.1) (2026-04-15)


### Bug Fixes

* internal links clickable + hard line breaks in chat renderer ([#115](https://github.com/ScottKirvan/ObsidiBot/issues/115), [#116](https://github.com/ScottKirvan/ObsidiBot/issues/116)) ([636d91f](https://github.com/ScottKirvan/ObsidiBot/commit/636d91fca1fe9dd884c2905011637e1f6de96834))

## [2.6.0](https://github.com/ScottKirvan/ObsidiBot/compare/v2.5.0...v2.6.0) (2026-04-14)


### Features

* context file — interview modal, multi-file picker, and datestamp ([983f898](https://github.com/ScottKirvan/ObsidiBot/commit/983f898b49f95e753b6fc84406715b62417e171d))
  * "Open context file" command now relaunches the setup dialog when the file is missing instead of showing a dead-end Notice
  * "Generate with Claude" opens a two-step interview modal: optional self-description textarea + multi-file picker (existing CLAUDE.md, project notes, style guides, etc.)
  * Selected files are passed to Claude as paths to read before generating — no size constraints, Claude uses its own file tools
  * Generated and blank template files both include a `_Last updated_` datestamp
  * Skills list injected into the generation prompt if any skills exist in the configured folder

## [2.5.0](https://github.com/ScottKirvan/ObsidiBot/compare/v2.4.0...v2.5.0) (2026-04-14)


### Features

* skills — parameterized slash commands with Ctrl+P API ([1536f9a](https://github.com/ScottKirvan/ObsidiBot/commit/1536f9a051554fc6cc2d3d1fb38a3a61953316f8))


### Bug Fixes

* docs: fix broken image in user documentation splash screen ([2468911](https://github.com/ScottKirvan/ObsidiBot/commit/2468911aba3ca549f02001b4ceded710ab51d26a))

## [2.4.0](https://github.com/ScottKirvan/ObsidiBot/compare/v2.3.0...v2.4.0) (2026-04-13)


### Features

* Canvas integration — read and generate .canvas files ([#28](https://github.com/ScottKirvan/ObsidiBot/issues/28)) ([cb7fda6](https://github.com/ScottKirvan/ObsidiBot/commit/cb7fda676af5b0e80949f0bd575d3e8272586ab0))
* slash command menu ([#27](https://github.com/ScottKirvan/ObsidiBot/issues/27)) ([8af1902](https://github.com/ScottKirvan/ObsidiBot/commit/8af1902c2fb5edb241849e00aed4b3c8cd92be32))
  * **Toolbar button mode:** opens with a search box; type to filter, arrow keys navigate, Enter executes, Escape closes
  * **Inline trigger mode:** type `/` preceded by a space (or at start of input) to open a compact menu; any non-navigation key dismisses and keeps the `/` as literal text
  * **Built-in commands:** New session, Show history, Export session, Attach file, Open context file, Refresh context, Open settings
  * **Prompt templates:** `.md` files in the configured commands folder appear automatically; optional YAML frontmatter (`category`, `description`) controls grouping and subtitle

## [2.3.0](https://github.com/ScottKirvan/ObsidiBot/compare/v2.2.1...v2.3.0) (2026-04-13)


### Features

* configurable session storage path ([#20](https://github.com/ScottKirvan/ObsidiBot/issues/20)) ([5f1171f](https://github.com/ScottKirvan/ObsidiBot/commit/5f1171f17a1a3babac1ed6ac71aa5de583eeca07))
* make vault query result file paths clickable internal links ([80de859](https://github.com/ScottKirvan/ObsidiBot/commit/80de85991b8aaf5b6d1f541c513de2952d5e3b6f)), closes [#84](https://github.com/ScottKirvan/ObsidiBot/issues/84)


### Bug Fixes

* add read hint to active-note context tag (Closes [#102](https://github.com/ScottKirvan/ObsidiBot/issues/102)) ([e3e9eeb](https://github.com/ScottKirvan/ObsidiBot/commit/e3e9eeb9a834ca25c405fdc35feb1d84241be707))
* include vault query results in active-session export to vault ([aa78d73](https://github.com/ScottKirvan/ObsidiBot/commit/aa78d735e6dff74d7cdc0bc61793503dba319809))
* inject CommonMark rendering rules into session orientation (Closes [#103](https://github.com/ScottKirvan/ObsidiBot/issues/103)) ([49454e7](https://github.com/ScottKirvan/ObsidiBot/commit/49454e7be5156b7a123c6c3dfa2fbcec610735ef))
* re-render vault query result cards on session replay ([36d4f30](https://github.com/ScottKirvan/ObsidiBot/commit/36d4f30c5f43dc50fd5416d06da5a821d82e035b))
* render query results as wikilinks in vault export ([ae1fcbc](https://github.com/ScottKirvan/ObsidiBot/commit/ae1fcbc17f62f78ede2229f34da675d24a8c2ef9))
* strip @@CORTEX_QUERY lines from session replay and extractActions ([45d5bb9](https://github.com/ScottKirvan/ObsidiBot/commit/45d5bb9996dd0b7ecc5ba097ea2ada03a5afdcc1))
* fix @@CORTEX_QUERY lines appearing verbatim in vault exports ([01df214](https://github.com/ScottKirvan/ObsidiBot/commit/01df214255b44a9f48cca57716b381bedeb22584))

## [2.2.1](https://github.com/ScottKirvan/ObsidiBot/compare/v2.2.0...v2.2.1) (2026-04-12)


### Bug Fixes

* use note callout color for active session indicator in session manager - closes [#85](https://github.com/ScottKirvan/ObsidiBot/issues/85) ([28cd76d](https://github.com/ScottKirvan/ObsidiBot/commit/28cd76d7792845d435ddb522d588ecab94791416))

## [2.2.0](https://github.com/ScottKirvan/ObsidiBot/compare/v2.1.0...v2.2.0) (2026-04-12)


### Features

* **export:** add "Open note after creation" checkbox to export modal ([8051aa9](https://github.com/ScottKirvan/ObsidiBot/commit/8051aa92322dad88b2dad03afcae6e18072363b3)), closes [#96](https://github.com/ScottKirvan/ObsidiBot/issues/96)
* **session:** fix replay fidelity — XML context tags + compaction filtering ([bb92ce9](https://github.com/ScottKirvan/ObsidiBot/commit/bb92ce90d423730187f60f737cc8c77e3024a912)), closes [#99](https://github.com/ScottKirvan/ObsidiBot/issues/99)
* **ui:** slide-in confirmation panel before session compression ([82ac437](https://github.com/ScottKirvan/ObsidiBot/commit/82ac437d65b54c38e29478fd1c2b7a7b4b982bad)), closes [#95](https://github.com/ScottKirvan/ObsidiBot/issues/95)


### Bug Fixes

* **export:** change open-after checkbox default to unchecked ([743bb9c](https://github.com/ScottKirvan/ObsidiBot/commit/743bb9cc5aa62c4222451b047205d037ab26e4ca))
* **session:** filter all &lt;local-command-*&gt; entries from replay ([c9d3fd9](https://github.com/ScottKirvan/ObsidiBot/commit/c9d3fd93f9b99ca5a6aadac4da1b6b68caf74548))
* **session:** fix blank white badge boxes in replayed user messages ([2e784f9](https://github.com/ScottKirvan/ObsidiBot/commit/2e784f9d4f6079fd8096cadeab7d671a21d6a910))
* **session:** only show badges for manually-added context on replay ([01d41f2](https://github.com/ScottKirvan/ObsidiBot/commit/01d41f2fdbb864313c278a21966fa1d545d73c08))
* **session:** show context badges in live bubble + fix image/pdf replay text ([d56e629](https://github.com/ScottKirvan/ObsidiBot/commit/d56e629f8c3cb9057e2c1499016d12cdca5c1e5c))
* **ui:** anchor compact confirm panel above input area ([0e0c0d0](https://github.com/ScottKirvan/ObsidiBot/commit/0e0c0d09a4d5df52a87997ec8ca9da39705aa532))

## [2.1.0](https://github.com/ScottKirvan/ObsidiBot/compare/v2.0.0...v2.1.0) (2026-04-09)


### Features

* **ui:** add export-to-vault button to chat panel toolbar ([03913f1](https://github.com/ScottKirvan/ObsidiBot/commit/03913f1542ef537dcf9a19b69b8afb9a6f9b5281))


### Bug Fixes

* The project rename broke legacy sessions - fixed. ([2061c91](https://github.com/ScottKirvan/ObsidiBot/commit/2061c914d3c18579f895d7462fb82c4fc782d443))

## [2.0.0](https://github.com/ScottKirvan/ObsidiBot/compare/v1.5.4...v2.0.0) (2026-04-09)


### ⚠ BREAKING CHANGES

* API BREAKING CHANGE: Rename project and all APIs

### Features

* API BREAKING CHANGE: Rename project and all APIs ([4748f72](https://github.com/ScottKirvan/ObsidiBot/commit/4748f722fc3167e711f49197c2495c2db6a2546a))

## [1.5.4](https://github.com/ScottKirvan/ObsidiBot/compare/v1.5.3...v1.5.4) (2026-03-31)


### Bug Fixes

* **ui:** restore status indicator during tool calls after text has streamed ([0c97521](https://github.com/ScottKirvan/ObsidiBot/commit/0c975219985fe383c9fc5c8148496ff1d3e9e61d)), closes [#67](https://github.com/ScottKirvan/ObsidiBot/issues/67)

## [1.5.3](https://github.com/ScottKirvan/ObsidiBot/compare/v1.5.2...v1.5.3) (2026-03-31)


### Bug Fixes

* strip @@CORTEX_ACTION lines when replaying session history ([aaef64c](https://github.com/ScottKirvan/ObsidiBot/commit/aaef64cc77b2c99361ec2d91f206860c8e9c5753)), closes [#83](https://github.com/ScottKirvan/ObsidiBot/issues/83)
* **ui:** prevent ArrowDown from blocking cursor movement in recalled multiline messages ([8775c9e](https://github.com/ScottKirvan/ObsidiBot/commit/8775c9e55e30f6cebc75c08414501edc0249f554)), closes [#82](https://github.com/ScottKirvan/ObsidiBot/issues/82)

## [1.5.2](https://github.com/ScottKirvan/ObsidiBot/compare/v1.5.1...v1.5.2) (2026-03-29)


### Bug Fixes

* update icon in the right sidebar - TODO: move this to a variable. ([6c84dfb](https://github.com/ScottKirvan/ObsidiBot/commit/6c84dfbfb1eff6eab9307b6fb1959a10b0a674c7))

## [1.5.1](https://github.com/ScottKirvan/ObsidiBot/compare/v1.5.0...v1.5.1) (2026-03-29)


### Bug Fixes

* **ui:** add visual separation between sequential tool call events ([0bd9be6](https://github.com/ScottKirvan/ObsidiBot/commit/0bd9be6933f7841f04899ed6e7a0cc51bdc67fba)), closes [#68](https://github.com/ScottKirvan/ObsidiBot/issues/68)
* **ui:** suppress misleading Interrupted message on clean UI-bridge-only turns ([3ba0e68](https://github.com/ScottKirvan/ObsidiBot/commit/3ba0e68ec94dbd44303429afde448d44092397b3)), closes [#76](https://github.com/ScottKirvan/ObsidiBot/issues/76)

## [1.5.0](https://github.com/ScottKirvan/ObsidiBot/compare/v1.4.3...v1.5.0) (2026-03-29)


### Features

* vault query protocol — Claude can query live vault state ([#58](https://github.com/ScottKirvan/ObsidiBot/issues/58)) ([98dad7e](https://github.com/ScottKirvan/ObsidiBot/commit/98dad7eb08c4c41f39c426a1de27f5d7c3eb2c65))

## [1.4.3](https://github.com/ScottKirvan/ObsidiBot/compare/v1.4.2...v1.4.3) (2026-03-29)


### Bug Fixes

* correct stale log path comment in LoggerConfig ([d19b6db](https://github.com/ScottKirvan/ObsidiBot/commit/d19b6db040a96ef0f2de1753cb51d08473bf16ec))

## [1.4.2](https://github.com/ScottKirvan/ObsidiBot/compare/v1.4.1...v1.4.2) (2026-03-29)


### Bug Fixes

* refreshSessionContext now re-injects full orientation ([#69](https://github.com/ScottKirvan/ObsidiBot/issues/69)) ([ce70f88](https://github.com/ScottKirvan/ObsidiBot/commit/ce70f88858b9ed633cfc307ad529cdd50b914a19))

## [1.4.1](https://github.com/ScottKirvan/ObsidiBot/compare/v1.4.0...v1.4.1) (2026-03-29)


### Bug Fixes

* bug [#57](https://github.com/ScottKirvan/ObsidiBot/issues/57): code blocks in assistant messages render as copy icon only ([b7d8069](https://github.com/ScottKirvan/ObsidiBot/commit/b7d80691a02d9b32b1384f7319272b1f9dd5f0ec))
* bug [#63](https://github.com/ScottKirvan/ObsidiBot/issues/63):  restore last active session on startup instead of top-of-stack ([7e8e53c](https://github.com/ScottKirvan/ObsidiBot/commit/7e8e53ccd0d51aee7ba1abf7d552fc5113f4727d))
* correct release asset upload and project date-closed workflow ([e6728a3](https://github.com/ScottKirvan/ObsidiBot/commit/e6728a39d7d5520cffec4daf916270d1e5310390))
* correct release asset upload and project token for workflows ([7cca123](https://github.com/ScottKirvan/ObsidiBot/commit/7cca1233bd06e4c68dfd6cb1afe94c89d9b935f6))

## [1.4.0](https://github.com/ScottKirvan/ObsidiBot/compare/v1.3.0...v1.4.0) (2026-03-28)


### Features

* image and PDF support — attach via file picker, paste, or drag-and-drop ([1efcb5c](https://github.com/ScottKirvan/ObsidiBot/commit/1efcb5ca1bb00a2c89e0cdd1d214f41a4579f87b))
* image/PDF attachments, drag-and-drop, export session to vault, transcript format ([48feb43](https://github.com/ScottKirvan/ObsidiBot/commit/48feb4378575f853d09c0621b49a2fb0a880ebbf))
* show per-turn token usage stats below each response ([#43](https://github.com/ScottKirvan/ObsidiBot/issues/43)) ([d478504](https://github.com/ScottKirvan/ObsidiBot/commit/d4785040b6f6091c55c6c6a4fd62f2e975654a87))


### Bug Fixes

* copy/paste of screenshots wasn't using unique names, so multiple screenshots were overwriting each other ([5b825b6](https://github.com/ScottKirvan/ObsidiBot/commit/5b825b65dc58c5fdf7e320b2b3ca15da7d449518))
* expanding the name change search - it was pretty easy to miss it before. ([2620880](https://github.com/ScottKirvan/ObsidiBot/commit/262088024ddb2df376bf435c4d278aac4e0aab1f))

## [1.3.0](https://github.com/ScottKirvan/ObsidiBot/compare/v1.2.0...v1.3.0) (2026-03-27)


### Features

* drag-and-drop session manager sorting ([61afdf2](https://github.com/ScottKirvan/ObsidiBot/commit/61afdf2e5de0e8753cee7b78238b981e64d8aed4))
* new command: "ObsidiBot: Refresh Session" ([b45e2a9](https://github.com/ScottKirvan/ObsidiBot/commit/b45e2a9b615e696060f7deea3cff06930c76fa54))
* run-command discovery, UI polish, and bug fixes ([b6821dd](https://github.com/ScottKirvan/ObsidiBot/commit/b6821ddbea5dda91615ce4e61f70bfc174e91020))
* session manager now shows which session is active ([06cce74](https://github.com/ScottKirvan/ObsidiBot/commit/06cce747e71acb71aeadbaf7efe81e3e0620f031))
* UI Bridge run-command action with settings command browser ([#47](https://github.com/ScottKirvan/ObsidiBot/issues/47)) ([2121ddc](https://github.com/ScottKirvan/ObsidiBot/commit/2121ddc2939bc2c7c354a62fb847d8bea6cc15c6))


### Bug Fixes

* renaming a session in the session manager changes the name in the chat panel immediately now ([1740193](https://github.com/ScottKirvan/ObsidiBot/commit/1740193113daf65b3f5f2d6a3f271ebcffb5b986))
* session duplication after Obsidian restart ([6c2b889](https://github.com/ScottKirvan/ObsidiBot/commit/6c2b8890326c811c8f4a347afc06f6ed78c96403))

## [1.2.0](https://github.com/ScottKirvan/ObsidiBot/compare/v1.1.0...v1.2.0) (2026-03-20)


### Features

* multiple notes support ([98e8e10](https://github.com/ScottKirvan/ObsidiBot/commit/98e8e104132af1daaba5976f88dfe43f44388634))
* split-pane and side-by-side note editing support - configurable ([a280e42](https://github.com/ScottKirvan/ObsidiBot/commit/a280e42f9b118f515f82bcd1cd33811f016a93c1))


### Bug Fixes

* regression fix for obsidibot giving up on being inventive when needed. ([b126eef](https://github.com/ScottKirvan/ObsidiBot/commit/b126eef54cfcac757cba51050c2bb1c6e550008d))

## [1.1.0](https://github.com/ScottKirvan/ObsidiBot/compare/v1.0.0...v1.1.0) (2026-03-20)


### Features

* Attachment button: open up the paperclip to add files, URLs, and other content to the context stack ([d644f89](https://github.com/ScottKirvan/ObsidiBot/commit/d644f892381c6b8c2956df3f2a5bcd1db22b7b05))
* current note is pre-selected in @ mention context injection & additional file types (pdf, fountain - configurable) are now supported ([a107623](https://github.com/ScottKirvan/ObsidiBot/commit/a10762312bda06474977309e1e9a832f8ad1832f))
* frontmatter context injection and active note awareness ([#15](https://github.com/ScottKirvan/ObsidiBot/issues/15)) ([c12aeea](https://github.com/ScottKirvan/ObsidiBot/commit/c12aeea19d392eb40a64651883b559f7bd963e77))
* logginpg settings, verbosity settings, start/stop, file location, etc. ([169084e](https://github.com/ScottKirvan/ObsidiBot/commit/169084e59f88b8ebe321e2c91f3c9b91a57b2d42))
* session context gas gauge added - warns about auto compaction ([6efa27b](https://github.com/ScottKirvan/ObsidiBot/commit/6efa27b87c5fbc5268cae310692ad8b17688c2e0))
* Session-scoped pins: add a 📌 pin button next to the × on pending context items so pinned items survive send and stay in the stack for every subsequent message (see [#16](https://github.com/ScottKirvan/ObsidiBot/issues/16)) ([83503c4](https://github.com/ScottKirvan/ObsidiBot/commit/83503c4afd78b4e0224813ff71fe47b896ce8c8e))
* when using the @ mention context injection, pre-select the current note ([4b4775a](https://github.com/ScottKirvan/ObsidiBot/commit/4b4775a6c2e4ffee764101c1cf9d7fa3635d6015))

## [1.0.0](https://github.com/ScottKirvan/ObsidiBot/compare/v0.6.0...v1.0.0) (2026-03-20)


### ⚠ BREAKING CHANGES

* default permission mode is now 'standard' (acceptEdits). Users who relied on unrestricted Bash access should set Permission Mode to "Full access" in settings.

### Features

* [#40](https://github.com/ScottKirvan/ObsidiBot/issues/40) using @ to inject full notes as context ([75f8cf0](https://github.com/ScottKirvan/ObsidiBot/commit/75f8cf025ec9806913520e3c0b1a9777f70288c2))
* native permission modes, replace --dangerously-skip-permissions ([#18](https://github.com/ScottKirvan/ObsidiBot/issues/18)) ([3c41827](https://github.com/ScottKirvan/ObsidiBot/commit/3c4182799d683a1025ab74e72a0e0db0efde82ab))
* tool call visibility, selection context injection, session replay fix ([#38](https://github.com/ScottKirvan/ObsidiBot/issues/38), [#39](https://github.com/ScottKirvan/ObsidiBot/issues/39), [#17](https://github.com/ScottKirvan/ObsidiBot/issues/17)) ([61d91ef](https://github.com/ScottKirvan/ObsidiBot/commit/61d91ef629d8e0f57ce4ac11bfe0723966a5099a))


### Bug Fixes

* fixes to tool use messages and selected text context injection ([54a2384](https://github.com/ScottKirvan/ObsidiBot/commit/54a2384bb4e90fd749dc80d646f2027cb97904e4))

## [0.6.0](https://github.com/ScottKirvan/ObsidiBot/compare/v0.5.0...v0.6.0) (2026-03-18)


### Features

* add Focus input, Open context file, and About commands ([3dcd5c1](https://github.com/ScottKirvan/ObsidiBot/commit/3dcd5c1f36d8a6bee909b30e6aa8edc249038b56))
* gracefully handle and walk the user through setting up a broken claude CLI setup ([c507df8](https://github.com/ScottKirvan/ObsidiBot/commit/c507df806d4f18e1c999ab949e3b27a4c1cca880))


### Bug Fixes

* better, but not great, handling of logged-out users ([19102b9](https://github.com/ScottKirvan/ObsidiBot/commit/19102b91a14869d6d3fc87a11ab3ed5ecf62f536))
* move session history out of the plugin folder to fix symlink dev conflicts ([bcc42f2](https://github.com/ScottKirvan/ObsidiBot/commit/bcc42f2f062ea4c844b114a4382b246b41c1f873))
* session focus/renaming issues ([b40c069](https://github.com/ScottKirvan/ObsidiBot/commit/b40c069c097c22102c8ab1246265a53c32eabcb4))

## [0.5.0](https://github.com/ScottKirvan/ObsidiBot/compare/v0.4.0...v0.5.0) (2026-03-18)


### Features

* BRAT/publication compatible build ([ba0229a](https://github.com/ScottKirvan/ObsidiBot/commit/ba0229a1a6389989bf49a4381204b98dbd1d1041))

## [0.4.0](https://github.com/ScottKirvan/ObsidiBot/compare/v0.3.1...v0.4.0) (2026-03-17)


### Features

* added an interrupt/stop button for interrupting long or unwanted tasks. ([3df5318](https://github.com/ScottKirvan/ObsidiBot/commit/3df5318f6cdbfeb840832a66d03c0bc705ac7107))
* UI Bridge: allow Claude to trigger Obsidian UI actions [#32](https://github.com/ScottKirvan/ObsidiBot/issues/32) - automatically open notes, focus on a section, etc. ([e16af56](https://github.com/ScottKirvan/ObsidiBot/commit/e16af56b0242fee5247efcae02a3a6755e8f6c15))

## [0.3.1](https://github.com/ScottKirvan/ObsidiBot/compare/v0.3.0...v0.3.1) (2026-03-17)


### Bug Fixes

* add layer 0 context to give the agent some "you are here" context ([0bb37af](https://github.com/ScottKirvan/ObsidiBot/commit/0bb37afb9dd96487174aab163ad5ef2521363607))

## [0.3.0](https://github.com/ScottKirvan/ObsidiBot/compare/v0.2.1...v0.3.0) (2026-03-17)


### Features

* [#21](https://github.com/ScottKirvan/ObsidiBot/issues/21) Vault context file auto-generation on first launch ([7329009](https://github.com/ScottKirvan/ObsidiBot/commit/7329009f76998e218b7f95cac516bc5c987246ad))
* [#7](https://github.com/ScottKirvan/ObsidiBot/issues/7)  Improve "thinking" feedback (better spinner/status while waiting) ([b15790f](https://github.com/ScottKirvan/ObsidiBot/commit/b15790fbe824f313d5236d9cc5c7bf93abc81f6a))
* [#8](https://github.com/ScottKirvan/ObsidiBot/issues/8)  Up/down arrow to scroll through previous input messages ([92d198b](https://github.com/ScottKirvan/ObsidiBot/commit/92d198b4c6c2343927785043e69fce7525483ad4))
* added vault tree (context) depth settings ([5248300](https://github.com/ScottKirvan/ObsidiBot/commit/5248300b9aa0bb1ca319dd0ef92edfebd48ae9cb))
* UI updates - new icons, access to online help, discord, settings, etc, from the chat panel ([6b988fb](https://github.com/ScottKirvan/ObsidiBot/commit/6b988fb0b37fdd6bd9d847e89eef3ab045db9c53))


### Bug Fixes

* bug[#4](https://github.com/ScottKirvan/ObsidiBot/issues/4) add unicode curly quotes support (smart-quoted text) ([c27e89d](https://github.com/ScottKirvan/ObsidiBot/commit/c27e89dd956a26012553f952abcdf48519de2a0a))
* bug[#6](https://github.com/ScottKirvan/ObsidiBot/issues/6) Include markdown in command-copied data from the chat-panel (plus a file size refactor) ([c3af74b](https://github.com/ScottKirvan/ObsidiBot/commit/c3af74b25acf89d4dc41fdc359170ec74496825e))
* release-please version updating support for package.json ([c42fb94](https://github.com/ScottKirvan/ObsidiBot/commit/c42fb944ef6be9369aa5f5f2198bc7e361936b60))
* replace the phrase, "Ask Claude..." with "Ask ObsidiBot..." ([0000322](https://github.com/ScottKirvan/ObsidiBot/commit/00003225043d7f1b17cd7b3f18231acd454ebbfb))
* text parsing of doublequotes - included unit test ([96c5b52](https://github.com/ScottKirvan/ObsidiBot/commit/96c5b52240152fcb93489584c6406092297cc87d))

## [0.2.1](https://github.com/ScottKirvan/ObsidiBot/compare/v0.2.0...v0.2.1) (2026-03-10)


### Bug Fixes

* test checkin - ignore ([b199bef](https://github.com/ScottKirvan/ObsidiBot/commit/b199bef8f1757560d85d3f6bbd2ada60813df480))

## [0.2.0](https://github.com/ScottKirvan/ObsidiBot/compare/v0.1.0...v0.2.0) (2026-03-10)


### Features

* Markdown rendering of responses in the panel ([5856475](https://github.com/ScottKirvan/ObsidiBot/commit/5856475a3b620237b91242737b42181681978f69))
* plugin bootstrapped - beginning testing/debugging of basic systems ([5c4d024](https://github.com/ScottKirvan/ObsidiBot/commit/5c4d024cc87cef6cf792f087e348f51d72db36ca))
* send-on-enter option added to settings and functionality.  Plus, lots of visual cleanup - looking sexy ([b9acdf8](https://github.com/ScottKirvan/ObsidiBot/commit/b9acdf831532eb676dbdabcf94cb36d19d6f52b5))
* session history UI, command palette, UI polish, and token logging ([c37d65a](https://github.com/ScottKirvan/ObsidiBot/commit/c37d65ac79e02d4347fb2a737e12d4d2d36d9a11))
* session, context, and memory management ([16d288b](https://github.com/ScottKirvan/ObsidiBot/commit/16d288bc1b0dbcb8d47d243fe93bb07768d16f9c))
* support built-in, configurable context: _claude-context.md ([66f777a](https://github.com/ScottKirvan/ObsidiBot/commit/66f777ac7df88cb4d0bb34b3f1f478fb7af3ee31))


### Bug Fixes

* added session persistence - claude will remember your name now ([dd76ab9](https://github.com/ScottKirvan/ObsidiBot/commit/dd76ab96e533b12c9331fbbfc753e8c2b17f459b))
* adding the code workspace to the project ([78f9d16](https://github.com/ScottKirvan/ObsidiBot/commit/78f9d16acfa4e3dbd4e1430ef00435c831c560c5))
* claude initialization ([7759e80](https://github.com/ScottKirvan/ObsidiBot/commit/7759e8090705f88c00f2cc5a1b6853557ae2d543))
* cleanup verbose logging ([4c691ba](https://github.com/ScottKirvan/ObsidiBot/commit/4c691ba8969713c907bd418bef32085aa4ed9a39))
* copy/paste working ([8cdd637](https://github.com/ScottKirvan/ObsidiBot/commit/8cdd637bcf489c6ffba98040fd4691dd5d865a07))
* first working version - read/write files in the vault ([b635aa9](https://github.com/ScottKirvan/ObsidiBot/commit/b635aa9ee707a5cde8614c92ea42bbc33d2699f9))
* multiline input text now displays correctly in the chat panel ([2f0b5ad](https://github.com/ScottKirvan/ObsidiBot/commit/2f0b5adc280ad6466b3022145b456d7ff8550917))
* remove obsidian data files from the repo - oops ([32020e9](https://github.com/ScottKirvan/ObsidiBot/commit/32020e96cf48784feac119ad31d599da2289e6b7))
* sendOnEnter defaults to true now. Added a css box around the user message in the chat panel. ([ed2eb6b](https://github.com/ScottKirvan/ObsidiBot/commit/ed2eb6be9bfff52ad4ba20f899c022299c158224))


>[!NOTE]
> This file and it's version format is automatically 
> generated by [Please-Release](https://github.com/googleapis/release-please-action), 
> and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

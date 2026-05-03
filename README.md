---
last_updated: 2026-04-30
status: active
---

# ObsidiBot [![starline](https://starlines.qoo.monster/assets/ScottKirvan/ObsidiBot)](https://github.com/qoomon/starline)

<div align="center">
  <img src="assets/media/logo.png" alt="ObsidiBot logo" width="200" height="auto" />

  <h3>More than a writing assistant — ObsidiBot turns your Obsidian vault into a personal AI platform.</h3>

  <p>
    <a href="https://github.com/ScottKirvan/ObsidiBot/graphs/contributors"><img src="https://img.shields.io/github/contributors/ScottKirvan/ObsidiBot" alt="contributors" /></a>
    <a href=""><img src="https://img.shields.io/github/last-commit/ScottKirvan/ObsidiBot" alt="last update" /></a>
    <a href="https://github.com/ScottKirvan/ObsidiBot/stargazers"><img src="https://img.shields.io/github/stars/ScottKirvan/ObsidiBot" alt="stars" /></a>
    <a href="https://github.com/ScottKirvan/ObsidiBot/issues/"><img src="https://img.shields.io/github/issues/ScottKirvan/ObsidiBot" alt="open issues" /></a>
    <a href="https://github.com/ScottKirvan/ObsidiBot/blob/main/LICENSE.md"><img src="https://img.shields.io/github/license/ScottKirvan/ObsidiBot.svg" alt="license" /></a>
  </p>

  <h4>
    <a href="https://www.scottkirvan.com/ObsidiBot/">Docs</a> ·
    <a href="https://discord.gg/TN6XJSNK5Y">Discord</a> ·
    <a href="https://github.com/ScottKirvan/ObsidiBot/issues/new?template=bug_report.md">Report Bug</a> ·
    <a href="https://github.com/ScottKirvan/ObsidiBot/issues/new?template=feature_request.md">Request Feature</a>
  </h4>
</div>


Turn Obsidian into a tool that reaches beyond PKM, notetaking, storage, and organization. Safely extend it to match how you think, and what you do.  You're in control and everything happens using regular, conversational language — write, plan, build custom commands, even develop Obsidian plugins — without leaving Obsidian.


| You ask…                                                                                                         | ObsidiBot does…                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| "Summarize my meeting notes from last week"                                                                      | Creates a summary note and opens it in your editor                                                                       |
| "Rename all my untitled notes based on their content"                                                            | Finds them, renames them, reports back                                                                                   |
| "Find writing residencies in the US with open applications this year and draft a summary of costs and deadlines" | Searches the web, compiles results, writes the summary note                                                              |
| "Turn this page into a Canvas mind map"                                                                          | Generates a `.canvas` file from your note                                                                                |
| "Create a skill that summarizes my weekly notes into a report"                                                   | Writes the skill file — available instantly as a `/` slash command, Ctrl+P command, and callable by any plugin or script |

> [!NOTE]
> **Status:** Public beta — Install via [BRAT](https://github.com/TfTHacker/obsidian42-brat) or manually via [Github Releases](https://github.com/ScottKirvan/ObsidiBot/releases). Feedback welcome on [Discord](https://discord.gg/TN6XJSNK5Y). Currently [submitted](https://github.com/obsidianmd/obsidian-releases/pull/12000) for inclusion as an Obsidian Community Plugin — awaiting review.
## Installation
 *\*Requirements:*
- *Obsidian desktop (Windows, Mac, Linux — no mobile support)*
- *[Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code/overview) installed and authenticated — included in Claude Pro/Max subscriptions. (Windows,: install in PowerShell. Mac/Linux: use `curl -fsSL https://claude.ai/install.sh | bash`)*
### Install Via BRAT (recommended)
1. Install **BRAT** from the Obsidian community plugin browser
2. In BRAT settings → **Add Beta Plugin** → `ScottKirvan/ObsidiBot`
3. Done — BRAT keeps ObsidiBot updated automatically
### Install Manually
1. Download `obsidibot-<version>.zip` from [Releases](https://github.com/ScottKirvan/ObsidiBot/releases)
2. Extract to `<your-vault>/.obsidian/plugins/obsidibot/`
3. **Settings → Community Plugins** → enable **ObsidiBot**

---
## Quick Start

1. Open the ObsidiBot panel from the ribbon (brain/circuit icon) or Command Palette: `ObsidiBot: Open agent panel`
2. Type a message (ie. "Hi!  Tell me about yourself.") and press **Enter**
3. See the [User Guide](https://www.scottkirvan.com/ObsidiBot/) for details on Skills, session management, and settings

---
## What makes ObsidiBot different?
<details>
<summary><b>🔧 Create custom commands — expand Obsidian's capabilities</b></summary>

<!--[GIF: Skills form modal opening, user filling fields, Claude executing]-->

<br>
<b>Skills</b> are the "bot" in ObsidiBot. Write a natural language prompt, save it as a markdown file in your commands folder, and it becomes a first-class command — available in the '/' slash menu, in the Obsidian command palette with hotkey support, <em>and</em> exposed as an API endpoint, callable by any plugin or script within Obsidian.
<br><br>
Add YAML frontmatter and Skills grow into parameterized forms that can prompt for input: dropdowns, text inputs, note pickers with fuzzy search. Your most-compicated recurring workflows become generalized, reusable, one-click operations.
<br><br>
→ <a href="https://www.scottkirvan.com/ObsidiBot/guide/skills.html">Learn about Skills</a>
<br><br>
</details>
<details>
<summary><b>✏️ Deep Obsidian integration</b></summary>

<!--[GIF: ObsidiBot opening a file, navigating to a heading, showing toast notification]-->

<br>
ObsidiBot isn't a chat window bolted onto Obsidian. It integrates <em>with</em> Obsidian:
<br><br>
<ul>
<li><b>Obsidian UI control</b> — opens files, splits panes, navigates headings, shows notifications</li>
<li><b>Run any command</b> — execute anything from the command palette; and you control which commands are allowed and which aren't</li>
<li><b>Live vault graph</b> — Claude can query backlinks, outlinks, tags, and file lists mid-reasoning</li>
<li><b>Canvas</b> — reads and generates <code>.canvas</code> files natively</li>
</ul>
<br>
→ <a href="https://www.scottkirvan.com/ObsidiBot/features">Full feature list</a>
<br><br>
</details>
<details>
<summary><b>🔒 Your vault, your rules</b></summary>

<br>
<ul>
<li><b>Configurable safety modes</b> — readonly, standard, full access; blocked operations show an in-chat card with one-click upgrade</li>
<li><b>Per-note frontmatter controls</b> — pin notes to every session, inject per-note instructions, all via Obsidian Properties</li>
<li><b>Vault-native memory</b> — <code>_claude-context.md</code> persists context across sessions and syncs across machines</li>
<li><b>Context gauge</b> — live session memory indicator below the input; one-click compaction</li>
</ul>
<br><br>
</details>
<details>
<summary><b>🌐 Reach beyond your vault</b></summary>

<br>
ObsidiBot doesn't stop at the edges of your vault. Given proper permissions (which you control), it can search the web, work with files anywhere on your system, and interact with external services — and everything it finds comes back as a note, woven into your vault where it belongs.
<br><br>
<ul>
<li><b>Web search</b> — Claude can search the web mid-conversation and bring results back as chat responses or notes</li>
<li><b>Filesystem access</b> — ObsidiBot, under your direction, can read, write, and organize files anywhere on your system, not just inside the vault</li>
<li><b>External services</b> — Home automation, calendar/weather, GitHub, etc.  For example, ObsidiBot can manage GitHub issues, pull in data, run CLI tools — all from a single conversational interface</li>
<li><b>Your vault as hub</b> — everything that comes in lands where you decide, searchable and linked</li>
</ul>
<br><br>
</details>

---

## Support the project

ObsidiBot is free, open source, and built in spare time. If it's useful:

[![GitHub Sponsors](https://img.shields.io/github/sponsors/ScottKirvan?style=social)](https://github.com/sponsors/ScottKirvan)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for project layout, development setup, and PR process.

## License

MIT — see [LICENSE.md](LICENSE.md)

---

[CHANGELOG](notes/CHANGELOG.md) · [User Guide](https://www.scottkirvan.com/ObsidiBot/) · [Roadmap](https://github.com/users/ScottKirvan/projects/3)

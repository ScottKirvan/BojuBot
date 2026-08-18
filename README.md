# BojuBot (보주봇) [![starline](https://raw.githubusercontent.com/ScottKirvan/BojuBot/refs/heads/starlines/ScottKirvan/BojuBot/starline.svg)](https://github.com/qoomon/starlines)

<div align="center">
  <img src="assets/media/logo.png" alt="BojuBot logo" width="200" height="auto" />

  <h3>More than a writing assistant — BojuBot turns your Obsidian vault into a personal AI platform.</h3>

  <p>
    <a href="https://github.com/ScottKirvan/BojuBot/graphs/contributors"><img src="https://img.shields.io/github/contributors/ScottKirvan/BojuBot" alt="contributors" /></a>
    <a href=""><img src="https://img.shields.io/github/last-commit/ScottKirvan/BojuBot" alt="last update" /></a>
    <a href="https://github.com/ScottKirvan/BojuBot/stargazers"><img src="https://img.shields.io/github/stars/ScottKirvan/BojuBot" alt="stars" /></a>
    <a href="https://github.com/ScottKirvan/BojuBot/issues/"><img src="https://img.shields.io/github/issues/ScottKirvan/BojuBot" alt="open issues" /></a>
    <a href="https://github.com/ScottKirvan/BojuBot/blob/main/LICENSE.md"><img src="https://img.shields.io/github/license/ScottKirvan/BojuBot.svg" alt="license" /></a>
    <a href="https://github.com/ScottKirvan/BojuBot"><img
    src="https://badges.pufler.dev/visits/ScottKirvan/BojuBot" /></a>
      
  </p>

  <h4>
    <a href="https://www.scottkirvan.com/BojuBot/">Docs</a> ·
    <a href="https://discord.gg/TN6XJSNK5Y">Discord</a> ·
    <a href="https://github.com/ScottKirvan/BojuBot/issues/new?template=bug_report.md">Report Bug</a> ·
    <a href="https://github.com/ScottKirvan/BojuBot/issues/new?template=feature_request.md">Request Feature</a>
  </h4>
</div>


Turn Obsidian into a tool that reaches beyond PKM, notetaking, storage, and organization. Safely extend it to match how you think, and what you do.  You're in control and everything happens using regular, conversational language — write, plan, build custom commands, even develop Obsidian plugins — without leaving Obsidian.


| You ask…                                                                                                         | BojuBot does…                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| "Summarize my meeting notes from last week"                                                                      | Creates a summary note and opens it in your editor                                                                       |
| "Rename all my untitled notes based on their content"                                                            | Finds them, renames them, reports back                                                                                   |
| "Find writing residencies in the US with open applications this year and draft a summary of costs and deadlines" | Searches the web, compiles results, writes the summary note                                                              |
| "Turn this page into a Canvas mind map"                                                                          | Generates a `.canvas` file from your note                                                                                |
| "Create a skill that summarizes my weekly notes into a report"                                                   | Writes the skill file — available instantly as a `/` slash command, Ctrl+P command, and callable by any plugin or script |

## Installation

*Requirements:*
- *Obsidian desktop (Windows, Mac, Linux — no mobile support)*
- *[Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code/overview) installed and authenticated — included in Claude Pro/Max subscriptions. (Windows: install in PowerShell. Mac/Linux: use `curl -fsSL https://claude.ai/install.sh | bash`)*

### From the Community Plugin Browser
1. Open Obsidian → **Settings → Community Plugins → Browse**
2. Search **BojuBot** → **Install** → **Enable**

Or find it at **[community.obsidian.md/plugins/bojubot](https://community.obsidian.md/plugins/bojubot)** → click **Add to Obsidian**.

### Install Manually
1. Download `main.js`, `manifest.json`, and `styles.css` from [Releases](https://github.com/ScottKirvan/BojuBot/releases)
2. Place them in `<your-vault>/.obsidian/plugins/bojubot/`
3. **Settings → Community Plugins** → enable **BojuBot**

---
## Quick Start

1. Open the BojuBot panel from the ribbon (brain/circuit icon) or Command Palette: `BojuBot: Open agent panel`
2. Type a message (ie. "Hi!  Tell me about yourself.") and press **Enter**
3. See the [User Guide](https://www.scottkirvan.com/BojuBot/) for details on Skills, session management, and settings

---
## What makes BojuBot different?
<details>
<summary><b>🔧 Create custom commands — expand Obsidian's capabilities</b></summary>

<!--[GIF: Skills form modal opening, user filling fields, Claude executing]-->

<br>
<b>Skills</b> are the "bot" in BojuBot. Write a natural language prompt, save it as a markdown file in your commands folder, and it becomes a first-class command — available in the '/' slash menu, in the Obsidian command palette with hotkey support, <em>and</em> exposed as an API endpoint, callable by any plugin or script within Obsidian.
<br><br>
Add YAML frontmatter and Skills grow into parameterized forms that can prompt for input: dropdowns, text inputs, note pickers with fuzzy search. Your most-compicated recurring workflows become generalized, reusable, one-click operations.
<br><br>
→ <a href="https://www.scottkirvan.com/BojuBot/guide/skills.html">Learn about Skills</a>
<br><br>
</details>
<details>
<summary><b>✏️ Deep Obsidian integration</b></summary>

<!--[GIF: BojuBot opening a file, navigating to a heading, showing toast notification]-->

<br>
BojuBot isn't a chat window bolted onto Obsidian. It integrates <em>with</em> Obsidian:
<br><br>
<ul>
<li><b>Obsidian UI control</b> — opens files, splits panes, navigates headings, shows notifications</li>
<li><b>Run any command</b> — execute anything from the command palette; and you control which commands are allowed and which aren't</li>
<li><b>Live vault graph</b> — Claude can query backlinks, outlinks, tags, and file lists mid-reasoning</li>
<li><b>Canvas</b> — reads and generates <code>.canvas</code> files natively</li>
</ul>
<br>
→ <a href="https://www.scottkirvan.com/BojuBot/features">Full feature list</a>
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
BojuBot doesn't stop at the edges of your vault. Given proper permissions (which you control), it can search the web, work with files anywhere on your system, and interact with external services — and everything it finds comes back as a note, woven into your vault where it belongs.
<br><br>
<ul>
<li><b>Web search</b> — Claude can search the web mid-conversation and bring results back as chat responses or notes</li>
<li><b>Filesystem access</b> — BojuBot, under your direction, can read, write, and organize files anywhere on your system, not just inside the vault</li>
<li><b>External services</b> — Home automation, calendar/weather, GitHub, etc.  For example, BojuBot can manage GitHub issues, pull in data, run CLI tools — all from a single conversational interface</li>
<li><b>Your vault as hub</b> — everything that comes in lands where you decide, searchable and linked</li>
</ul>
<br><br>
</details>

---

## Support the project

BojuBot is free, open source, and built in spare time. If it's useful:

[![GitHub Sponsors](https://img.shields.io/github/sponsors/ScottKirvan?style=social)](https://github.com/sponsors/ScottKirvan)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for project layout, development setup, and PR process.

## License

MIT — see [LICENSE.md](LICENSE.md)

---

[CHANGELOG](notes/CHANGELOG.md) · [User Guide](https://www.scottkirvan.com/BojuBot/) · [Roadmap](https://github.com/users/ScottKirvan/projects/3)

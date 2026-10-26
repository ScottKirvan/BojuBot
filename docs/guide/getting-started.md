# Requirements & Installation

## Requirements

- **Obsidian desktop**: Windows, Mac, or Linux. Mobile is not supported.
- **An AI agent**, installed and signed in. BojuBot doesn't talk to an AI service itself: it runs an agent program (a CLI) on your computer and uses your existing account with it, so there's no API key to set up. Pick one:
  - **Claude**, through Anthropic's **Claude Code** CLI. This is the default. Needs a **Claude Pro or Max subscription**.
  - **Gemini**, through **Google's Antigravity CLI** (`agy`) <Badge type="warning" text="Beta" />. Needs a **Google account with Antigravity access**; usage counts against your Antigravity quota, not a Claude plan. Antigravity also offers some Claude and GPT-OSS models on the same quota.

You only need one of them. If you install both, you can switch between them at any time (see [Switching agents later](#switching-agents-later)), and [Choosing an Agent](./agents) compares the two.

---

## Installing Claude Code (for Claude)

::: code-group

```powershell [Windows (PowerShell)]
irm https://claude.ai/install.ps1 | iex
```

```bash [Mac / Linux]
curl -fsSL https://claude.ai/install.sh | bash
```

:::

::: warning Windows note
Claude Code must be installed **natively in PowerShell**. A WSL-only or CMD-only install will not work with BojuBot.
:::

After installing, verify it works:

```bash
claude --version
```

Then run `claude` once in your terminal to sign in. It opens a browser window; if it doesn't open automatically, press `c` to copy the login URL. See Anthropic's [full install guide](https://code.claude.com/docs/en/overview#native-install-recommended) for other options.

Claude Code is BojuBot's default agent, so there's nothing to change in BojuBot's settings.

---

## Installing Antigravity (for Gemini) <Badge type="warning" text="Beta" />

::: warning Not released yet
Gemini support through Antigravity is in [beta builds](beta-builds.md) and will ship in the next release. The community plugin version only runs Claude Code.
:::

To use Gemini, BojuBot runs Google's Antigravity CLI (`agy`), which runs Gemini. In BojuBot's settings and menus this agent is called **Antigravity**.

1. **Install the Antigravity CLI.** Follow the [Antigravity CLI install guide](https://antigravity.google/docs/getting-started?tab=cli#download-and-install).
2. **Sign in once.** Open a terminal, run `agy`, and sign in with your Google account in the browser window that opens. You can close the terminal afterwards. BojuBot reuses that sign-in.
3. **Pick it in BojuBot** once the plugin is installed: **Settings → BojuBot → Agent** → **Antigravity**. If BojuBot doesn't find `agy` on its own, set **Antigravity binary path** to the full path of `agy` (on Windows usually `%LOCALAPPDATA%\agy\bin\agy.exe`).

The model picker then lists Gemini models (plus the Claude and GPT-OSS models Antigravity offers). See [Choosing an Agent](./agents) for what works differently on Antigravity.

---

## Switching agents later

- **For new sessions:** change **Settings → BojuBot → Agent**. Sessions you've already used stay on the agent they started with, because a conversation can't move between agent CLIs.
- **For one session:** Shift+click **+** in the chat panel and pick the agent in the **Agent** field of [Custom Session](./sessions#starting-a-new-session).

---

## Plugin Installation

### From the Community Plugin Browser

1. Open Obsidian → **Settings → Community Plugins**
2. If not already enabled, click **Turn On Community Plugins**
3. Click **Browse**
4. Search for **BojuBot** → click **Install** → **Enable**

Or open directly in Obsidian: [Add to Obsidian](obsidian://show-plugin?id=bojubot)

### Manually

1. Download `main.js`, `manifest.json`, and `styles.css` from the [Releases page](https://github.com/ScottKirvan/BojuBot/releases)
2. Create the folder `<your-vault>/.obsidian/plugins/bojubot/`
3. Place the three files inside it
4. In Obsidian: **Settings → Community Plugins** → find **BojuBot** and enable it

### From Source

See [CONTRIBUTING.md](https://github.com/ScottKirvan/BojuBot/blob/main/CONTRIBUTING.md) for building from source.

---

Next: [First Launch →](./first-launch)

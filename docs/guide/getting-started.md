# Requirements & Installation

## Requirements

- **Obsidian desktop** — Windows, Mac, or Linux. Mobile is not supported.
- **Claude Code CLI** — installed and authenticated. ([Full install guide](https://code.claude.com/docs/en/overview#native-install-recommended))
- **Claude Pro or Max subscription** — BojuBot rides your existing subscription. No separate API key needed.

### Installing Claude Code

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

Then run `claude` once in your terminal to authenticate — it will open a browser window. If the browser doesn't open automatically, press `c` to copy the login URL.

---

## Plugin Installation

### From the Community Plugin Browser

1. Open Obsidian → **Settings → Community Plugins 
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

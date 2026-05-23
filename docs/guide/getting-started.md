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

## Installation

### Via BRAT (recommended for beta)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) installs and auto-updates beta plugins directly from GitHub.

1. Install **BRAT** from the Obsidian community plugin browser
2. In BRAT settings, click **Add Beta Plugin**
3. Enter: `ScottKirvan/BojuBot`
4. BRAT installs BojuBot and keeps it updated automatically

### Manually

1. Download `bojubot-<version>.zip` from the [Releases page](https://github.com/ScottKirvan/BojuBot/releases)
2. Extract the zip — you should have a `bojubot/` folder containing `main.js`, `manifest.json`, and `styles.css`
3. Move the `bojubot/` folder into `<your-vault>/.obsidian/plugins/`
4. In Obsidian: **Settings → Community Plugins → disable Safe Mode** (if prompted)
5. Find **BojuBot** in the installed plugins list and enable it

### From Source

See [CONTRIBUTING.md](https://github.com/ScottKirvan/BojuBot/blob/main/CONTRIBUTING.md) for building from source.

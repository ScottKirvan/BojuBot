# Troubleshooting

## Common Issues

**Setup panel appears instead of the chat panel**

BojuBot couldn't find the CLI for the agent new sessions use (**Settings → BojuBot → Default agent for new sessions**).

- **Claude (Claude Code):** follow the on-screen steps, or if Claude Code is already installed, enter the full path to the binary in the path field. See the [Claude Code install guide](https://code.claude.com/docs/en/overview#native-install-recommended).
- **Gemini (Antigravity CLI):** install Google's Antigravity CLI (`agy`) and sign in, or set **Antigravity CLI binary path**. See [Choosing an Agent](./agents#troubleshooting).
- **Using Gemini but seeing the Claude Code panel?** Switch **Settings → BojuBot → Default agent for new sessions** to **Gemini (Antigravity CLI)**, then click **Check again**.

---

**"Your Claude Code login has expired" or "The Antigravity CLI isn't signed in" error card**

The agent's sign-in is missing, has expired, or was rejected. See [Signing in again](#signing-in-again) below.

---

**Plugin doesn't appear in Obsidian after installing**

Ensure Safe Mode is disabled (**Settings → Community Plugins**) and that the `bojubot/` folder contains both `main.js` and `manifest.json`. Restart Obsidian after installing.

---

**The agent doesn't seem to know about my vault structure**

Check that your context file exists at the configured path (`_claude-context.md` by default) and contains useful information about your vault. If the agent seems unaware of your vault's folder structure, enable **Vault tree depth** in settings (1–3 levels is a good starting point) so the structure is injected at session start.

---

**The agent is doing something unexpected mid-task**

Click the **Stop** button (square icon in the input bar) to interrupt immediately. The agent's process and any subprocesses are killed. Files already written before you stopped will remain — review them before continuing. Start a new session or send a follow-up to correct course.

---

**The agent seems to be running but nothing is happening**

If the status indicator has been showing for a long time with no output, the agent may be stuck. Click **Stop**, then try again. Run `claude --version` (Claude Code) or `agy --version` (the Antigravity CLI) in a terminal to confirm the install is visible to your shell.

---

**"Your Claude Code doesn't know this model yet" note**

*Claude Code only.* BojuBot shows this note, once per model, when Claude Code warns that it doesn't recognize the model you picked. In older BojuBot versions it appeared as a raw line: `stderr: [claude-code:unrecognized_model] {"model":"claude-haiku-5-5","query_source":"sdk"}`.

This is a warning from Claude Code, not an error. Your installed Claude Code is older than the model you picked, so the model isn't in its built-in list. The reply still works, but Claude Code may guess at that model's limits, so token counts can be a little off. Update Claude Code to make the warning go away:

::: code-group

```powershell [Windows (winget)]
winget upgrade Anthropic.ClaudeCode
```

```bash [Mac / Linux / Windows (native install)]
claude update
```

:::

Run `claude --version` afterwards to check, then restart Obsidian so BojuBot picks up the new version. The detected version is shown in the [Help & resources dialog](./chat-panel#about-dialog) and under **Claude Code binary path** in settings.

---

**"Claude Code needs an update" error card**

*Claude Code only.* The model you picked needs a newer Claude Code than the one installed, and this time the request is refused rather than just warned about. Update Claude Code with the commands above and send your message again. To keep working in the meantime, [switch to an older model](./chat-panel#model-indicator).

---

**Something unexpected happened and I want to investigate**

Check `.obsidian/plugins/bojubot/bojubot-debug.log` (or the path configured in settings). Each session is separated by a `--- BojuBot log started ---` line. For more detail, switch **Log verbosity** to **Verbose** in settings — it takes effect immediately.

---

## Signing in again

BojuBot uses the sign-in of the agent itself (Claude Code or Antigravity). That sign-in can expire, or be missing if you've never signed in on this computer or signed out. When it is, BojuBot shows an error card that says so, with an **Open terminal** button and a **Sign-in help** link to this page. Nothing you typed is lost: sign in, then send your message again.

### Signing in to Claude Code again

You'll see one of these cards:

- **Your Claude Code login has expired**: you were signed in, but the login ran out and Claude Code couldn't renew it on its own.
- **Claude Code isn't signed in**: Claude Code has no login on this computer.
- **Claude Code couldn't verify your login**: Claude Code sent your login and it was refused.

To sign in:

1. Click **Open terminal** in the error card. A terminal window opens running Claude Code.
2. If Claude Code asks you to sign in, follow its prompts. Otherwise type `/login` and press Enter.
3. A browser window opens. Sign in with the Claude account that has your Pro or Max subscription. If the browser doesn't open, press `c` in the terminal to copy the sign-in link and paste it into your browser.
4. When the terminal says you're signed in, close it.
5. Back in BojuBot, send your message again.

You can also sign in from any terminal without opening Claude Code: run `claude auth login`. To check whether you're signed in, run `claude auth status`. (Older Claude Code versions don't have `claude auth`; use `/login` inside `claude` instead, or update Claude Code.)

### Signing in to Antigravity again

You'll see **The Antigravity CLI isn't signed in** or **Your Antigravity CLI sign-in has expired**.

To sign in:

1. Click **Open terminal** in the error card, or open a terminal yourself and run `agy`.
2. A browser window opens. Sign in there.
3. Once you're signed in, close the terminal.
4. Back in BojuBot, send your message again.

See [Agents](./agents) for more about using Antigravity with BojuBot.

---

## Logging

Debug logging is **off by default**. Turn it on via **Settings → BojuBot → Enable debug log** — it takes effect immediately, no restart needed. Once enabled, BojuBot writes to `.obsidian/plugins/bojubot/bojubot-debug.log` — inside the plugin folder, not your vault, so it won't appear in Obsidian's file browser or your git history.

Each Obsidian launch appends a `--- BojuBot log started ---` marker so you can find session boundaries. Delete the file manually to clear it.

**Verbosity levels:**

| Level                  | What's logged                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| **Normal** *(default)* | Session events, tool calls, spawns, errors                                                  |
| **Verbose**            | Everything above plus raw stream chunks and token breakdowns — produces large files quickly |

All settings take effect immediately without restarting Obsidian.

::: tip
The log file is not visible in Obsidian's file browser — no `.gitignore` entry needed.
:::

---

## Known Limitations

- **Desktop only** — Obsidian mobile is not supported (Node.js APIs unavailable on mobile)
- **Claude Code must be installed via a terminal** — on Windows use PowerShell; on Mac/Linux use Terminal
- In Standard and Full access, the agent operates with full vault access — no per-file infrastructure enforcement (see [Per-note Frontmatter](./context-system#5-per-note-frontmatter-context) for convention-based protection)
- Sessions are stored in `.obsidian/bojubot/sessions/` which is typically gitignored; sessions do not sync across devices

---

Still stuck? Ask in the [Discord community](https://discord.gg/TN6XJSNK5Y) or [open an issue](https://github.com/ScottKirvan/BojuBot/issues) on GitHub.

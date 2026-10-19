# Troubleshooting

## Common Issues

**Setup panel appears instead of the chat panel**

BojuBot couldn't find your Claude Code installation. Follow the on-screen steps, or if Claude Code is already installed, enter the full path to the binary in the path field. See the [Claude Code install guide](https://code.claude.com/docs/en/overview#native-install-recommended).

---

**"Claude Code is not authenticated" error after sending a message**

Claude Code is installed but not logged in. Click **Open terminal** in the error card — a terminal will open running Claude Code. Follow the prompts to authenticate (a browser window will open). Click **Done** when finished.

---

**Plugin doesn't appear in Obsidian after installing**

Ensure Safe Mode is disabled (**Settings → Community Plugins**) and that the `bojubot/` folder contains both `main.js` and `manifest.json`. Restart Obsidian after installing.

---

**Claude doesn't seem to know about my vault structure**

Check that your context file exists at the configured path (`_claude-context.md` by default) and contains useful information about your vault. If Claude seems unaware of your vault's folder structure, enable **Vault tree depth** in settings (1–3 levels is a good starting point) so the structure is injected at session start.

---

**Claude is doing something unexpected mid-task**

Click the **Stop** button (square icon in the input bar) to interrupt immediately. Claude's process and any subprocesses are killed. Files already written before you stopped will remain — review them before continuing. Start a new session or send a follow-up to correct course.

---

**Claude seems to be running but nothing is happening**

If the status indicator has been showing for a long time with no output, Claude may be stuck. Click **Stop**, then try again. Run `claude --version` in a terminal to confirm the install is visible to your shell.

---

**A `stderr: [claude-code:unrecognized_model]` line appears under a reply**

For example: `stderr: [claude-code:unrecognized_model] {"model":"claude-haiku-5-5","query_source":"sdk"}`

This is a warning from Claude Code, not an error. Your installed Claude Code is older than the model you picked, so the model isn't in its built-in list. The reply still works, but Claude Code may guess at that model's limits, so token counts can be a little off. Update Claude Code to make the warning go away:

::: code-group

```powershell [Windows (winget)]
winget upgrade Anthropic.ClaudeCode
```

```bash [Mac / Linux / Windows (native install)]
claude update
```

:::

Run `claude --version` afterwards to check, then restart Obsidian so BojuBot picks up the new version. The detected version is shown in the [Help & resources dialog](./chat-panel#about-dialog) and under **Claude binary path** in settings.

---

**"Claude Code needs an update" error card**

The model you picked needs a newer Claude Code than the one installed, and this time the request is refused rather than just warned about. Update Claude Code with the commands above and send your message again. To keep working in the meantime, [switch to an older model](./chat-panel#model-indicator).

---

**Something unexpected happened and I want to investigate**

Check `.obsidian/plugins/bojubot/bojubot-debug.log` (or the path configured in settings). Each session is separated by a `--- BojuBot log started ---` line. For more detail, switch **Log verbosity** to **Verbose** in settings — it takes effect immediately.

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
- **One active session at a time** — concurrent sessions are not supported
- Claude operates with full vault access — no per-file infrastructure enforcement (see [Per-note Frontmatter](./context-system#5-per-note-frontmatter-context) for convention-based protection)
- Sessions are stored in `.obsidian/bojubot/sessions/` which is typically gitignored; sessions do not sync across devices

---

Still stuck? Ask in the [Discord community](https://discord.gg/TN6XJSNK5Y) or [open an issue](https://github.com/ScottKirvan/BojuBot/issues) on GitHub.

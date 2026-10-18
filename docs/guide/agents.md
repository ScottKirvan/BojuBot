# Choosing an Agent <Badge type="warning" text="Beta" />

::: warning Not released yet
Antigravity support is in [beta builds](beta-builds.md) and will ship in the next release. The community plugin version doesn't have it yet.
:::

BojuBot can run on one of two agent CLIs:

- **Claude Code**: the default, using your Claude Pro or Max subscription.
- **Antigravity CLI** (`agy`): Google's agent CLI, using your Google account's Antigravity quota.

Both work with the same chat panel, sessions, skills, UI Bridge and vault queries.

A common setup is to keep your Claude quota for heavy work, such as programming in Claude Code itself, and use Antigravity for everyday note-taking in Obsidian. You can switch any time; each session remembers which agent it started on.

## Setting up Antigravity

1. **Install the Antigravity CLI.** Follow the [Antigravity CLI install guide](https://antigravity.google/docs/getting-started?tab=cli#download-and-install).
2. **Sign in once.** Open a terminal, run `agy`, and sign in in the browser window that opens. You can close the terminal afterwards. BojuBot reuses that sign-in.
3. **Pick it in BojuBot.** Go to **Settings → BojuBot → Agent** and choose **Antigravity**. If BojuBot doesn't find `agy` on its own, set **Antigravity binary path** to the full path of `agy` (on Windows usually `%LOCALAPPDATA%\agy\bin\agy.exe`).

The **Agent** setting applies to new sessions. An empty new session that you haven't sent a message in yet switches straight away. Sessions you've already used stay on the agent they started with, because a conversation can't move between CLIs.

To start a single session on the other agent without changing the setting, Shift+click **+** and choose it in the **Agent** field of [Custom Session](./sessions#starting-a-new-session).

## What's different on Antigravity

| | Claude Code | Antigravity |
| --- | --- | --- |
| Models | Claude models, plus your `custom-models.json` | Whatever `agy models` lists: Gemini Flash variants, plus Claude and GPT models through Antigravity |
| Model picker default | Claude Sonnet | "Antigravity default", which lets Antigravity choose |
| Effort levels | When your Claude Code version supports them | Low to max |
| Chat only mode | Available | Not available (greyed out in the picker) |
| Standard mode | File edits allowed; read-only shell commands like `ls` allowed | File edits allowed; **all** shell commands denied |
| Read only mode | Reads files, no writes | Antigravity's plan mode: no writes |
| Context gauge and compact | Shown | Hidden: Antigravity doesn't report its context size or offer a compact command |
| `/usage` | Your Claude plan usage | Remaining weekly and 5-hour quota for each Antigravity model group |
| Session history | Read from Claude Code's own history | BojuBot keeps a transcript next to the session file |

**Cost per message.** Antigravity adds roughly 12,000 tokens of its own instructions to every message and doesn't report cache reads. That counts against your Antigravity quota, not your Claude plan. Run `/usage` to see what's left.

**Models from other providers.** Antigravity's quota is split into groups (for example "Gemini Models" and "Claude and GPT models"), each with its own weekly and 5-hour limit. Using a Claude model through Antigravity draws on Antigravity's quota, not your Claude subscription.

## Permissions on Antigravity

Antigravity can't take per-session allow and deny rules on the command line, so BojuBot maps its modes like this:

- **Standard** runs `agy --mode accept-edits`. Antigravity creates and edits notes freely, and every shell command is denied. When one is denied, the [denial card](./permissions#permission-denials) offers full access for the session.
- **Read only** runs Antigravity's plan mode, which never writes to your vault. Antigravity sometimes answers with a plan rather than doing a read-only task directly.
- **Full access** runs `agy --dangerously-skip-permissions`.
- **Chat only** isn't available, because Antigravity has no way to block file access for a single session.

To allow particular shell commands in Standard mode, add allow rules such as `command(git)` to Antigravity's own `~/.gemini/antigravity-cli/settings.json`. See [Antigravity permissions](https://antigravity.google/docs/permissions). These rules apply to all your `agy` use, not just BojuBot.

## Troubleshooting

**"Antigravity not found" when the panel opens.** Your default agent is Antigravity but BojuBot can't find `agy`. Install it, set **Antigravity binary path**, or switch **Agent** back to Claude Code, then click **Check again**.

**"Antigravity isn't signed in."** Click **Open terminal** in the error card, or run `agy` in a terminal yourself, and sign in. Then send your message again.

**"Model not available."** The model saved for the session isn't in Antigravity's list any more. Pick another one from the model picker.

**It asks for full access to create a note.** Standard should allow file edits. If you still see this, check that you're in Standard mode, not Read only, and that you're on the latest BojuBot.

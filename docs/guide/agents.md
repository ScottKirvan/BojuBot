# Choosing an Agent <Badge type="warning" text="Beta" />

::: warning Not released yet
Gemini support through Antigravity is in [beta builds](beta-builds.md) and will ship in the next release. The community plugin version doesn't have it yet.
:::

BojuBot can work with Claude or with Gemini. It runs each one through an agent CLI installed on your computer:

- **Claude, through Claude Code**: the default, using your Claude Pro or Max subscription.
- **Gemini, through Google's Antigravity CLI** (`agy`), which runs Gemini using your Google account's Antigravity quota. Antigravity also offers some Claude and GPT-OSS models on that quota. In BojuBot's settings and menus this agent is called **Antigravity**.

Both work with the same chat panel, sessions, skills, UI Bridge and vault queries.

A common setup is to keep your Claude quota for heavy work, such as programming in Claude Code itself, and use Gemini through Antigravity for everyday note-taking in Obsidian. You can switch any time; each session remembers which agent it started on.

## Setting up Antigravity (for Gemini)

1. **Install the Antigravity CLI.** Follow the [Antigravity CLI install guide](https://antigravity.google/docs/getting-started?tab=cli#download-and-install).
2. **Sign in once.** Open a terminal, run `agy`, and sign in in the browser window that opens. You can close the terminal afterwards. BojuBot reuses that sign-in.
3. **Pick it in BojuBot.** Go to **Settings → BojuBot → Agent** and choose **Antigravity**. If BojuBot doesn't find `agy` on its own, set **Antigravity binary path** to the full path of `agy` (on Windows usually `%LOCALAPPDATA%\agy\bin\agy.exe`).

The **Agent** setting applies to new sessions. An empty new session that you haven't sent a message in yet switches straight away. Sessions you've already used stay on the agent they started with, because a conversation can't move between CLIs.

To start a single session on the other agent without changing the setting, Shift+click **+** and choose it in the **Agent** field of [Custom Session](./sessions#starting-a-new-session).

## What's different on Antigravity

| | Claude Code | Antigravity |
| --- | --- | --- |
| Models | Claude models, plus your `custom-models.json` | Whatever `agy models` lists: Gemini Flash variants, plus Claude and GPT-OSS models through Antigravity |
| Model picker default | Claude Sonnet | "Antigravity default", which lets Antigravity choose |
| Effort levels | When your Claude Code version supports them | Low to max |
| Chat only mode | Available | Available; switching into or out of it starts a new session |
| Standard mode | File edits allowed; read-only shell commands like `ls` allowed | File edits allowed; **all** shell commands denied |
| Read only mode | Reads files, no writes | Antigravity's plan mode: no writes |
| Context gauge and compact | Shown | Hidden: Antigravity doesn't report its context size or offer a compact command |
| `/usage` | Your Claude plan usage | Remaining weekly and 5-hour quota for each Antigravity model group |
| Session history | Read from Claude Code's own history | BojuBot keeps a transcript next to the session file |

**Cost per message.** Antigravity adds roughly 12,000 tokens of its own instructions to every message and doesn't report cache reads. That counts against your Antigravity quota, not your Claude plan. Run `/usage` to see what's left.

**Models from other providers.** Antigravity's quota is split into groups (for example "Gemini Models" and "Claude and GPT models"), each with its own weekly and 5-hour limit. Using a Claude model through Antigravity draws on Antigravity's quota, not your Claude subscription.

## Permissions on Antigravity

BojuBot runs Antigravity as one of its own Antigravity agents, which carry BojuBot's ground rules (plain `[[wikilinks]]`, built-in file tools rather than shell commands, renames through BojuBot) and set which tools Antigravity may use. [Permissions on each agent](./permissions#permissions-on-each-agent) compares every mode on Claude Code and Antigravity, and explains why switching into or out of Chat only starts a new session.

| Mode | Antigravity agent | How it's enforced |
| --- | --- | --- |
| **Chat only** | `bojubot-chat` | The agent only has web search and web pages. |
| **Read only** | `bojubot` | Antigravity's plan mode (`agy --mode plan`), which never writes to your vault. |
| **Standard** | `bojubot` | `agy --mode accept-edits`: notes can be created and edited, and every shell command is denied. When one is denied, the [denial card](./permissions#permission-denials) offers full access for the session. |
| **Full access** | none when the session starts in Full access; `bojubot` when it's switched to Full access later | `agy --dangerously-skip-permissions`. |

**Where the agents live.** BojuBot writes `bojubot.md` and `bojubot-chat.md` to Antigravity's agents folder in your home folder, `~/.gemini/config/agents/`, when it finds `agy`. It updates them when a new BojuBot version changes them, and never touches any other file there. They also appear in Antigravity's `/agents` list when you use `agy` on its own; you can ignore them there.

**Older Antigravity versions.** If your `agy` doesn't support agents (`agy --help` doesn't list `--agent`), or BojuBot can't write the files, sessions run without BojuBot's agents: Read only, Standard and Full access work as described above, without the ground rules, and Chat only isn't available.

**Allowing particular shell commands.** To allow commands such as `git` in Standard mode, add allow rules such as `command(git)` to Antigravity's own `~/.gemini/antigravity-cli/settings.json`. See [Antigravity permissions](https://antigravity.google/docs/permissions). These rules apply to all your `agy` use, not just BojuBot.

## Troubleshooting

**"Antigravity not found" when the panel opens.** Your default agent is Antigravity but BojuBot can't find `agy`. Install it, set **Antigravity binary path**, or switch **Agent** back to Claude Code, then click **Check again**.

**"Antigravity isn't signed in" or "Your Antigravity sign-in has expired."** Click **Open terminal** in the error card, or run `agy` in a terminal yourself, and sign in. Then send your message again. See [Signing in to Antigravity again](./troubleshooting#signing-in-to-antigravity-again).

**"Model not available."** The model saved for the session isn't in Antigravity's list any more. Pick another one from the model picker.

**It asks for full access to create a note.** Standard should allow file edits. If you still see this, check that you're in Standard mode, not Read only, and that you're on the latest BojuBot.

**"Chat only needs a new Antigravity session."** Antigravity can't add or remove a conversation's tools once it has started, so moving into or out of Chat only starts a new session. Your previous session is in the Sessions panel. See [Permissions on each agent](./permissions#changing-mode-on-antigravity).

**"Antigravity couldn't start this mode's agent."** Your Antigravity version doesn't accept one of BojuBot's agents, or an agent file was removed. Until Obsidian restarts, new Antigravity sessions start without BojuBot's agents and Chat only isn't available; send your message again. Updating BojuBot and `agy` usually fixes it.

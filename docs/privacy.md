# Privacy Policy

**App**: BojuBot  
**Developer**: Scott Kirvan  
**Effective date**: 2026-10-27

---

## The short version

BojuBot has no accounts, no analytics and no telemetry. It collects nothing about you: the little it records about your use (such as how many sessions you've started) stays on your computer. Its one service, for problem reports, only passes on reports you choose to send and stores nothing (see [Reporting a problem](#network-requests-bojubot-makes)).

BojuBot is a chat panel for an AI agent that runs on your own computer. What you send to that agent goes to the company behind it, under that company's privacy policy, not this one.

---

## The AI agent and where your words go

BojuBot doesn't talk to any AI service itself. It runs an agent CLI on your computer and passes your messages to it. You choose which one in the chat panel's model picker:

- **Claude Code**, made by Anthropic. See [Anthropic's privacy policy](https://www.anthropic.com/legal/privacy).
- **Antigravity CLI** (`agy`), made by Google. See [Google's privacy policy](https://policies.google.com/privacy).

The agent sends your requests to its provider. That includes:

- the messages you type
- anything you attach: notes, files, images, PDFs and web addresses
- the context BojuBot adds when a session starts, such as your vault's folder and file names and your context file
- with each message, the path of the note you have open (or, depending on your settings, of every open note in split or stacked view)
- any notes or files the agent reads or changes while it works, as your permission mode allows

You can turn off the context BojuBot adds with minimal mode, or per session.

**In Chat only, nothing from your vault is sent.** BojuBot adds no vault context and no open-note paths, doesn't answer the agent's vault queries, and only sends links as attachments: files, notes, selections and pasted screenshots are held back. What you type or paste into a message is still sent. See [Permissions](./guide/permissions#chat-only).

How the provider stores and uses that data is set by **their** policy and your account with them. Only use an agent you trust with your notes.

Each agent also keeps its own conversation history on your computer: Claude Code in `~/.claude/projects/`, and Antigravity in its own folder under `~/.gemini/`. Those files belong to the CLI, not to BojuBot.

## What BojuBot stores on your computer

Everything BojuBot saves stays on your computer: in your vault, in Obsidian's config folder (usually `.obsidian`), or, for Antigravity, in Antigravity's agents folder:

- **Session files.** A small JSON file per session with its name, settings and the agent's conversation ID, in `.obsidian/bojubot/sessions/` by default. You can choose another folder in settings.
- **Transcripts for Antigravity sessions.** Antigravity's own history can't be read back, so BojuBot keeps a copy of each conversation next to the session file (`<id>.transcript.jsonl`).
- **Settings.** Your BojuBot settings, in `.obsidian/plugins/bojubot/data.json`. The same file holds a few records about your use, described under [Analytics](#analytics-crash-reporting-and-telemetry), and your name if the agent learns it (when you tell it what to call you), so the welcome screen can greet you.
- **Attached images and PDFs.** Images and PDFs you attach with the attach button, drag in or paste as a screenshot are copied to `.obsidian/plugins/bojubot/tmp/` so the agent can read them. A file copied in your file manager and pasted is read where it is, not copied. BojuBot doesn't delete these copies; remove the folder's contents whenever you like.
- **The debug log.** Off by default. If you turn it on, BojuBot writes a log file, which can include the start of your messages (and, at verbose detail, the agent's raw output), to `.obsidian/plugins/bojubot/bojubot-debug.log` or the path you choose.
- **Open chat tabs.** Obsidian's workspace file (`.obsidian/workspace.json`) remembers which session each chat tab shows, so your tabs come back after a restart.
- **Antigravity agent definitions.** When Antigravity is installed, BojuBot writes two files to `~/.gemini/config/agents/`: `bojubot.md` and `bojubot-chat.md`. They hold BojuBot's rules for the agent (how to write links, which tools to use) and nothing about you or your vault. They're the only files BojuBot writes outside your vault, and BojuBot never changes any other file in that folder.
- **The command reference.** A list of your Obsidian commands, written to `.obsidian/plugins/bojubot/obsidian-commands.md` so the agent can look up command IDs.
- **The context file.** A note in your vault (`_claude-context.md` by default) that describes your vault to the agent. With autonomous memory on (the default), the agent updates this note itself as it learns. Turn autonomous memory off if your vault is shared or public.
- **Exports.** Session transcripts you choose to export are saved as notes where you tell BojuBot to put them.

If you sync or back up your vault, these files go wherever your vault goes.

## Network requests BojuBot makes

BojuBot itself makes no network requests, except when you click **Send** in the **Report a problem** form (see below). A few things you do can reach the internet:

- **The agent.** The agent CLI talks to its provider, as described above. Web addresses you attach are fetched by the agent, not by BojuBot.
- **Links.** Clicking a link in BojuBot opens that website in your browser.
- **Web images.** If a reply contains an image linked by web address, Obsidian downloads it when it's shown, as it would in any note.

**Reporting a problem.** BojuBot's **Report a problem** form sends nothing until you click **Send**. It fills in details to help with the report (BojuBot's version and build, your installed agents, the session's agent and model, your operating system, and an error message if there was one), and optionally the last lines of the debug log. You can edit or remove all of it. Then:

- **Send** sends the report, exactly as it appears in the form, to BojuBot's report service at `report.scottkirvan.com`. The service files it as a **public** issue on [BojuBot's GitHub repository](https://github.com/ScottKirvan/BojuBot/issues), where anyone can read it, under GitHub's own privacy policy. The service stores nothing: it doesn't keep reports or log their content or your IP address. It runs on Cloudflare, which sees each request as it passes through, as for any website on Cloudflare; see [Cloudflare's privacy policy](https://www.cloudflare.com/privacypolicy/). The issue is filed by BojuBot's GitHub app, not your GitHub account, so you don't need one.
- **Open on GitHub** opens a new GitHub issue in your browser with the report filled in. Nothing is sent until you submit it there, and once submitted it's a **public** issue that anyone can read, under GitHub's own privacy policy.
- **Copy report** copies the report to your clipboard, for you to send however you like.

Clicking the version information in the **Help & resources** dialog copies it to your clipboard; that stays on your computer.

## Analytics, crash reporting, and telemetry

None. Nothing about how you use BojuBot leaves your computer: it doesn't count users, report usage or send crash reports.

BojuBot does keep a few records in its settings file, only to decide when to show its occasional support message and thank-you card: how many sessions you've started, and when each message was last shown. So that only people who use BojuBot regularly are asked for support, it also checks how recently your saved sessions were used. None of this is ever sent anywhere. Turn on **Hide the support message** in settings to stop the support message.

## Third parties

BojuBot doesn't share data with anyone. The only third party involved is the agent provider you choose, and your data reaches them through their own CLI, under their own terms. A report you **Send** passes through Cloudflare and is published on GitHub, as described under [Reporting a problem](#network-requests-bojubot-makes).

## Children

BojuBot collects no information from anyone, regardless of age.

## Changes to this policy

If anything here changes, the updated policy will be posted at this URL with a new effective date, and the change will be listed in the [policy history](#policy-history) at the end of this page.

## Contact

Questions? Open an issue on [GitHub](https://github.com/ScottKirvan/BojuBot/issues) or ask on [Discord](https://discord.gg/TN6XJSNK5Y).

## Policy history

Every change to this policy, newest first. The version is the first BojuBot release that included the change.

| Date | Version | Change |
|---|---|---|
| 2026-10-27 | 3.8.0 | Listed the records BojuBot keeps on your computer to decide when to show its support message and thank-you card, and the name the agent learns for the welcome screen. |
| 2026-10-27 | 3.8.0 | Added **Send** to the Report a problem form: the first network request BojuBot makes itself, and only when you click it. Described the report service it uses (stores nothing, runs on Cloudflare) and that sent reports become public GitHub issues filed by BojuBot's GitHub app. The short version no longer says BojuBot has no servers, and Third parties now names Cloudflare and GitHub for sent reports. |
| 2026-10-26 | 3.8.0 | Added the Antigravity agent definitions BojuBot writes to `~/.gemini/config/agents/`, and the chat tabs Obsidian's workspace file remembers. |
| 2026-10-26 | 3.8.0 | Added what Chat only keeps from the agent: nothing from your vault is sent. |
| 2026-10-25 | 3.8.0 | Corrected which attached images and PDFs are copied into the plugin folder (and that the copies aren't deleted), and that the open note's path is sent with every message. |
| 2026-10-19 | 3.8.0 | Added the Report a problem form, which replaced the "planned" note: what it fills in (version, installed agents, agent and model, OS, error, optional debug log lines), that everything is editable, that **Open on GitHub** creates a public issue only when you submit it, and that **Copy report** and the Help & resources version information only copy to your clipboard. |
| 2026-10-17 | 3.8.0 | First published. |

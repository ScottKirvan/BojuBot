# Migrating from ObsidiBot to BojuBot — Session History Guide

Good news: your actual chat history is completely safe. The conversation content
lives in Claude's own data folder and isn't touched by this change. What needs
migrating is the session list (titles, order, timestamps) and your plugin settings.

---

## What's stored where

| Data | Location | Survives rename? |
|---|---|---|
| Chat history (actual messages) | `~/.claude/projects/` | ✅ Untouched |
| Session list (titles, timestamps) | `<vault>/.obsidian/obsidibot/sessions/` | ⚠️ Needs copying |
| Plugin settings | `<vault>/.obsidian/plugins/obsidibot/data.json` | ⚠️ Needs copying |

---

## Steps

**1. Install BojuBot**

Uninstall ObsidiBot and install BojuBot from the community plugins list. Your vault
and all your notes are unaffected.

**2. Copy your session list (Windows — PowerShell)**

Open PowerShell and run this, replacing the path with your actual vault location:

```powershell
$vault = "C:\path\to\your\vault"
New-Item -ItemType Directory -Force "$vault\.obsidian\bojubot\sessions" | Out-Null
Copy-Item "$vault\.obsidian\obsidibot\sessions\*" "$vault\.obsidian\bojubot\sessions\" -Force
```

**3. Copy your settings (Windows — PowerShell)**

```powershell
Copy-Item "$vault\.obsidian\plugins\obsidibot\data.json" `
          "$vault\.obsidian\plugins\bojubot\data.json" -Force
```

**4. Restart Obsidian**

Your session list, settings (API path, skills folder, permission mode, etc.), and
full chat history should all be restored.

---

## Finding your vault path

Not sure where your vault is? In Obsidian: **Settings → About → Current vault path**.

---

## If something looks wrong

If sessions show in the list but won't resume, the underlying chat history is still
intact in `~/.claude/projects/`. The session resume uses an ID that matches between
the session list and Claude's own history — if the IDs copied correctly, resume will
work. If a session shows but fails to resume, starting a new session is the fallback;
nothing is lost permanently.

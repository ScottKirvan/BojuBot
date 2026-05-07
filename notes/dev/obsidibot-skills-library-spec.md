# ObsidiBot Community Skills Library — Design Spec
Updated: 2026-05-02
## Overview

The ObsidiBot Skills Library is a community-driven repository of Claude Code skills that users can browse, install, and update directly within Obsidian. It is designed to be low-friction for contributors, reliable for users, and extensible as the ecosystem grows.

---

## What Is a Skill

A skill is a folder containing a `SKILL.md` file (the actual Claude Code instructions) plus supporting metadata. Skills are grouped into **libraries** — one contributor, one repo, one or more skills.

```
my-obsidibot-skills/
  library.json               ← single library manifest
  meeting-summarizer/
    SKILL.md
    README.md
  email-drafter/
    SKILL.md
    README.md
```

### library.json

```json
{
  "name": "Jane's Productivity Skills",
  "author": "janesmith",
  "version": "2.1.0",
  "description": "Skills for meetings, email, and daily review.",
  "repo": "janesmith/my-obsidibot-skills",
  "skills": [
    { "id": "meeting-summarizer", "path": "meeting-summarizer", "tags": ["meetings", "productivity"] },
    { "id": "email-drafter",      "path": "email-drafter",      "tags": ["email", "writing"] }
  ]
}
```

Version numbers are **library-level semver** — the contributor manages one version for their whole body of work, not per skill. Individual skill changes are tracked internally via checksums, not versioning.

---

## Registry

A single public GitHub repo — `ObsidiBot/skills-registry` — maintains an index of all published libraries. Each entry is a pointer to a contributor's library, not a copy of it.

### registry/index.json entry

```json
{
  "id": "janesmith-productivity",
  "name": "Jane's Productivity Skills",
  "author": "janesmith",
  "repo": "janesmith/my-obsidibot-skills",
  "version": "2.1.0",
  "tags": ["meetings", "productivity", "email"],
  "downloads": 1240
}
```

Skills are discovered at the library level. Individual skill metadata (tags, description, size) is read from `library.json` at install/browse time.

---

## Contributing — GitHub PR Path

This is the primary path for developers and technical contributors.

1. Create a GitHub repo with the folder structure above
2. Write your `SKILL.md` files and `library.json`
3. Submit a PR to `ObsidiBot/skills-registry` adding your entry to `index.json`
4. A GitHub Action validates:
   - `library.json` schema is correct
   - All listed skill paths exist and contain a `SKILL.md`
   - Version is valid semver
5. On merge, the Action resolves and stores the current HEAD SHA internally (invisible to the contributor)
6. Library is now listed in the marketplace

### Updating a Published Library

1. Push changes to your repo
2. Submit a PR to the registry bumping `version` in your entry
3. The Action re-validates and updates the internal SHA on merge

Contributors never manage git tags, releases, or per-skill versioning. The only thing they touch is a version string.

### First Submission Vetting

The initial PR receives a human review (Obsidian-style). Subsequent version updates merge automatically if the GitHub Action passes, with no further manual review required.

---

## Contributing — Web Upload Path

For non-developer contributors, a web portal at `scottkirvan.com/ObsidiBot/submit` accepts direct uploads.

- Fill out name, description, tags
- Paste `SKILL.md` content into a text area (one skill) or upload a zip (full library)
- An automated Claude-powered review checks for quality and completeness
- On approval, the skill lands in an ObsidiBot-managed repo and is registered automatically

Both paths produce the same registry entries and the same install experience on the user side.

---

## Marketplace — Discovery

### In-Vault Browser

A dedicated Obsidian sidebar panel shows the registry inside the app:

- Search bar and tag filters
- Cards showing library name, author, skill count, download count, brief description
- Preview pane rendering the `README.md` for any selected skill
- **Install** button at the library or individual skill level

### Web Browser

`scottkirvan.com/ObsidiBot/skills` — browsable and searchable for users who haven't installed yet, or who want to preview before installing.

---

## Installation

From the in-vault browser, clicking **Install**:

1. Plugin fetches `library.json` from the contributor's repo via `raw.githubusercontent.com` (plain HTTP, no git required)
2. Fetches each selected `SKILL.md` the same way
3. Writes files to `.obsidibot/skills/community/{library-id}/{skill-id}/`
4. Stores a **baseline checksum** of each `SKILL.md` locally — this represents "what was originally downloaded"
5. Skills are immediately available to Claude Code

Files land in the vault, making them portable, version-controllable with the user's own vault git setup, and directly editable in Obsidian.

---

## Update Detection — Client + Server

### The Problem with Client-Only

Direct GitHub API polling from each user's Obsidian instance is constrained by GitHub's unauthenticated rate limit of **60 requests/hour per IP address** — shared across all apps on the machine, including Obsidian itself and other tools. This is insufficient for users with large skill libraries.

### Server-Side Cache (Preferred)

A lightweight ObsidiBot server mediates all update checks:

- **GitHub webhooks** notify the server instantly when a registered library repo receives a push or release event
- The server updates its cache: current version, per-skill checksums, file sizes
- **Periodic polling** runs as a sanity check to catch any missed webhook events (server-side only — one rate limit to manage, not per-user)
- The client makes a single lightweight request: `GET /updates?libraries=id1,id2,id3` → receives a diff of what has changed

The server also handles download count tracking and community flagging/reporting.

### File Download

Actual `SKILL.md` file fetching on install or update still goes **direct** from the user's Obsidian to `raw.githubusercontent.com` — no API calls, no rate limits, no server involvement.

---

## Checksum Model and Update Flow

The local checksum represents the **original downloaded state**, not the current file state. This means:

| Local file state | Repo state | Result |
|---|---|---|
| Matches checksum | No change | Clean — nothing to do |
| Doesn't match checksum | No change | User has customized this skill — "modified" badge shown |
| Matches checksum | Updated in repo | Straightforward update available |
| Doesn't match checksum | Updated in repo | Conflict — user modified AND author updated |

### Update UI Flow

1. Server notifies client: "Jane's Productivity Skills — v2.1.1 available, 2 skills changed"
2. User expands to see which skills changed, with file size shown as a complexity indicator
3. Per-skill **Review Changes** button shows a diff of repo version vs user's current file
4. In conflict cases, the diff highlights both the user's customizations and the incoming changes
5. User accepts all, cherry-picks by skill, or skips

---

## File Size as Complexity Signal

File size of `SKILL.md` is surfaced in the marketplace and update UI as a rough complexity indicator — displayed as Small / Medium / Large rather than raw bytes. This gives users an intuitive sense of a skill's depth before installing, and is available for free from the server cache without any additional API calls.

---

## Architecture Summary

```
GitHub (contributor repos)
    ↓ webhooks / periodic poll
ObsidiBot Server
    ├── Registry cache (versions, checksums, sizes)
    ├── Download counts
    └── Update API → Obsidian plugin (one call per session)

raw.githubusercontent.com
    └── Direct file fetch → Obsidian plugin (install/update only)

ObsidiBot/skills-registry (GitHub repo)
    └── index.json → source of truth for registered libraries
```

---

## Open Questions / Future Considerations

- **GitHub token prompt** — for users who want to bypass the server and go direct, or as a fallback, prompt for a personal access token on first run (raises limit from 60 to 5,000/hour)
- **Cherry-pick installs** — installing individual skills from a library rather than the whole set; technically supported by the model but adds local state complexity
- **Verified badge** — editorial curation tier for high-quality skills without blocking open contribution
- **Web submission portal** — deferred until GitHub PR path is established and community is growing

---

## MVP Implementation Note

Start with **one repo, one skill** — don't implement the library model initially. The registry `path` field defaults to the repo root, so a contributor's entire repo is a single skill:

```
janesmith-meeting-summarizer/   ← whole repo is the skill
  SKILL.md
  README.md
  metadata.json
```

No `library.json` required. The GitHub Action just validates that `SKILL.md` exists at the specified path. This gets the contribution pipeline, registry, in-vault browser, and install flow working with minimal complexity.

The multi-skill library model is additive — when ready, contributors create a `library.json` and the path field points into subfolders. The registry format, install logic, and client code require no breaking changes. Ship the simple thing first; the spec above is where it's going.

# 👾 BojuBot Recipes & Skills Cookbook

This document is a master whiteboard and incubator for BojuBot recipes, prompt patterns, and packaged skills.

### Recommended Architecture: 3-Tier Model

```
┌────────────────────────────────────────────────────────┐
│ 1. The Starter Pack (Default Bundled: ~3 to 5 Skills)  │
│    Zero CLI dependencies · Universal · Instant delight │
├────────────────────────────────────────────────────────┤
│ 2. The Agent "Skill On-Demand" (Conversational Install)│
│    "Install the video chapter cutter skill for me"     │
├────────────────────────────────────────────────────────┤
│ 3. The BojuBot Cookbook (Documentation Site)           │
│    Browseable, searchable patterns with copyable YAML  │
└────────────────────────────────────────────────────────┘
```

#### 1. The Starter Pack (Ship 3–5 by default in `_BojuBot Skills/`)

Ship only skills that:

- Work **100% in Standard permission mode** (zero shell/CLI tools needed).
- Rely **only on the active note or user input** (no assumed vault folder structure).
- Demonstrate the power of parameterized frontmatter forms.

**Prime candidates for the default pack:**

- `/meeting-extractor`: Extracts decisions, checkboxes, and open questions from the active note.
- `/ugly-draft`: Takes messy thoughts or fragments and writes a rough, zero-fluff draft.
- `/three-doors`: The creative writing unblocker that offers 3 branching narrative paths.
- `/atomic-split`: Identifies distinct ideas in a long note and drafts links to split them.

_Bonus:_ These 3–5 files serve as living templates in the user's vault, showing them exactly how YAML frontmatter, `params:`, and `{{interpolation}}` work.

#### 2. The Cookbook in Documentation (`docs/cookbook/`)

Publish the full collection on the VitePress site organized by persona:

- **PKM & Daily Notes**
- **Creative Writing & Authorship**
- **Content Creators & Social**
- **Developer & GitHub Workflows**

Each recipe gets:

- The **Problem & Solution**
- A **Copyable Skill `.md` block**
- **Required Permission level** (`Standard` vs `Full Access`)
- **Prerequisites** (e.g. "Requires GitHub CLI `gh`" or "Requires `obsidian-kanban` plugin")

#### 3. Conversational Skill Installation (The "Agent Advantage")

Because BojuBot is an agent with vault file tools, you don't even need a complex marketplace UI!  
A user can simply ask in chat:

> _"I saw the 'Nightly Sweep' recipe in the cookbook. Can you set that up in my skills folder?"_

BojuBot can read the user's specific daily note format, customize the prompt for their vault, and write the skill file into `_BojuBot/skills/nightly-sweep.md` in 2 seconds.

---

### Strategy & Deployment Architecture
- **Source of Truth:** This file ([[notes/dev/BojuBot Cookbook.md|BojuBot Cookbook.md]]) serves as the master incubator and whiteboard.
- **Starter Pack:** Bundle 3 to 4 universal, zero-dependency skills by default in `_BojuBot Skills/`.
- **VitePress Docs:** Published across 8 numbered sections under `docs/cookbook/` between "Using BojuBot" and "Reference".
- **Agent Assisted Setup:** Allow users to request any recipe from chat and have BojuBot customize and write it into their skills folder.

### Standard Recipe Schema
When formalizing recipes from these ideas, follow this format (inspired by O'Reilly's classic cookbooks). If an item does not apply, explicitly mark it `None` or `N/A`:
- **Difficulty:** 🟢 `Beginner` (Zero config / Active note) · 🟡 `Intermediate` (Plugins / Vault structure) · 🔴 `Advanced` (CLI binaries / Full Access).
- **Problem:** The specific pain point or operational friction.
- **Solution:** How BojuBot solves it.
- **Prerequisites:** External CLIs, binaries, or community plugins required (`None` if standard).
- **Permission Level:** Required permission mode (`Standard` vs `Full Access / Shell`).
- **Context Workflow:** How context is provided (Active Note, @-mention, file picker, or selected snippet via `BojuBot: Send selection as context` / `Alt+S`).
- **Recipe / Skill:** The direct chat prompt or packaged `.BojuBot/skills/*.md` configuration. Include **Alternatives** where multiple valid approaches exist.
- **Discussion & Nuances:** Technical details, UI Bridge mechanics, or tips for customization.
- **See Also:** Related recipes, skills, or documentation pages (`None` if standalone).

---

## Section 1: Quick-Hit Conversational Recipes (`docs/cookbook/quick-hits.md`)
*Zero setup. Pure conversational interactions testing the UI Bridge, workspace control, and core agent capabilities.*

- **Identity & Permission Check:** `"Tell me about yourself"`. Then change permission mode in settings or status bar and ask again to verify behavioral boundary awareness.
- **Working Directory Verification:** `"What's your current working directory?"` or `"What's your cwd?"` (verifies vault root path resolution).
- **Daily Note Quick-Open:** `"Open today's daily note"`.
- **Split-View Comparison:** `"Open Note A side by side with Note B"`.
- **Theme Installation & Setup:** `"Install and set my theme to GitHubDHC"`.
- **Image Intelligence:**
  - Generate descriptive alt text for an image embedded in the active note.
  - OCR: Transcribe text from a pasted screenshot or document image.

---

## Part 2: Obsidian PKM & Core Vault Workflows

### 1. Daily Notes & Quick Capture Engine
*The daily driver for 80%+ of Obsidian users. Solves the "note graveyard" syndrome.*

- **The Nightly Sweep & Roll-Forward:**
  - Runs at the end of the day on your active Daily Note.
  - Carries forward all uncompleted tasks (`- [ ]`) into tomorrow's Daily Note (or master task list).
  - Extracts raw meeting notes or big brainstorms into linked standalone notes (`[[Meeting with Sarah]]`).
  - Leaves a clean, 3-bullet "Daily Summary" at the top of today's note.
- **The Meeting Notes Extractor:**
  - Point it at any raw, hurriedly typed meeting note.
  - Prepends an executive summary at the top:
    - **Decisions Made** (bold)
    - **Action Items** with owners and checkboxes (`- [ ] @Name: task by Date`)
    - **Open Questions / Parking Lot**
  - Keeps the raw transcript intact below.
- **The Inbox Triage & Smart Filer:**
  - Scans `Inbox/` or quick capture folder.
  - Adds proper YAML frontmatter (tags, date, status).
  - Suggests and injects 2–3 relevant vault wikilinks.
  - Moves the file to the appropriate destination folder (`Projects/`, `Readings/`, `Log/`).
- **The Atomic Note Splitter (Zettelkasten on Demand):**
  - Select a giant 2,000-word brain-dump.
  - Identifies 3–4 distinct core concepts.
  - Splits them into focused notes with clean titles and bidirectional wikilinks between them and back to the parent note.
- **Instant MOC (Map of Content) & Topic Hub Generator:**
  - Given a tag or folder, scans matching notes across the vault.
  - Generates an organized index note grouped by theme or status with one-line descriptions.

### 2. Vault Visualizations & Chart DSLs
*Drop data sources and schemas to generate charts and diagrams natively inside code blocks.*
- **Obsidian Charts:** YAML-based Chart.js for standard bar, line, and pie charts.
- **Vega-Lite:** Declarative JSON Grammar of Graphics for complex, multidimensional data.
- **Obsidian Tracker:** Vault-wide frontmatter and daily note trend tracking.
- **Native Mermaid (`xychart-beta`):** Built-in, zero-plugin bar and line charts.

### 3. Automated Kanban Boards
*Automating `obsidian-kanban` via plain markdown lists with checkbox syntax.*
- **Build from Scratch:** Query GitHub issues/PRs or vault tasks to generate an `obsidian-kanban` formatted note (`## Backlog`, `## In Progress`, `## In Review`, `## Done`).
- **Nightly / Standup Refresh:** Sweep closed PRs and moved project items on GitHub to update checkboxes or advance cards automatically.
- **Active Development Hook (`/kanban-advance`):** Moves an issue card to the next column when work completes or a PR is created.

### 4. Bi-Directional Canvas Workflows (Spatial Thinking)
*Bridging linear notes with spatial Canvas graphs.*
- **Note to Canvas Mindmap (Linear → Spatial):**
  - Point it at any dense, structured note (research paper, architecture spec, meeting notes).
  - Automatically generates an interactive `.canvas` file with color-coded nodes, text cards, and directional arrows.
- **Canvas to Synthesis Note (Spatial → Linear):**
  - Point it at a messy whiteboard `.canvas` file of stickies, links, and loose cards.
  - Reads the spatial graph structure and synthesizes a clean, cohesive, linear summary document.

### 5. Properties & Dataview Query Assistants
*Taming YAML metadata and dynamic queries.*
- **Plain English to Dataview DQL:**
  - Describe what you want to see (*"Show me all incomplete tasks tagged #urgent modified this month"*).
  - Generates the exact working ````dataview```` or ````dataviewjs```` codeblock.
- **Vault Frontmatter / Properties Normalizer:**
  - Audits a folder for messy or drifted YAML properties (e.g., standardizing `date` vs `created`, `status: done` vs `status: complete`).

### 6. Academic, Research & PDF Literature Notes
*Extracting deep structure from research papers and source documents.*
- **Literature Note & PDF Extractor:**
  - Attach a PDF or highlight note (or use `BojuBot: Send selection as context`).
  - Outputs a structured literature note: Core Thesis, Methodology, Key Findings, Critique, and Wikilinks to related vault concepts.
- **Synthesis Matrix Builder:**
  - Select 3–5 research notes on a topic; compiles a comparative Markdown matrix mapping out consensus, points of divergence, and methodology comparisons.

### 7. Live Web Research & Clip Synthesis
*Leveraging BojuBot's built-in web reading and search tools.*
- **URL to Structured Vault Brief:**
  - Paste any article, paper, or documentation URL.
  - Fetches the webpage, strips the ads/noise, summarizes takeaways into your note template, and suggests relevant vault links.

### 8. Second Brain Health & Vault Onboarding
*Understanding and maintaining large, mature vaults.*
- **Second Brain Health Audit & Tour:**
  - Analyzes folder distribution, link density, and tag usage.
  - Produces an executive briefing: top concept hubs, orphan notes (0 backlinks), stale projects, and high-frequency tags.

---

## Part 3: Writing, Authorship & Publishing

### 1. Creative Levers & Overcoming Writer's Block
*Psychological levers acting on the active note to eliminate decision paralysis and blank-page friction.*

- **The Three Doors (Decision Paralysis):**
  - Reads the last 300–500 words of your active note and offers three distinct continuations:
    - *Door 1 (Expected Path):* Natural, logical continuation of the argument or plot.
    - *Door 2 (Contrarian/Conflict Path):* A sudden objection, counter-argument, or narrative obstacle.
    - *Door 3 (The Wildcard):* A shift in focus, an unexpected anecdote, or perspective change.
- **The Ugly Draft Machine (The Inner Critic):**
  - Dump disorganized bullets, fragments, or rough voice transcriptions into chat.
  - Rewrites into an aggressively casual, zero-fluff, rough prose draft prioritizing momentum and clarity over polish.
- **Bridge the Chasm (Stuck Transitions):**
  - Given the ending of Section A and beginning of Section B, generates 3 bridge options:
    - *Conceptual bridge* (linking metaphor or shared premise).
    - *Rhetorical bridge* (question posed by Section A and answered by Section B).
    - *Structural bridge* (brief historical context, case study, or narrative pivot).
- **The Socratic Interview (Low-Energy Writing):**
  - Reads current progress and asks one probing question at a time.
  - Compiles your conversational or voice-to-text answers into a structured draft section.
- **The Metaphor Foundry (Dry or Abstract Text):**
  - Highlight an abstract concept or paragraph.
  - Returns 5 concrete, physical analogies drawn from varied domains (architecture, cooking, maritime, biology, carpentry).
- **The Devil's Advocate / Hostile Reader (Stale Thinking):**
  - Adopts the lens of a smart, skeptical critic to push back with 2–3 sharp objections to spark defensive writing momentum.
- **Oblique Strategies (Breaking Ruts):**
  - Injects Brian Eno-style arbitrary creative constraints (e.g., rewrite without the verb 'to be', cut first two sentences, explain as a hazard label).
- **Story Roulette:** Randomized creative writing prompt and narrative challenge generator.

### 2. Specialized Skills for the *aiXP* Book
*Tailored to https://aixp.scottkirvan.com/aiXP/ and its engineering/editorial rules.*

- **The Technical Writer's Practice Pattern Scaffolder:**
  - Scaffolds draft sections into the mandatory 5-part engineering anatomy: *Failure Mode → Mechanism → Production Artifact → Trade-offs → Boundary Conditions*.
  - Enforces strict rules (e.g., no the word "concrete" in headings).
- **The "Empirical Honesty" & Hype Auditor:**
  - Audits chapter drafts to flag breathless marketing phrasing, unverified claims, and softening of settled stances against vibe coding.
  - Flags distinctions between: *tested in production*, *adapted by analogy*, and *speculative*.
- **Sibling-Repo Case Extractor:**
  - Points at real Git commits, issue discussions, or diffs in sibling repos (`BojuBot`, `QuKi-Notes`, `ScooterGitTemplate`).
  - Formats real-world production findings into authentic **Field Case** narratives.
- **Typography & Guardrail Linter:**
  - Automated pre-commit check: ASCII hyphens only (no em-dashes `—`), no monospace/code in headings, no stacked headings without orienting text, title case headings, and expanded acronyms on first use.
- **Open Question Socratic Sparring Partner:**
  - Explores unresolved engineering questions from `notes/dev/open-questions.md` via peer-to-peer debate.
- **The "Bipedal Software" Tone Calibrator:**
  - Verifies authorial voice sounds like a practitioner with "dirt under their fingernails" speaking peer-to-peer to another engineer.
- **Dual-Target Pipeline Sanity Checker:**
  - Verifies new `PP.SS-slug.md` files are registered in `docs/.vitepress/config.mts`, heading IDs match preprocessor slugging (`ch-<file-slug>--<vitepress-slug>`), and Mermaid diagrams render in both SVG (EPUB) and vector PDF (print).

### 3. Multi-Format Self-Publishing (VitePress, EPUB, PDF)
*Ensuring vault markdown builds cleanly across web, e-readers, and print engines.*

- **Multi-Format Pre-Flight & Linting:**
  - Flags syntax that breaks Pandoc, Typst, or Calibre (Obsidian wikilinks vs markdown links, callout compatibility, broken image paths).
  - Typographic polisher: straight to curly quotes, em-dashes, ellipses, removing double spaces.
- **Manuscript Structure & Visual Navigation:**
  - **Book Arc & Chapter Outline Canvas:** Builds an interactive `.canvas` file showing book flow color-coded by draft stage or topic.
  - **Word Count & Velocity Tracker:** Compares word counts against targets and generates a progress bar or Vega-Lite burn-up chart.
  - **Chapter Re-Index & Renumbering Tool:** Adjusts sequence frontmatter, next/previous navigation links, and headings when chapters are reordered.
- **Editorial & Pipeline Automation:**
  - **Continuity & Style Guide Sentinel:** Cross-references drafts against the book glossary for terminology and timeline consistency.
  - **Pacing, Rhythm & Readability Audit:** Analyzes sentence variation and passive voice.
  - **Publication Build Trigger:** Dispatches `gh workflow run publish.yml` and reports build status.
  - **Errata & Beta-Reader Triage:** Converts incoming GitHub issue feedback into an in-vault editing checklist matched to chapters and paragraphs.

---

## Part 4: Content Studio & Creator Workflows

### 1. Bloggers & Content Marketing Workflows
*Turning Obsidian into an automated multi-platform publishing desk.*

- **The Content Atomizer (1 Pillar Post → 4 Formats):**
  - Reads a long post/chapter and generates a `## Promotional Kit`:
    - X / BlueSky thread (character-counted, hook + takeaways).
    - LinkedIn post (scannable paragraphs + call to action).
    - Newsletter teaser (curiosity-driven intro).
    - Hacker News / Reddit prompt (neutral technical discussion).
- **Cross-Post Platform Adapter:**
  - Prepares platform-ready markdown files with canonical URLs and frontmatter for Dev.to, Hashnode, Medium, or Ghost.
- **LinkedIn / Carousel Slide Generator:**
  - Extracts 5-step insights into slide-by-slide markdown cards formatted for quick PDF export.
- **Hook & Headline Lab:**
  - Pitches 5 psychological angles for titles and openers (Contrarian, Post-Mortem, Tactical How-To, Data/Observation, Manifesto).
- **Content Pipeline Kanban:**
  - Manages an `obsidian-kanban` board (`Ideas` → `Drafting` → `Ready to Post` → `Scheduled` → `Published`) synced to note frontmatter.
- **Vault Miner:**
  - Sweeps daily notes, meeting notes, and logs from the last 90 days to surface recurring themes and draft outlines.
- **Multi-Media Asset Generation:**
  - Automated OpenGraph (OG) social card generation (1200x630 PNG).
  - Code snippet to syntax-highlighted card (via `silicon` or `carbon-now-cli`).
  - Mermaid diagram to transparent high-res PNG for social feeds.
- **Content Hub Visual Canvas:**
  - Generates a visual `.canvas` map connecting pillar content to all derivative social posts and tracking metrics.
- **Audience Feedback Loop:**
  - Extracts debates and questions from social replies or Discord into `notes/dev/open-questions.md` or a `## Reader Reactions` section.

### 2. Video Creators (YouTube, TikTok, Shorts)
*Studio pre-production and post-production inside Obsidian.*

![](media/aeb34311-656a-4656-98d8-74070772fa53.png)

![](media/90125a93-5a6d-426f-9ab4-a5f06dada248.png)

- **Ideation & Packaging-First:**
  - **3-Second Hook Lab:** Generates 5 visual pattern interrupts designed to stop scrolling.
  - **Thumbnail & Title Matrix:** 4 visual concepts (left vs right composition, max 3–4 punchy words, Midjourney/diffusion image prompts).
  - **YouTube Comment Miner:** Pulls top comments and questions from competitor videos to source content gaps.
- **Canvas Storyboarding & Visual Beat Sheets:**
  - Generates an interactive `.canvas` file with color-coded cards:
    - 🟨 **Yellow:** Talking Head / Host on camera
    - 🟦 **Blue:** Screen recording / Code walk-through
    - 🟩 **Green:** B-roll / Demonstration
    - 🟥 **Red:** Retention spikes / pattern interrupts
  - Pacing & retention reviewer: flags stretches over 45 seconds without visual transitions.
- **Dual-Column AV Scriptwriting:**
  - Converts outlines into professional Audio/Visual production tables:
    | Time          | Visual / B-Roll (Left)        | Audio / Narration (Right)                               |
    | :------------ | :---------------------------- | :------------------------------------------------------ |
    | `0:00 - 0:08` | Quick cuts of terminal errors | "If you've ever watched an AI hallucinate 500 lines..." |
  - Teleprompter pacer (word-per-minute pacing, `[PAUSE]` cues).
  - B-Roll shot checklist generator.
- **Post-Production CLI Workflows (Full Access):**
  - **Automatic Chapter Timestamps:** Transcribes raw audio via local Whisper CLI and generates YouTube chapter blocks.
  - **SRT Subtitle Cleaner:** Fixes misheard technical jargon and code terms in Whisper `.srt` files.
  - **Vertical Clip Cutter (FFmpeg):** Cuts specified timestamp ranges into 9:16 vertical video for TikTok/Shorts.
  - **YouTube Metadata Bundle:** Titles, description, affiliate links, timestamps, pinned comment, and community poll.

---

## Part 5: Software Development & Agent Supervision

### 1. GitHub & Repository Telemetry
- **Commit Cadence & Burn-Up Charts:** Queries `git log` to plot commit velocity, churn, or milestone progress.
- **Contributor & Bot Velocity Split:** Visualizes human vs agent/bot PR merges over time.
- **Issue Health & Aging Matrix:** Scatterplot of issue age vs priority/labels to spot stale work.
- **PR Cycle Time Tracker:** Charts turnaround from PR open to merge.
- **Component Churn Heatmap:** Identifies high-risk files in `src/` edited most frequently.

### 2. Developer Cognition & "Where Was I?"
- **"Where Was I?" Context Re-Hydrator:** Inspects uncommitted changes, branch, last 3 commits, and stash list to generate a quick resumption briefing.
- **Work Session Flow Reconstructor:** Analyzes commit timestamps and diff sizes to log focused coding bursts into your daily note.
- **Bug Post-Mortem & Knowledge Base:** When bug issues close, parses diff and discussion to write a permanent "Lesson Learned" note.
- **Code Archaeologist (`git log -S` / `git blame`):** Traces the narrative history of why a tricky function or rule was originally created.

### 3. Code Documentation Workflows (VitePress & Vault)
- **Code-to-Doc Drift Auditor:** Flags when changes in `src/` outpace docs in `docs/guide/` and drafts missing sections.
- **VitePress Sidebar Auto-Sync:** Inserts newly created markdown guides into `docs/.vitepress/config.js` sidebar categories.
- **PR / Feature-to-Doc Drafter:** Reads merged PR diffs and writes user-facing documentation in VitePress format.
- **Changelog & GitHub Release Synthesizer:** Groups conventional commits into `docs/changelog.md` and draft release announcements.
- **README & Guide Harmonizer:** Keeps root `README.md` and `docs/guide/` install instructions synchronized.
- **Broken Link & Cross-Reference Checker:** Validates internal markdown links and anchor targets across `docs/`.
- **Discord / User Question to FAQ Drafter:** Converts community troubleshooting threads into `docs/guide/troubleshooting.md` entries.
- **AGENTS.md Protocol & Feedback Maintainer:** Periodically reads `AGENTS_FEEDBACK.md`, proposes edits to `AGENTS.md`, and clears resolved logs.

### 4. Agent & Subagent Supervision
*Tailored for multi-agent workflows and autonomous subagent orchestration.*
- **Agent Assignment Generator:** Selects unassigned issues, checks `AGENTS.md`, and drafts turnkey briefs with reproduction steps and pre-flight checks.
- **Autonomous PR Reviewer & Sanity Checker:** Verifies bot PRs followed conventional commits, included regression checklists, and passed tests.
- **Agent Velocity & Cost Log:** Charts agent issue resolution rates, token consumption, and iterations per ticket.

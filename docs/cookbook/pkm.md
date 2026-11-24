# 2. Daily Notes & PKM

This section covers essential Personal Knowledge Management recipes: automating daily notes, capturing meetings, decomposing atomic notes, bridging Canvas mindmaps, and managing vault-wide metadata.

---

## Recipe 2.1: The Nightly Sweep & Roll-Forward

- **Difficulty:** 🟡 Intermediate
- **Problem:** Daily notes easily become disorganized "note graveyards." Uncompleted tasks linger, raw meeting snippets remain unfiled, and you lose momentum for tomorrow.
- **Solution:** Audits today's daily note, rolls open `- [ ]` tasks into tomorrow's note, extracts meeting sections into linked notes, and leaves a 3-bullet executive summary.
- **Prerequisites:** Daily Notes core plugin or Periodic Notes enabled.
- **Permission Level:** `Standard`
- **Context Workflow:** Active Note (run while focused on today's daily note).
- **Recipe / Skill:** Save as `nightly-sweep.md`:
  ```markdown
  ---
  category: Daily Notes
  description: Roll forward open tasks and extract meeting notes from today's daily note
  autorun: true
  ---
  Analyze my active daily note. Perform the following end-of-day maintenance:

  1. **Roll-Forward Tasks:** Find all incomplete tasks (`- [ ]`). Append them under a `## Rolled Over` section in tomorrow's daily note. If tomorrow's daily note does not exist yet, create it following my vault's daily note date naming convention.
  2. **Extract Key Discussions:** If there are raw meeting notes or standalone brainstorms exceeding 10 lines, extract them into a new note named after the topic/meeting, link it back in today's note using a wikilink, and replace the raw section with a 2-sentence summary.
  3. **Daily Summary:** Prepend a clean `## Day in Review` section at the top of today's note with exactly 3 bullet points summarizing what was accomplished.

  Notify me in Obsidian once the sweep is complete.
  ```
- **Discussion & Nuances:** 
  > [!TIP] Customizing Date Schemes
  > BojuBot automatically inspects `.obsidian/daily-notes.json` to detect your date format (e.g. `YYYY-MM-DD` vs `DD-MM-YYYY`) and folder location. If you store daily notes in nested folders (like `Calendar/2026/04/`), the prompt follows that pattern automatically.
- **See Also:** [Recipe 2.2: The Meeting Notes Extractor](#recipe-2-2-the-meeting-notes-extractor), [Recipe 2.7: The Inbox Triage & Smart Filer](#recipe-2-7-the-inbox-triage-smart-filer)

---

## Recipe 2.2: The Meeting Notes Extractor

- **Difficulty:** 🟢 Beginner
- **Problem:** Hurriedly typed meeting notes bury decisions and action items inside blocks of disorganized conversational text.
- **Solution:** Prepends an executive summary block to the top of the meeting note (Decisions Made, Action Items with checkboxes, and Open Questions), preserving raw notes below.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** Active Note, or highlight text and press `Alt+S` (`BojuBot: Send selection as context`).
- **Recipe / Skill:** Save as `meeting-extractor.md`:
  ```markdown
  ---
  category: Workflows
  description: Extract decisions, action items, and open questions from the active note
  autorun: true
  ---
  Review the active note (or provided selection) containing meeting notes. 

  Insert an executive summary block at the very top of the note (immediately below any YAML frontmatter):

  ## Executive Summary
  ### Decisions Made
  - [List concrete decisions agreed upon; bold key outcomes]

  ### Action Items
  - [ ] @[Owner]: [Concrete task description] (Target: [Deadline if stated, otherwise TBD])

  ### Open Questions & Parking Lot
  - [Unresolved debates, dependencies, or questions deferred to later]

  ---

  Leave the original meeting transcript/notes intact below this line.
  ```
- **Discussion & Nuances:** 
  > [!TIP] Partial Selections via Hotkey
  > If a note contains multiple meetings or a sprawling agenda, highlight just the portion you want to summarize and press `Alt+S` (the hotkey for `BojuBot: Send selection as context`). The skill will summarize only the highlighted text.
- **See Also:** [Recipe 2.1: The Nightly Sweep & Roll-Forward](#recipe-2-1-the-nightly-sweep-roll-forward), [Recipe 8.4: Automated GitHub Issue Kanban Sync](./development.md#recipe-8-4-automated-github-issue-kanban-sync)

---

## Recipe 2.3: The Atomic Note Splitter (Zettelkasten on Demand)

- **Difficulty:** 🟢 Beginner
- **Problem:** Sprawling 2,000-word brain-dumps are difficult to navigate and impossible to link modularly.
- **Solution:** Identifies 3 to 5 core concepts, creates individual self-contained notes with bidirectional wikilinks, and leaves a clean index outline in the parent note.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** Active Note.
- **Recipe / Skill:** Save as `atomic-splitter.md`:
  ```markdown
  ---
  category: PKM
  description: Split a sprawling note into atomic concept notes with bidirectional links
  params:
    - id: target_folder
      type: input
      label: Destination folder
      placeholder: Leave blank to store alongside parent note
  ---
  Analyze the active note and break it down into atomic, single-concept notes:

  1. Identify 3 to 5 core standalone concepts or arguments.
  2. For each concept:
     - Create a new note in `{{target_folder}}` (or current directory if blank).
     - Use a concise, descriptive title (e.g. `Concept Name.md`).
     - Write a self-contained explanation (2–4 paragraphs) incorporating the relevant text from the parent note.
     - Include a link back to `[[{{active_note}}]]`.
  3. In the original parent note, replace the extracted sections with a clean outline of `[[wikilinks]]`, each accompanied by a 1-sentence summary of the linked note.

  Open the parent note when finished.
  ```
- **Discussion & Nuances:** 
  > [!NOTE] Graph View Integration
  > Because BojuBot writes standard `[[wikilinks]]`, Obsidian's local Graph view and Backlinks tab immediately light up with connections to the new atomic notes.
- **See Also:** [Recipe 2.8: Instant MOC & Topic Hub Generator](#recipe-2-8-instant-moc-map-of-content-topic-hub-generator), [Recipe 2.4: Note to Canvas Mindmap](#recipe-2-4-note-to-canvas-mindmap-linear-→-spatial)

---

## Recipe 2.4: Note to Canvas Mindmap (Linear → Spatial)

- **Difficulty:** 🟢 Beginner
- **Problem:** Linear text fails to communicate non-linear dependencies, parallel workflows, and structural hierarchies.
- **Solution:** Converts a structured Markdown document into an interactive, color-coded `.canvas` visual graph.
- **Prerequisites:** None (Obsidian core Canvas feature).
- **Permission Level:** `Standard`
- **Context Workflow:** Active Note.
- **Recipe / Skill:** Save as `note-to-canvas.md`:
  ```markdown
  ---
  category: Canvas
  description: Convert the active note into an interactive Obsidian Canvas mindmap
  autorun: true
  ---
  Analyze the structure and headings of the active note.

  Generate a new `.canvas` file in the same folder named `[NoteTitle] - Mindmap.canvas`.
  - Create a central hub card representing the main topic (color: purple).
  - For each H2 heading, create a card positioned radially or hierarchically (color: blue).
  - For subheadings or critical takeaways, create child cards (color: yellow or green).
  - Connect the cards with directional arrows (`edges`) representing logical flow and hierarchy.
  - Ensure node coordinates (x, y) do not overlap and leave clean spacing (min 60px gap).

  Once written, open the canvas file in Obsidian.
  ```
- **Discussion & Nuances:** 
  > [!TIP] Visual Navigation
  > BojuBot emits the `open-file` action via the UI Bridge to switch your active tab directly to the newly created Canvas as soon as it finishes generating.
- **See Also:** [Recipe 2.5: Canvas to Synthesis Note](#recipe-2-5-canvas-to-synthesis-note-spatial-→-linear), [Recipe 2.3: The Atomic Note Splitter](#recipe-2-3-the-atomic-note-splitter-zettelkasten-on-demand)

---

## Recipe 2.5: Canvas to Synthesis Note (Spatial → Linear)

- **Difficulty:** 🟢 Beginner
- **Problem:** Visual whiteboards are great for brainstorming, but cannot easily be published or read as linear documentation.
- **Solution:** Traverses a `.canvas` file's nodes and edges, synthesizing card clusters into a coherent Markdown document.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** Active Note (focused on an active `.canvas` tab).
- **Recipe / Skill:** Save as `canvas-to-note.md`:
  ```markdown
  ---
  category: Canvas
  description: Synthesize an active Canvas board into a structured linear markdown note
  autorun: true
  ---
  Read the active `.canvas` file. 

  Trace the nodes and directional connections:
  1. Identify the central premise or starting nodes.
  2. Follow connection edges to determine narrative or procedural flow.
  3. Group neighboring/clustered cards into cohesive sections.
  4. Synthesize the text into a polished, linear Markdown document with proper headings, lists, and bullet points.

  Save the result as `[CanvasName] - Summary.md` and open it side by side.
  ```
- **Discussion & Nuances:** Reads both floating text nodes and embedded note cards within the Canvas.
- **See Also:** [Recipe 2.4: Note to Canvas Mindmap](#recipe-2-4-note-to-canvas-mindmap-linear-→-spatial)

---

## Recipe 2.6: Plain English to Dataview DQL Assistant

- **Difficulty:** 🟡 Intermediate
- **Problem:** Writing complex Dataview DQL queries with WHERE filters, regexes, and date math has a steep syntax curve.
- **Solution:** Translates natural language requests into production-ready Dataview or DataviewJS codeblocks.
- **Prerequisites:** Community plugin `dataview`.
- **Permission Level:** `Standard`
- **Context Workflow:** None / Modal input.
- **Recipe / Skill:** Save as `dataview-builder.md`:
  ```markdown
  ---
  category: Utilities
  description: Translate a natural language request into a working Dataview query
  params:
    - id: request
      type: textarea
      label: What do you want to query?
      placeholder: e.g. Show all unfinished tasks tagged #urgent modified this month, sorted by due date
  ---
  You are an expert in Obsidian Dataview syntax (DQL).

  Generate a working ```dataview or ```dataviewjs codeblock that satisfies this request:
  "{{request}}"

  Provide:
  1. The exact codeblock ready to paste into Obsidian.
  2. A brief breakdown of what each clause (`TABLE`/`TASK`/`LIST`, `FROM`, `WHERE`, `SORT`) does.
  3. Any assumed YAML frontmatter fields required for the query to return results.
  ```
- **Discussion & Nuances:** 
  > [!NOTE] Plugin Required
  > Dataview queries require the `dataview` community plugin to be installed and enabled in Obsidian settings. Without the plugin, the query block will display as plain code.
- **See Also:** [Recipe 2.9: Vault Frontmatter & Properties Normalizer](#recipe-2-9-vault-frontmatter-properties-normalizer)

---

## Recipe 2.7: The Inbox Triage & Smart Filer

- **Difficulty:** 🟡 Intermediate
- **Problem:** Web clippings, voice transcripts, and quick thoughts accumulate in `Inbox/` without tags, links, or organization.
- **Solution:** Audits inbox notes, populates YAML frontmatter, identifies related vault notes to link, and moves files to their permanent folders.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** None / Modal input.
- **Recipe / Skill:** Save as `inbox-triage.md`:
  ```markdown
  ---
  category: PKM
  description: Triage notes in the Inbox folder, adding frontmatter, tags, and moving them to the right location
  params:
    - id: inbox_folder
      type: input
      label: Inbox folder path
      default: Inbox
  ---
  Scan unorganized notes in `{{inbox_folder}}`. For each unfiled note:
  1. Read the note content and summarize the core subject in 1 sentence.
  2. Ensure valid YAML frontmatter:
     - Add a descriptive `title:`
     - Set `created:` date
     - Add 2–3 relevant `tags:`
  3. Search the vault to suggest 2 existing related notes and add them as `## Related Notes` wikilinks.
  4. Move the file from `{{inbox_folder}}` to the most appropriate vault folder (e.g. `Projects/`, `Readings/`, or `Resources/`).

  Report a summary checklist of all moved notes.
  ```
- **Discussion & Nuances:** 
  > [!TIP] Adapting Folder Paths
  > If your vault uses a different capture location (such as `00_Inbox/` or `Scratch/`), simply edit the `default: Inbox` field in the frontmatter before running.
- **See Also:** [Recipe 2.8: Instant MOC & Topic Hub Generator](#recipe-2-8-instant-moc-map-of-content-topic-hub-generator), [Recipe 2.1: The Nightly Sweep & Roll-Forward](#recipe-2-1-the-nightly-sweep-roll-forward)

---

## Recipe 2.8: Instant MOC (Map of Content) & Topic Hub Generator

- **Difficulty:** 🟢 Beginner
- **Problem:** Related notes scattered across folders are difficult to see in one unified dashboard.
- **Solution:** Gathers all notes matching a tag or folder into an index hub note organized by sub-theme or status.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** None / Modal input.
- **Recipe / Skill:** Save as `generate-moc.md`:
  ```markdown
  ---
  category: PKM
  description: Generate an index Map of Content (MOC) note for a specific tag or folder
  params:
    - id: topic
      type: input
      label: Topic, Tag (#tag), or Folder
      placeholder: e.g. #writing or Projects/Apollo
  ---
  Scan all notes across the vault matching "{{topic}}".

  Create a new index note named `{{topic}} - MOC.md`:
  1. Group the matched notes into logical categories or status stages (e.g. Active, Completed, Reference).
  2. For each note, insert a `[[wikilink]]` accompanied by a concise 1-sentence description extracted from its frontmatter or opening paragraph.
  3. Include an empty `## Key Takeaways & Milestones` section at the top for personal synthesis.

  Open the newly created MOC note in Obsidian.
  ```
- **Discussion & Nuances:** Can be pinned to your Obsidian sidebar to serve as a persistent project index.
- **See Also:** [Recipe 2.3: The Atomic Note Splitter](#recipe-2-3-the-atomic-note-splitter-zettelkasten-on-demand)

---

## Recipe 2.9: Vault Frontmatter & Properties Normalizer

- **Difficulty:** 🟡 Intermediate
- **Problem:** Inconsistent frontmatter keys (e.g. `date:` vs `created:`, `tag:` vs `tags:`) break queries and filter views.
- **Solution:** Standardizes property keys and formats across all files in a folder.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** None / Modal input.
- **Recipe / Skill:** Save as `normalize-properties.md`:
  ```markdown
  ---
  category: Maintenance
  description: Audit and normalize YAML frontmatter property keys across a target folder
  params:
    - id: target_folder
      type: input
      label: Folder to audit
      placeholder: e.g. Daily/ or Readings/
  ---
  Audit the YAML frontmatter of all markdown notes in `{{target_folder}}`.

  Standardize property keys:
  - Rename `created:` or `created_at:` to `date:` (preserving value).
  - Standardize status values (e.g. convert `complete` to `done`).
  - Ensure all tags are formatted as an array under `tags:`.

  Report all modifications made with a before/after diff summary.
  ```
- **Discussion & Nuances:** 
  > [!TIP] Testing on a Sandbox Folder
  > We recommend running this on a small test subfolder or backup first to verify that your Dataview queries match the normalized property keys.
- **See Also:** [Recipe 2.6: Plain English to Dataview DQL Assistant](#recipe-2-6-plain-english-to-dataview-dql-assistant)

---

## Recipe 2.10: URL to Structured Vault Brief

- **Difficulty:** 🟢 Beginner
- **Problem:** Saving web links creates bookmarks you never read; saving raw web HTML dumps ads, sidebars, and formatting junk into your vault.
- **Solution:** Fetches a live URL via BojuBot's web tools, strips the fluff, formats an executive summary, and generates 5 key takeaways with vault links.
- **Prerequisites:** None (BojuBot built-in web fetch).
- **Permission Level:** `Standard`
- **Context Workflow:** Chat prompt.
- **Recipe / Skill:** Direct chat prompt:
  ```text
  Fetch and summarize this URL: [paste URL]. 
  Create a new note in Readings/ using the title of the article. 
  Prepend YAML frontmatter with source: [URL], date: [today], and tags: [reading]. 
  Write an executive summary, 5 key takeaways as bullet points, and 2 questions this article raises for my own projects.
  ```
- **Discussion & Nuances:** Runs directly in chat with zero external browser extensions required.
- **See Also:** [Recipe 2.7: The Inbox Triage & Smart Filer](#recipe-2-7-the-inbox-triage-smart-filer)

---

## Recipe 2.11: Second Brain Health Audit & Tour

- **Difficulty:** 🟢 Beginner
- **Problem:** Mature vaults develop hidden dead zones, orphan notes with no links, and neglected projects.
- **Solution:** Produces an executive briefing outlining top hubs, orphan notes (0 backlinks), stale projects, and tag usage.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** None.
- **Recipe / Skill:** Save as `vault-audit.md`:
  ```markdown
  ---
  category: Maintenance
  description: Generate an executive health audit of vault structure, orphan notes, and link hubs
  autorun: true
  ---
  Perform a high-level health audit across the vault:
  1. **Top Hubs:** Identify the 5 most heavily backlinked notes in the vault.
  2. **Orphan Notes:** List notes that have zero incoming backlinks and zero outgoing links.
  3. **Stale Projects:** Identify project notes that have not had modifications in over 60 days.
  4. **Tag Concentration:** Identify the top 5 most frequently used tags.

  Write the report to `Vault Health Report - [YYYY-MM-DD].md` and open it side by side.
  ```
- **Discussion & Nuances:** Helps you prune dead notes or spot high-value conceptual connections.
- **See Also:** [Recipe 2.8: Instant MOC & Topic Hub Generator](#recipe-2-8-instant-moc-map-of-content-topic-hub-generator)

---

## Recipe 2.12: Vault Visualization & Chart DSL Generator

- **Difficulty:** 🟡 Intermediate
- **Problem:** Visualizing trends or metrics in Obsidian requires memorizing complex YAML syntax for Chart.js or JSON for Vega-Lite.
- **Solution:** Converts rough tables or descriptions into working codeblocks for native Mermaid `xychart-beta` or Obsidian Charts.
- **Prerequisites:** Community plugin `obsidian-charts` (optional, only if selecting Chart.js).
- **Permission Level:** `Standard`
- **Context Workflow:** None / Modal input.
- **Recipe / Skill:** Save as `chart-generator.md`:
  ```markdown
  ---
  category: Visualizations
  description: Generate native Mermaid xychart-beta or Obsidian Charts from markdown data
  params:
    - id: chart_type
      type: dropdown
      label: Chart Engine
      options:
        - Mermaid xychart-beta (zero-plugin built-in)
        - Obsidian Charts (Chart.js plugin)
    - id: data_description
      type: textarea
      label: Data description or table
      placeholder: e.g. Monthly book sales from Jan to Jun: Jan: 24, Feb: 35, Mar: 60, Apr: 80, May: 110, Jun: 140
  ---
  You are an expert in Obsidian charting DSLs.

  Convert the following data description into a clean, working chart using {{chart_type}}:

  <data>
  {{data_description}}
  </data>

  Provide the exact codeblock formatted for Obsidian, with labeled axes and clean title metadata.
  ```
- **Discussion & Nuances:** 
  > [!TIP] Zero-Plugin Option
  > Selecting `Mermaid xychart-beta` requires zero community plugins—it renders out of the box in modern Obsidian releases.
- **See Also:** None.

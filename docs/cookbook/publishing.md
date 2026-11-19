# 5. Books & Long-Form Publishing

Workflows and linters for authors producing long-form manuscripts, technical books, and multi-channel publication pipelines (VitePress web, Pandoc EPUB, Typst/LaTeX print).

---

## Recipe 5.1: The Technical Writer's Practice Pattern Scaffolder

- **Difficulty:** 🟢 Beginner
- **Problem:** Technical practices in software books easily slip into vague, hand-waving advice that lacks concrete engineering rigor.
- **Solution:** Scaffolds any raw practice into a strict 5-part engineering anatomy: Terminal Failure Mode, Mechanism, Production Artifact, Trade-offs, and Boundary Conditions.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** None / Modal input.
- **Recipe / Skill:** Save as `pattern-scaffolder.md`:
  ```markdown
  ---
  category: Engineering Writing
  description: Scaffold a raw practice into the mandatory 5-part engineering pattern
  params:
    - id: practice_name
      type: input
      label: Practice Name
      placeholder: e.g. Subprocess Memory Compaction
    - id: core_idea
      type: textarea
      label: Core Idea & Production Context
  ---
  Scaffold the practice "{{practice_name}}" into the mandatory 5-part engineering anatomy:

  ## {{practice_name}}

  ### 1. Terminal Failure Mode
  [What catastrophic or degrading failure mode occurs in production when this practice is ignored?]

  ### 2. Operational Mechanism
  [How does this practice actually function under the hood? Explain the mechanism peer-to-peer.]

  ### 3. Production Artifact
  [What tangible, verifiable file, test, log, or commit exists to prove this practice was executed?]

  ### 4. Direct Trade-offs
  [What friction, cognitive load, or performance cost does adopting this introduce?]

  ### 5. Boundary Conditions
  [Under what specific conditions or scales does this practice become counter-productive or overkill?]

  Draft this section directly into the active note. Enforce the editorial rule: **never use the word "concrete" in headings**.
  ```
- **Discussion & Nuances:** 
  > [!NOTE] Proven Book Architecture
  > Modeled directly on the engineering structure used in books like *aiXP* and classic O'Reilly series.
- **See Also:** [Recipe 5.2: The "Empirical Honesty" & Hype Auditor](#recipe-5-2-the-empirical-honesty-hype-auditor)

---

## Recipe 5.2: The "Empirical Honesty" & Hype Auditor

- **Difficulty:** 🟢 Beginner
- **Problem:** Technical manuscripts frequently slip into breathless marketing buzzwords (*"unlock"*, *"game-changing"*, *"effortless"*) or present untested speculations as settled facts.
- **Solution:** Ruthlessly audits the active chapter, flagging hype words, classifying epistemic claims (tested vs. adapted vs. speculative), and verifying authorial stance.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** Active Note.
- **Recipe / Skill:** Save as `hype-auditor.md`:
  ```markdown
  ---
  category: Editorial
  description: Audit the active chapter for hype language, buzzwords, and ungrounded claims
  autorun: true
  ---
  Perform a strict "Empirical Honesty" audit on the active text:

  1. **Hype Sweep:** Highlight and flag any breathless buzzwords (*unlock, game-changing, 10x, seamless, revolutionize, effortless*).
  2. **Epistemic Labeling:** For each major claim, flag whether it is presented as:
     - *Tested in production* (backed by concrete repo cases or measurements)
     - *Adapted by analogy* (borrowed from XP/SRE/manufacturing)
     - *Speculative* (an untested hypothesis)
  3. **Settled Stance Check:** Flag any passive softening of core stances (e.g. appearing too accommodating of unverified vibe-coding).

  Provide a redline checklist of passages needing a firmer, more grounded authorial voice.
  ```
- **Discussion & Nuances:** Maintains a peer-to-peer, engineer-with-"dirt-under-their-fingernails" tone.
- **See Also:** [Recipe 5.1: The Technical Writer's Practice Pattern Scaffolder](#recipe-5-1-the-technical-writer-s-practice-pattern-scaffolder)

---

## Recipe 5.3: Sibling-Repo Field Case Extractor

- **Difficulty:** 🔴 Advanced
- **Problem:** Readers distrust contrived, toy code examples. High-integrity engineering writing requires examples drawn from real Git histories and production bugs.
- **Solution:** Inspects real Git commits, PR discussions, and diffs across local repositories to generate an authentic "Field Case" narrative formatted for the book.
- **Prerequisites:** Git repository initialized and accessible.
- **Permission Level:** `Full Access / Shell`
- **Context Workflow:** Chat prompt.
- **Recipe / Skill:** Direct chat prompt:
  ```text
  Point at the last 5 commits in this repo that resolved the subprocess crash incident. 
  Extract the incident timeline, the terminal diff, and the architectural lesson learned into a clean Field Case narrative formatted for Chapter 3.
  ```
- **Discussion & Nuances:** 
  > [!NOTE] Git Repository Required
  > This recipe requires your vault or workspace to be tracked in Git. Real-world incident narratives carry significantly more credibility with practitioner readers than synthetic examples.
- **See Also:** [Recipe 8.6: Code Archaeologist (Developer Workflows)](./development.md#recipe-8-6-code-archaeologist-why-does-this-line-exist)

---

## Recipe 5.4: Multi-Format Pre-Flight Linter (Pandoc / Typst / EPUB)

- **Difficulty:** 🟢 Beginner
- **Problem:** Markdown written in Obsidian often breaks external compilation engines (Pandoc, Typst, LaTeX, Calibre) due to wikilinks, callouts, and straight quotes.
- **Solution:** Scans the active chapter for syntax errors that crash publishing pipelines, generating a pre-flight checklist.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** Active Note.
- **Recipe / Skill:** Save as `preflight-linter.md`:
  ```markdown
  ---
  category: Publishing
  description: Audit the active chapter for syntax that breaks EPUB, PDF, and static site compilers
  autorun: true
  ---
  Perform a strict pre-flight publication audit on the active note. Check for:

  1. **Link Syntax:** Flag any bare wikilinks (`[[Note]]`) that must be converted to standard relative Markdown (`[Title](./note.md)`).
  2. **Typography Standards:** Flag straight quotes (`"`, `'`) that should be curly, double hyphens (`--`), or unescaped HTML tags.
  3. **Callout Compatibility:** Flag any `> [!NOTE]` callouts if targeting pure Pandoc/LaTeX pipelines.
  4. **Image References:** Verify that all image paths are relative and exist in the vault media folder.
  5. **Heading Structure:** Ensure there are no stacked headings (H2 immediately followed by H3 without body text) and that all headings use Title Case.

  Report a checklist of required fixes before building.
  ```
- **Discussion & Nuances:** Prevents CI/CD build failures when pushing manuscripts to GitHub Actions e-book workflows.
- **See Also:** [Recipe 5.7: Dual-Target Pipeline Sanity Checker](#recipe-5-7-dual-target-pipeline-sanity-checker)

---

## Recipe 5.5: Book Arc & Chapter Outline Canvas

- **Difficulty:** 🟡 Intermediate
- **Problem:** Visualizing the narrative pacing, draft stages, and word counts across 15+ chapter files is impossible in a linear file explorer.
- **Solution:** Automatically compiles an interactive `.canvas` file showing the entire book arc with color-coded draft stages.
- **Prerequisites:** None (Obsidian Canvas).
- **Permission Level:** `Standard`
- **Context Workflow:** None / Modal input.
- **Recipe / Skill:** Save as `book-arc-canvas.md`:
  ```markdown
  ---
  category: Book Publishing
  description: Build a visual Canvas board mapping all chapters color-coded by draft stage
  params:
    - id: chapters_folder
      type: input
      label: Chapters directory
      default: Chapters/
  ---
  Scan all chapter markdown files in `{{chapters_folder}}`.

  Generate `Book Arc - Visual Roadmap.canvas`:
  - Create a card for each chapter reading its `order:` and title.
  - Color code cards by `status:` (Yellow = Draft, Blue = In Review, Green = Finished).
  - Connect the cards sequentially with flow arrows.
  - Include sticky notes above each part/cluster summarizing the overarching narrative transition.

  Open the canvas file when created.
  ```
- **Discussion & Nuances:** 
  > [!TIP] Adapting Chapter Paths
  > If your manuscript chapters live in a different folder (such as `Manuscript/` or `Book/`), adjust the `default: Chapters/` line in the frontmatter before launching.
- **See Also:** None.

---

## Recipe 5.6: Continuity & Glossary Sentinel

- **Difficulty:** 🟡 Intermediate
- **Problem:** As a manuscript grows over months, technical definitions drift, terms get capitalized inconsistently, and acronyms go unexplained.
- **Solution:** Cross-references the active chapter draft against your master `Glossary.md` note, flagging terminology violations.
- **Prerequisites:** A master glossary note in your vault.
- **Permission Level:** `Standard`
- **Context Workflow:** Active Note.
- **Recipe / Skill:** Save as `glossary-sentinel.md`:
  ```markdown
  ---
  category: Editorial
  description: Compare the active chapter against your master glossary note for terminology drift
  params:
    - id: glossary_note
      type: input
      label: Master Glossary Note
      default: Glossary.md
  ---
  Compare the active draft against `{{glossary_note}}`:

  1. **Terminology Violations:** Flag instances where terms are defined differently or capitalized inconsistently.
  2. **Undefined Acronyms:** Flag any acronym used without prior definition on first appearance.
  3. **Candidate Additions:** List 2–3 recurring technical phrases in this chapter that should be formalized into the master glossary.
  ```
- **Discussion & Nuances:** 
  > [!TIP] Bootstrapping a Glossary
  > If you do not yet maintain a `Glossary.md`, you can ask BojuBot: *"Extract all specialized acronyms and capitalized concepts from this chapter into a new `Glossary.md` note."*
- **See Also:** [Recipe 5.4: Multi-Format Pre-Flight Linter](#recipe-5-4-multi-format-pre-flight-linter-pandoc-typst-epub)

---

## Recipe 5.7: Dual-Target Pipeline Sanity Checker

- **Difficulty:** 🟡 Intermediate
- **Problem:** When a book builds simultaneously to VitePress web and Pandoc/Typst print, a missing sidebar entry or mismatched heading ID silently breaks the reading order.
- **Solution:** Verifies that all chapter files are registered in `docs/.vitepress/config.js` and that heading IDs follow preprocessor slugging standards.
- **Prerequisites:** VitePress documentation site configuration.
- **Permission Level:** `Standard`
- **Context Workflow:** None.
- **Recipe / Skill:** Direct chat prompt:
  ```text
  Check all markdown files in my book chapters directory against .vitepress/config.js (or publication sidebar configuration). 
  Verify:
  1. That every chapter file is included in the sidebar navigation array in exact numerical order.
  2. That heading anchors follow the slugging format ch-<file>--<slug>.
  3. That all Mermaid diagrams render cleanly in standard markdown.
  Report any missing links or broken configurations.
  ```
- **Discussion & Nuances:** 
  > [!NOTE] Publishing Pre-flight
  > Critical sanity check before tagging a release or running print publication scripts.
- **See Also:** [Recipe 5.4: Multi-Format Pre-Flight Linter](#recipe-5-4-multi-format-pre-flight-linter-pandoc-typst-epub)

# 3. Academic & Literature Research

Recipes for academic researchers, graduate students, and non-fiction investigators: structured literature notes, multi-source synthesis matrices, PDF extraction, and methodological critique.

---

## Recipe 3.1: The Literature Note Extractor

- **Difficulty:** 🟢 Beginner
- **Problem:** Reading dense journal articles, book chapters, or papers without a consistent extraction schema leads to passive reading and forgotten insights.
- **Solution:** Converts an attached source or active reading note into a structured academic literature note detailing Thesis, Methodology, Findings, Critique, and Vault Links.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** Active Note, PDF attachment, or selection via `Alt+S` (`BojuBot: Send selection as context`).
- **Recipe / Skill:** Save as `literature-note.md`:
  ```markdown
  ---
  category: Research
  description: Extract an academic literature note from highlighted text or an attached paper
  autorun: true
  ---
  Read the active note (or provided PDF/selection attachment).

  Extract a formal Literature Note using the following template:

  # Literature Note: [Document Title / Topic]
  - **Source:** {{source_title}}
  - **Tags:** #research #literature-note

  ## 1. Core Thesis
  [1-2 sentences summarizing the foundational argument or discovery]

  ## 2. Key Arguments & Evidence
  - **Point A:** [Explanation + evidence]
  - **Point B:** [Explanation + evidence]

  ## 3. Methodology or Theoretical Framework
  [How the authors investigated the problem: empirical, theoretical, qualitative, meta-analysis]

  ## 4. Critique & Boundary Conditions
  [Methodological limitations, sample constraints, unstated assumptions, or counter-arguments]

  ## 5. Connections to Vault
  - Connects to: [[Related Concept 1]], [[Related Concept 2]]

  Prepend this to the top of the note.
  ```
- **Discussion & Nuances:** 
  > [!TIP] Working with Raw PDFs
  > If reading a PDF, simply drag and drop the `.pdf` file into the BojuBot chat panel (or click the paperclip attachment button). BojuBot parses the full document text natively.
- **See Also:** [Recipe 3.2: The Synthesis Matrix Builder](#recipe-3-2-the-synthesis-matrix-builder), [Recipe 3.3: PDF Deep Dive Extractor](#recipe-3-3-pdf-deep-dive-extractor)

---

## Recipe 3.2: The Synthesis Matrix Builder

- **Difficulty:** 🟡 Intermediate
- **Problem:** When writing a literature review or synthesizing 3 to 6 papers, comparing how authors address the same sub-themes in linear notes is overwhelming.
- **Solution:** Automatically generates a comparative Synthesis Matrix Table cross-referencing authors, methodology, consensus, and divergences.
- **Prerequisites:** Multiple notes sharing a topic tag (e.g. `#ai-pairing`).
- **Permission Level:** `Standard`
- **Context Workflow:** None / Modal input.
- **Recipe / Skill:** Save as `synthesis-matrix.md`:
  ```markdown
  ---
  category: Research
  description: Build a comparative synthesis matrix table comparing 3 to 5 notes or papers
  params:
    - id: search_tag
      type: input
      label: Tag or topic to compare
      placeholder: e.g. #ai-pairing
  ---
  Find all research notes tagged "{{search_tag}}".

  Compile a comparative Synthesis Matrix Table in a new note named `{{search_tag}} - Synthesis Matrix.md`:

  | Source / Author | Theoretical Premise | Methodology | Key Finding | Stance / Point of Divergence |
  | :--- | :--- | :--- | :--- | :--- |
  | `[[Note A]]` | [Premise] | [Method] | [Finding] | [Contrasting view] |
  | `[[Note B]]` | [Premise] | [Method] | [Finding] | [Contrasting view] |

  Below the table, provide:
  1. **Core Consensus:** Points where all sources agree.
  2. **Key Battlegrounds:** Foundational disagreements or conflicting findings.
  ```
- **Discussion & Nuances:** 
  > [!TIP] Tag Consistency
  > For best results, ensure your literature notes share a common tag (e.g. `#methodology` or `#llm-evals`) before generating the matrix.
- **See Also:** [Recipe 3.1: The Literature Note Extractor](#recipe-3-1-the-literature-note-extractor)

---

## Recipe 3.3: PDF Deep Dive Extractor

- **Difficulty:** 🟢 Beginner
- **Problem:** Extracting quotes and statistical findings from a 30-page academic PDF into Obsidian is manual, tedious copy-pasting.
- **Solution:** Ingests an attached PDF, extracts key quantitative tables, empirical findings, and primary research questions into an Obsidian Markdown note.
- **Prerequisites:** None (BojuBot handles PDF context extraction natively).
- **Permission Level:** `Standard`
- **Context Workflow:** Drag & drop PDF file into chat panel or use paperclip attachment.
- **Recipe / Skill:** Direct chat prompt:
  ```text
  Read the attached PDF research paper. 
  Extract:
  1. The primary research question and hypothesis.
  2. The sample size, population, and dataset descriptions.
  3. The key statistical findings (effect sizes, p-values, or qualitative findings).
  4. The 3 most memorable, verbatim quotes from the discussion section.
  Save this summary directly into a new note named "[Paper Author] ([Year]) - [Short Title].md" in my Papers/ folder.
  ```
- **Discussion & Nuances:** Works with native PDFs stored anywhere on your computer or inside the vault.
- **See Also:** [Recipe 3.1: The Literature Note Extractor](#recipe-3-1-the-literature-note-extractor)

---

## Recipe 3.4: Citation & Highlight Harvester

- **Difficulty:** 🟡 Intermediate
- **Problem:** Highlighted quotes and references end up scattered across dozens of individual book notes and reading logs.
- **Solution:** Scans all notes with `#quote` tags or specific inline tags and aggregates them into a categorized thematic quotation bank.
- **Prerequisites:** Vault notes containing formatted blockquotes (`> "..."`) or `#quote` tags.
- **Permission Level:** `Standard`
- **Context Workflow:** None / Modal input.
- **Recipe / Skill:** Save as `quote-harvester.md`:
  ```markdown
  ---
  category: Research
  description: Harvest all highlighted quotes across vault notes matching a theme
  params:
    - id: topic_tag
      type: input
      label: Topic or Tag
      placeholder: e.g. #verification or #cognition
  ---
  Scan all vault notes tagged or containing "{{topic_tag}}".

  Extract all blockquotes (`> "..."`) and highlighted passages:
  1. Group them by primary argument or sub-theme.
  2. Retain attribution: include author, source title, and a `[[wikilink]]` to the original note.
  3. Include a 1-sentence note for each quote explaining its relevance to {{topic_tag}}.

  Write the aggregated quote bank to `{{topic_tag}} - Quotation Bank.md`.
  ```
- **Discussion & Nuances:** Keeps your primary quotes organized when writing literature reviews or research monographs.
- **See Also:** [Recipe 3.2: The Synthesis Matrix Builder](#recipe-3-2-the-synthesis-matrix-builder)

---

## Recipe 3.5: Academic Socratic Sparring Partner

- **Difficulty:** 🟢 Beginner
- **Problem:** Authors often write research arguments that sound convincing to themselves, only to discover obvious methodological flaws during peer review.
- **Solution:** Adopts the persona of a rigorous academic peer reviewer (e.g. "Reviewer 2"), systematically challenging the methodology and assumptions of your draft.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** Active Note (focused on your working paper or section).
- **Recipe / Skill:** Save as `academic-sparring.md`:
  ```markdown
  ---
  category: Research
  description: Rigorous academic peer-reviewer critique of active draft methodology and assumptions
  autorun: true
  ---
  Adopt the persona of an expert, rigorous academic peer-reviewer reading the active draft.

  Critique the argument:
  1. **Methodological Vulnerabilities:** Where is the sample, dataset, or empirical evidence insufficient to support the claim?
  2. **Alternative Explanations:** What confounding variables or alternative theoretical frameworks could explain the same outcome?
  3. **Unstated Axioms:** What foundational assumptions are taken for granted without empirical justification?

  Provide a candid, scholarly critique and recommend 2 concrete tests or additional sources to strengthen the paper.
  ```
- **Discussion & Nuances:** Prepares you for actual committee, thesis, or journal peer review before submission.
- **See Also:** [Creative Writing: The Devil's Advocate](./creative-writing.md#recipe-4-6-the-devil-s-advocate-skeptical-reader)

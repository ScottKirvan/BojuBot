# 6. Blogging & Social Media

Turn your Obsidian vault into a publishing command desk: atomizing pillar essays into multi-channel promotional kits, crafting swipeable LinkedIn carousels, generating platform-ready canonical posts, and mining past vault notes for content ideas.

---

## Recipe 6.1: The Content Atomizer (1 Pillar Post → 4 Formats)

- **Difficulty:** 🟢 Beginner
- **Problem:** Writing a 1,500-word essay takes hours; manually adapting that essay for X/BlueSky, LinkedIn, newsletters, and Reddit takes just as long.
- **Solution:** Ingests your active blog post and appends a `## Promotional Kit` containing tailored adaptations for four distinct platforms.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** Active Note.
- **Recipe / Skill:** Save as `content-atomizer.md`:
  ```markdown
  ---
  category: Social & Media
  description: Repurpose the active post into tailored formats for X, LinkedIn, Newsletter, and Forums
  autorun: true
  ---
  Read the active draft. Extract the core arguments and generate a complete promotional kit at the bottom of the note:

  ---

  ## Promotional Kit

  ### 🧵 1. X / BlueSky Thread (5–7 Posts)
  - Post 1: High-curiosity hook statement (< 280 characters).
  - Posts 2–5: Key technical takeaways, formatted with scannable bullet points.
  - Post 6: Summary takeaway + link placeholder.

  ### 💼 2. LinkedIn Post
  - Short, high-impact opening line.
  - 3–4 punchy paragraphs (maximum 2 sentences per paragraph) with generous whitespace.
  - Bulleted list of practical takeaways.
  - Discussion question to prompt replies.

  ### 📬 3. Newsletter Teaser (Substack / Ghost)
  - A 150-word curiosity-driven introduction explaining *why* this problem matters now, bridging directly to the link.

  ### 💬 4. Technical Forum Starter (Reddit / Hacker News)
  - A neutral, non-promotional discussion prompt focusing on the engineering trade-offs rather than the article itself.
  ```
- **Discussion & Nuances:** Generates platform-appropriate tone (technical and scannable for LinkedIn, brief and punchy for X, debate-oriented for Reddit).
- **See Also:** [Recipe 6.2: Hook & Headline Lab](#recipe-6-2-hook-headline-lab-5-angles), [Recipe 6.3: LinkedIn Carousel Slide Generator](#recipe-6-3-linkedin-carousel-slide-generator)

---

## Recipe 6.2: Hook & Headline Lab (5 Angles)

- **Difficulty:** 🟢 Beginner
- **Problem:** Articles often fail to reach readers because the title or opening line is generic or boring.
- **Solution:** Evaluates your draft's thesis and pitches 5 distinct psychological framing angles for both titles and opening sentences.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** Active Note.
- **Recipe / Skill:** Save as `hook-lab.md`:
  ```markdown
  ---
  category: Social & Media
  description: Generate 5 psychological angles for titles and opening hooks
  autorun: true
  ---
  Analyze the core premise of the active note.

  Provide 5 distinct framing angles for titles and opening sentences:

  1. **The Contrarian:** Challenging common industry dogma or best practices.
  2. **The Personal Post-Mortem:** Framing through the lens of a real engineering failure or incident.
  3. **The Tactical How-To:** Direct, promise-driven, and focused on immediate implementation.
  4. **The Data / Observation:** Grounded in a surprising measurement, metric, or audit.
  5. **The Manifesto / Philosophy:** A high-level vision statement about how the discipline is shifting.

  For each angle, output:
  - **Title Option:** Punchy, evocative, under 70 characters.
  - **Opening Sentence:** The immediate first hook to pull the reader in.
  ```
- **Discussion & Nuances:** Gives you 5 completely different marketing angles to test across social platforms.
- **See Also:** [Recipe 6.1: The Content Atomizer](#recipe-6-1-the-content-atomizer-1-pillar-post-→-4-formats)

---

## Recipe 6.3: LinkedIn Carousel Slide Generator

- **Difficulty:** 🟢 Beginner
- **Problem:** PDF carousels get significantly higher reach and dwell time on LinkedIn, but building them in Canva or Figma takes an hour.
- **Solution:** Condenses an active process or insight into 6 clean, slide-by-slide Markdown cards ready for PDF export.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** Active Note.
- **Recipe / Skill:** Save as `carousel-generator.md`:
  ```markdown
  ---
  category: Social & Media
  description: Convert a process in the active note into slide-by-slide carousel cards
  autorun: true
  ---
  Read the active note and distill the core workflow into a 6-slide carousel:

  - **Slide 1 (Cover):** Bold title (max 6 words) + provocative subtitle.
  - **Slides 2–5 (Body Cards):** 
    - Slide header
    - Exactly 2 concise bullet points explaining the step
    - "Takeaway" callout at the bottom
  - **Slide 6 (Outro / Call to Action):** Summary of the framework + invite discussion in the comments.

  Format each slide with clean markdown divider blocks (`---`).
  ```
- **Discussion & Nuances:** 
  > [!TIP] Exporting to PDF
  > You can print the resulting cards directly to a swipeable PDF using Obsidian's built-in File → Print to PDF dialog (or using community slide presentation plugins).
- **See Also:** None.

---

## Recipe 6.4: Cross-Post Platform Adapter

- **Difficulty:** 🟡 Intermediate
- **Problem:** Cross-posting to Dev.to, Hashnode, Medium, or Ghost requires stripping Obsidian wikilinks and setting canonical URLs so Google doesn't penalize duplicate content.
- **Solution:** Generates a platform-ready markdown file with canonical metadata and cleaned relative links.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** Active Note with modal input.
- **Recipe / Skill:** Save as `platform-adapter.md`:
  ```markdown
  ---
  category: Social & Media
  description: Generate platform-ready markdown with canonical URLs and clean links
  params:
    - id: canonical_url
      type: input
      label: Primary Canonical URL
      placeholder: e.g. https://example.com/blog/my-post
    - id: target_platform
      type: dropdown
      label: Target Platform
      options:
        - Dev.to
        - Hashnode
        - Medium
        - Ghost
  ---
  Convert the active draft into publication-ready markdown for {{target_platform}}:

  1. **Canonical Header:** Prepend YAML frontmatter with `canonical_url: {{canonical_url}}` and platform-specific tags.
  2. **Link Conversion:** Convert all internal wikilinks (`[[Note]]`) into plain text or public URLs.
  3. **Image Paths:** Update relative image paths to absolute public URLs or placeholders.

  Write the output to a new file named `[Title] - {{target_platform}}.md`.
  ```
- **Discussion & Nuances:** Eliminates manual editing when syndicate-publishing your writing across personal and third-party sites.
- **See Also:** [Recipe 6.1: The Content Atomizer](#recipe-6-1-the-content-atomizer-1-pillar-post-→-4-formats)

---

## Recipe 6.5: The Vault Miner (Harvesting Unwritten Content)

- **Difficulty:** 🟢 Beginner
- **Problem:** Creators spend time searching for new ideas when their best insights are already buried across 90 days of daily notes and meeting minutes.
- **Solution:** Sweeps recent logs, finds recurring themes, extracts direct quotes, and outlines 3 ready-to-write essay proposals.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** None.
- **Recipe / Skill:** Save as `vault-miner.md`:
  ```markdown
  ---
  category: Social & Media
  description: Scan notes and dev logs from the last 90 days to surface recurring themes and draft outlines
  autorun: true
  ---
  Scan daily notes, meeting notes, and dev logs from the past 90 days.

  Find recurring concepts and unresolved debates:
  1. Identify 3 distinct recurring themes mentioned in 3+ separate notes.
  2. For each theme:
     - Provide the 2 best direct quotes from the vault.
     - Outline a 4-part essay or thread proposition based on the notes.
     - List the relevant `[[wikilinks]]`.

  Present the report in chat as a creative brainstorming memo.
  ```
- **Discussion & Nuances:** Transforms your personal journal into an automated content generation engine.
- **See Also:** None.

---

## Recipe 6.6: Social Code Card Generator

- **Difficulty:** 🔴 Advanced
- **Problem:** Text code blocks look mediocre on social feeds; creating syntax-highlighted images manually disrupts writing.
- **Solution:** Automatically executes CLI tools (like `silicon` or `carbon-now-cli`) to render high-resolution syntax-highlighted PNGs from your notes.
- **Prerequisites:** CLI tool `silicon` or `carbon-now-cli` installed in your operating system's PATH.
- **Permission Level:** `Full Access / Shell`
- **Context Workflow:** Highlight code snippet and press `Alt+S` (`BojuBot: Send selection as context`).
- **Recipe / Skill:** Direct chat prompt:
  ```text
  Take the highlighted code selection. 
  Run `silicon` to render a syntax-highlighted PNG image with padding into `assets/media/code-card-1.png`. 
  Then insert the markdown image link into the active note.
  ```
- **Discussion & Nuances:** 
  > [!WARNING] Requires External CLI
  > This recipe requires the `silicon` binary installed on your system. If you prefer a zero-install alternative, you can ask BojuBot to format the code inside an Obsidian callout box (e.g. `> [!EXAMPLE]`) and screenshot it directly.
- **See Also:** None.

# 1. Quick-Hit Conversational Recipes

Zero-setup recipes you can run directly in the chat panel. These recipes test workspace navigation, permission boundaries, and core UI Bridge actions without needing to create or configure skill files.

---

## Recipe 1.1: Agent Identity & Capability Probe

- **Difficulty:** 🟢 Beginner
- **Problem:** When starting in a new vault, you need to verify which agent model is running and what capabilities it has active.
- **Solution:** Asks the agent to describe its runtime identity, current backend (Claude Code vs. Antigravity/Gemini), and operational scope.
- **Prerequisites:** None.
- **Permission Level:** `Standard` (or any mode).
- **Context Workflow:** Chat prompt.
- **Recipe / Skill:** Direct chat prompt:
  ```text
  Tell me about yourself. What agent backend are you currently running on, and what tools do you have access to in this vault?
  ```
- **Discussion & Nuances:** BojuBot responds based on the active backend and injected system context.
- **See Also:** [Recipe 1.2: Permission Boundary Audit](#recipe-1-2-permission-boundary-audit)

---

## Recipe 1.2: Permission Boundary Audit

- **Difficulty:** 🟢 Beginner
- **Problem:** You need to verify that BojuBot strictly respects permission boundaries (e.g. Chat Only vs. Standard vs. Full Access).
- **Solution:** Asks the agent to perform an action outside its permission tier to confirm that denial handling and UI Bridge permission requests function correctly.
- **Prerequisites:** None.
- **Permission Level:** Test across `Chat only`, `Read only`, `Standard`, and `Full Access`.
- **Context Workflow:** Chat prompt.
- **Recipe / Skill:** Direct chat prompt:
  ```text
  Please run a shell command to list the files in this directory.
  ```
- **Discussion & Nuances:** Under `Standard` mode, BojuBot will explain that shell execution is restricted and emit a UI Bridge permission request:
  `@@BOJU {"action":"request-permission","tool":"run_command","reason":"..."}`
  Under `Chat only` or `Read only`, it will immediately refuse without requesting elevation.
- **See Also:** [Recipe 1.1: Agent Identity & Capability Probe](#recipe-1-1-agent-identity-capability-probe)

---

## Recipe 1.3: Working Directory Verification

- **Difficulty:** 🟢 Beginner
- **Problem:** You need to confirm whether the agent is executing relative to the vault root or a subfolder before asking it to write files.
- **Solution:** Asks the agent to report its current working directory (CWD).
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** Chat prompt.
- **Recipe / Skill:** Direct chat prompt:
  ```text
  What is your current working directory?
  ```
- **Discussion & Nuances:** BojuBot will confirm its root directory (e.g. `cwd=vault root`), ensuring all relative file links and note operations anchor to your vault root.
- **See Also:** None.

---

## Recipe 1.4: Daily Note Instant Jump

- **Difficulty:** 🟢 Beginner
- **Problem:** Opening today's daily note normally requires multiple keystrokes or locating it in the file tree.
- **Solution:** Prompts BojuBot to find or create today's daily note and immediately open it in an editor tab.
- **Prerequisites:** Daily Notes core plugin or Periodic Notes enabled.
- **Permission Level:** `Standard`
- **Context Workflow:** Chat prompt.
- **Recipe / Skill:** Direct chat prompt:
  ```text
  Open today's daily note. If it doesn't exist yet, create it using my vault's date format and open it.
  ```
- **Discussion & Nuances:** 
  > [!NOTE] Daily Note Detection
  > BojuBot inspects `.obsidian/daily-notes.json` to find your configured daily note directory and date format, then emits `open-file` via the UI Bridge.
- **See Also:** [Recipe 2.1: The Nightly Sweep & Roll-Forward](./pkm.md#recipe-2-1-the-nightly-sweep-roll-forward)

---

## Recipe 1.5: Side-by-Side Note Comparison Split

- **Difficulty:** 🟢 Beginner
- **Problem:** Manually dragging tabs into vertical or horizontal splits to compare two notes is clunky.
- **Solution:** Instructs BojuBot to open a second note in a vertical split pane alongside your active file.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** Chat prompt with target note names.
- **Recipe / Skill:** Direct chat prompt:
  ```text
  Open [[Project Spec]] side by side with [[Architecture Diagram]] in a vertical split.
  ```
- **Discussion & Nuances:** Uses the UI Bridge `open-file-split(path, "vertical")` action to position the panes instantly.
- **See Also:** None.

---

## Recipe 1.6: Theme Installation & Setup

- **Difficulty:** 🟡 Intermediate
- **Problem:** Browsing, discovering, and configuring Obsidian themes manually requires searching through hundreds of community themes, navigating nested settings tabs, and clicking through modals.
- **Solution:** Under Full Access, BojuBot discovers themes matching your aesthetic description, downloads the theme assets directly into `.obsidian/themes/<theme-name>/`, and activates it in `.obsidian/appearance.json`. Under Standard mode, it navigates directly to Appearance settings via the UI Bridge for 1-click installation.
- **Prerequisites:** Internet access.
- **Permission Level:** `Full Access / Shell` (for automated discovery and install) or `Standard` (for assisted UI navigation).
- **Context Workflow:** Chat prompt.
- **Recipe / Skill:** Direct chat prompts:
  - **Option A: Aesthetic Discovery & Auto-Install (Full Access):**
    ```text
    Find an Obsidian community theme that matches [aesthetic: e.g. "clean Notion-like minimalism" / "dark cyberpunk terminal" / "warm vintage paper with serif fonts"]. Pick the best match, download its files into .obsidian/themes/, and activate it.
    ```
  - **Option B: Direct Name or Repo Install (Full Access):**
    ```text
    Install the "GitHubDHC" theme: fetch its theme.css and manifest.json from its GitHub repo, place them in .obsidian/themes/GitHubDHC/, and update .obsidian/appearance.json to set "cssTheme": "GitHubDHC".
    ```
  - **Option C: Assisted Navigation (Standard Mode):**
    ```text
    Open settings to Appearance so I can install the GitHubDHC theme.
    ```
- **Discussion & Nuances:** 
  > [!TIP] How Natural-Language Theme Discovery Works
  > When asked to find a theme matching an aesthetic, BojuBot can inspect the official Obsidian community theme registry (`obsidianmd/obsidian-releases/community-css-themes.json`). It compares your descriptive aesthetic prompt against theme tags, modes (light/dark), and repository READMEs to select the best match.
  > 
  > Under the hood, an Obsidian theme is simply a folder inside `.obsidian/themes/<theme-name>/` containing `manifest.json` and `theme.css`. The active theme is recorded in `.obsidian/appearance.json` under `"cssTheme"`.
  > 
  > With Full Access enabled, BojuBot downloads the release assets directly into `.obsidian/themes/` and updates your vault appearance configuration. Obsidian immediately detects the new files and reloads the styling live without requiring an app restart.
  > 
  > In Standard permission mode where direct writes to `.obsidian/` or web downloads might be restricted, Option C uses `open-settings("appearance")` via the UI Bridge to present the official theme picker instantly.
- **See Also:** [Recipe 1.2: Permission Boundary Audit](#recipe-1-2-permission-boundary-audit)

---

## Recipe 1.7: Image Alt-Text Generator

- **Difficulty:** 🟢 Beginner
- **Problem:** Visual notes and diagrams lack descriptive accessibility text for screen readers or search indexing.
- **Solution:** Inspects an embedded image in the active note and drafts a detailed, descriptive alt-text caption.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** Active Note with embedded image.
- **Recipe / Skill:** Direct chat prompt:
  ```text
  Inspect the image embedded in line 12 of the active note. Write a clear, 2-sentence descriptive alt-text caption explaining the visual elements, and update the markdown image tag: ![[image.png|Alt text here]].
  ```
- **Discussion & Nuances:** Great for accessibility and for making images searchable in Obsidian search.
- **See Also:** [Recipe 1.8: Screenshot & Document OCR Transcriber](#recipe-1-8-screenshot-document-ocr-transcriber)

---

## Recipe 1.8: Screenshot & Document OCR Transcriber

- **Difficulty:** 🟢 Beginner
- **Problem:** Text trapped in pasted screenshots, receipts, or diagrams cannot be searched, copied, or queried in Obsidian.
- **Solution:** Transcribes visible text from an attached image into a structured Markdown checklist or table.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** Paste screenshot directly into the chat input box.
- **Recipe / Skill:** Direct chat prompt:
  ```text
  Read the attached screenshot. Transcribe all text, numbers, and checklist items into clean, formatted markdown. Prepend this to the active note.
  ```
- **Discussion & Nuances:** Leverages multimodal vision capabilities of the underlying agent (Claude 3.5/3.7 or Gemini 1.5/2.0/3.8 Flash).
- **See Also:** [Recipe 1.7: Image Alt-Text Generator](#recipe-1-7-image-alt-text-generator)

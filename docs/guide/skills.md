# Skills

A **skill** is a markdown file that gives your agent a defined mission. Skills live in your skills folder and appear in the `/` menu — and optionally in the Obsidian command palette — ready to run on demand.

Skills range from simple reusable prompts to fully parameterized agentic workflows. Because the agent can use its tools (as far as the session's [permission mode](./permissions) allows), a skill can read and write vault notes, run shell commands, call APIs, and more. If you can describe it in a prompt, you can make it a skill.

## Where skills live

**Default location:** `_BojuBot Skills/` at your vault root. Storing skills inside your vault makes them easy to create, edit, and sync with Obsidian Git or Obsidian Sync.

**Custom location:** Set **Settings → BojuBot → Skills folder** to:
- A vault-relative path (e.g. `_skills`)
- An absolute path — to share a single skills folder across multiple vaults on your machine

Skills reload each time you open the `/` menu, so any edits or newly added `.md` files take effect immediately with no restart.

---

## How to run skills

There are three ways to execute skills in BojuBot:

### 1. The Slash (`/`) menu in chat
Type `/` anywhere in the BojuBot chat input to open the interactive skills menu:
- Skills are grouped under their `category` heading and display their subtitle `description`.
- Use **↑ / ↓** arrows to navigate and press **Enter** to select, or keep typing to fuzzy-search by name.

### 2. Command Palette (`Ctrl+P` / `Cmd+P`)
Enable **Settings → BojuBot → Register skills as Ctrl+P commands** to register every skill file as a native Obsidian command, prefixed with `Skill: …`.
- Open the palette (`Ctrl+P` on Windows/Linux, `Cmd+P` on Mac) and type `Skill:` to search.
- Triggering a skill from the palette opens the BojuBot chat panel automatically if it is currently closed.
- After adding or removing skill files, run **BojuBot: Reload skills** from the palette to sync registrations.

### 3. Hotkeys & automation plugins
- **Hotkeys:** Assign custom keyboard shortcuts to your most frequent skills in **Settings → Hotkeys** (search for `Skill:`).
- **Other plugins:** Because skills register as standard Obsidian commands (`bojubot:skill-<slug>`), you can trigger them from Templater, QuickAdd, Commander, and other workflow tools. See the [Skills API](./commands#skills-api) reference for details.

---

## File format

A skill file is a standard markdown file with optional YAML frontmatter:

```markdown
---
category: Reviews
description: Structured weekly review
autorun: true
params:
  - id: focus
    type: input
    label: Any specific focus area?
    placeholder: Leave blank for a full review
---
Review my notes from this week. Give me:
- What I worked on
- Open threads or unresolved questions
- Suggested priorities for next week

{{focus}}
```

The frontmatter controls how the skill appears in the menu and how it behaves. The body is the prompt the agent receives.

## Frontmatter reference

| Field         | Type    | Default   | Description                                                                         |
| ------------- | ------- | --------- | ----------------------------------------------------------------------------------- |
| `category`    | string  | `Prompts` | Groups the skill under a named heading in the `/` menu                              |
| `description` | string  | *(none)*  | Short subtitle shown below the skill name                                           |
| `autorun`     | boolean | `false`   | If `true`, executes immediately. If `false`, inserts into the chat input for review |
| `params`      | array   | *(none)*  | Form fields presented to the user before the skill runs                             |

## Execution modes

| `autorun` | `params` | Behaviour                                          |
| --------- | -------- | -------------------------------------------------- |
| `false`   | none     | Inserts prompt body into chat input for review     |
| `true`    | none     | Fires immediately; shows `Running: <name>` in chat |
| `false`   | defined  | Shows form → inserts filled prompt into chat input |
| `true`    | defined  | Shows form → fires immediately on submit           |

## `params` fields

When `params` is defined, BojuBot shows a modal form before running the skill. Each entry is an object with the following properties:

| Property               | Required                   | Description                                                  |
| ---------------------- | -------------------------- | ------------------------------------------------------------ |
| `id`                   | Yes                        | Variable name used in `{{interpolation}}` in the prompt body |
| `type`                 | Yes                        | Field type — see below                                       |
| `label`                | Yes                        | Human-readable label shown in the form                       |
| `description`          | No                         | Helper text shown below the label                            |
| `placeholder`          | No                         | Placeholder text for `input` and `textarea` fields           |
| `options`              | Yes (dropdown, checkboxes) | Array of string values                                       |
| `default`              | No                         | Pre-filled value                                             |
| `validations.required` | No                         | If `true`, blocks submission when the field is empty         |

### Field types

| Type              | Description                                                                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `input`           | Single-line text field                                                                                                                                                 |
| `textarea`        | Multi-line text field                                                                                                                                                  |
| `dropdown`        | Select from a fixed list of options                                                                                                                                    |
| `checkboxes`      | One or more boolean toggles — result is a comma-separated string                                                                                                       |
| `obsidianmd_note` | Vault note picker — fuzzy search over all vault notes; injects the **full note content** as an attachment (same as @-mention). Alias: `note` (legacy, still supported) |

### Variable interpolation

Use <code v-pre>{{id}}</code> in the prompt body to reference field values. After submission:

- **Non-note fields** are interpolated inline.
- **Note fields** are added as context attachments (shown as badges above the input, just like @-mention). The <code v-pre>{{id}}</code> token is stripped from the body — the note content arrives via the attachment, not inline text.
- Unresolved tokens (optional fields left blank) are stripped cleanly. No visible <code v-pre>{{placeholder}}</code> tokens appear in the output.

### Handling optional parameters

Interpolation only strips the <code v-pre>{{id}}</code> token itself — any static label text you wrote around it stays. If an optional `textarea` param is left blank, a body like:

```
**Additional instructions:** {{extra_notes}}
```

leaves a dangling `**Additional instructions:**` with nothing after it. It's harmless, but noisy, and can read like a cut-off instruction to the agent.

Wrap optional parameters in XML-style tags instead:

```
<extra_instructions>
{{extra_notes}}
</extra_instructions>
```

Models treat XML-like tags as semantic containers, so this pattern handles both cases cleanly:

- **Empty** — the agent sees a clearly-bounded empty block and ignores it.
- **Populated** — the user's content is unambiguously scoped, so it can't blend into the skill's own surrounding instructions.

This matters most for free-text fields (`input`, `textarea`) where the user might paste in dense or instruction-like text. Use it for any optional parameter, not just the ones that happen to be empty most of the time.

**Keep internal protocol details out of skill bodies.** Skills intended for general use should describe actions in plain language ("open the file in Obsidian") and let BojuBot's system context handle the mechanics — don't embed raw UI Bridge trigger syntax directly in a skill prompt body.

---

## Progressive "Hello World" Examples

The following 5 examples demonstrate how a skill evolves from a plain text prompt to an interactive, context-aware Obsidian tool.

### Level 1: The Bare Minimum (Zero Frontmatter)

A skill does not require YAML frontmatter. Any markdown file placed in your skills folder automatically appears in the `/` slash menu using its filename.

```markdown
Say hello, report your active working directory, and list 3 core things you can do in this vault.
```

- **Behavior:** Because `autorun` defaults to `false`, choosing this skill from the menu pastes the prompt directly into the chat input, allowing you to edit or augment it before submitting.

### Level 2: Adding Frontmatter (`category`, `description`, `autorun`)

Frontmatter allows you to organize skills into `/` menu categories, provide subtitles, and configure immediate execution.

```markdown
---
category: General
description: Greet user and verify vault context
autorun: true
---
Say hello, confirm your active working directory, and list the title of the active note.
```

- **Behavior:** Setting `autorun: true` causes the skill to execute immediately upon selection from the slash menu or Command Palette. The `category` organizes it under a menu heading, and `description` provides a subtitle.

### Level 3: Adding User Input (`params` & `{{interpolation}}`)

Adding `params` displays a modal form to collect input before running the skill.

```markdown
---
category: General
description: Personalized greeting and active note audit
autorun: true
params:
  - id: user_name
    type: input
    label: Your Name
    placeholder: e.g. Alex
---
Hello {{user_name}}! 

Please review the active note and suggest 2 concrete improvements to its structure.
```

- **Behavior:** When triggered, a modal form requests `Your Name`. The entered text replaces `{{user_name}}` in the prompt body before the agent receives it.

### Level 4: Form Controls & Clean Scoping (`dropdown`, `textarea`, XML containers)

Forms support multiple input types. When fields are optional, wrapping them in semantic XML tags ensures the agent handles blank submissions cleanly.

```markdown
---
category: General
description: Structured review with tone selection and optional notes
autorun: true
params:
  - id: tone
    type: dropdown
    label: Review Tone
    options: [Constructive, Direct, Socratic, Pirate]
    default: Direct
  - id: extra_focus
    type: textarea
    label: Focus Area (Optional)
    placeholder: Specific sections or questions to focus on...
---
Review the active note using a {{tone}} tone.

<focus_instructions>
{{extra_focus}}
</focus_instructions>
```

- **Behavior:** Displays a dropdown and a multi-line text area. If `extra_focus` is left blank, the agent sees `<focus_instructions></focus_instructions>` as an empty container and safely ignores it without dangling labels or grammar issues.

### Level 5: Vault Context Integration (`obsidianmd_note`)

The `obsidianmd_note` field type opens Obsidian's native fuzzy-search note picker, attaching another note's full content to the conversation.

```markdown
---
category: General
description: Compare the active note against another note in the vault
autorun: true
params:
  - id: reference_note
    type: obsidianmd_note
    label: Note to compare against
    validations:
      required: true
---
Compare the active note with the attached reference note.

Highlight:
1. Shared concepts or overlapping points.
2. Contradictions or divergences.
3. Recommended cross-links to add between them.
```

- **Behavior:** The picked note is added as a context attachment badge (identical to an `@-mention`). The token is stripped from the prompt body, and the full content of both the active note and the picked note are available to the agent.

---

## Real-World Showcase: The Meeting Action Extractor

This production-grade skill demonstrates how frontmatter, active note context, and structured output formatting combine into a daily workflow tool:

```markdown
---
category: Workflows
description: Extract decisions, action items, and open questions from the active note
autorun: true
params:
  - id: project_tag
    type: input
    label: Project tag or topic (optional)
    placeholder: e.g. #mobile-app or Roadmap
---
Review the active note (or highlighted selection) containing meeting notes.

<project_scope>
{{project_tag}}
</project_scope>

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

### Why This Works Well:
- **Zero-Friction Context:** Operates directly on the note currently open in your editor, or on a highlighted passage using `Alt+S` (`BojuBot: Send selection as context`).
- **Safe Execution:** Uses standard Obsidian markdown syntax (`- [ ]`, wikilinks, headings) without modifying frontmatter or overwriting raw notes.
- **Repeatable Output:** Delivers a predictable executive summary structure every time.

---

## Looking for More? The BojuBot Cookbook

The examples above explain the mechanics and syntax of skills. For pre-built, task-specific skills organized by discipline, explore the **[BojuBot Cookbook](../cookbook/)**.

The cookbook contains 56 recipes adhering to a standard problem-and-solution schema across 8 categories:

1. **[1. Quick-Hit Chat Recipes](../cookbook/quick-hits.md)**: Zero-setup conversational prompts for navigation, permissions, theme setup, and image intelligence.
2. **[2. Daily Notes & PKM](../cookbook/pkm.md)**: End-of-day sweeps, meeting action extractors, atomic note splitters, Canvas mindmaps, and Dataview DQL helpers.
3. **[3. Academic & Literature Research](../cookbook/academic.md)**: Academic literature notes, PDF extractors, and comparative multi-source synthesis matrices.
4. **[4. Creative Writing & Fiction](../cookbook/creative-writing.md)**: Friction levers, ugly drafts, Socratic dialogues, and narrative complications.
5. **[5. Books & Long-Form Publishing](../cookbook/publishing.md)**: Technical practice pattern scaffolders, honesty audits, book arc Canvas roadmaps, and Pandoc/EPUB pre-flight.
6. **[6. Blogging & Social Media](../cookbook/blogging.md)**: Content atomizers, headline labs, LinkedIn carousels, and platform-ready canonical adapters.
7. **[7. Video Studio & Multimedia](../cookbook/video.md)**: Dual-column AV scriptwriting, packaging-first thumbnail matrix, Canvas beat sheets, and Whisper timestamps.
8. **[8. Developer & Multi-Agent Workflows](../cookbook/development.md)**: Resumption briefings ("Where Was I?"), doc-to-code drift detection, changelog staging, Kanban sync, and subagent briefs.

### Installing Recipes Directly in Chat

Because BojuBot operates inside your vault with file access, you do not have to create `.md` files manually. You can simply open the chat panel and ask:

> *"Install the Nightly Sweep recipe from the cookbook into my skills folder."*

BojuBot will read the recipe, adapt the prompt to match your vault's folder naming conventions, and write the `.md` file directly into your configured skills directory.

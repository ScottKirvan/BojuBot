## BojuBot Skills — Full Reference

A BojuBot skill is a Markdown prompt file in the skills folder (named in your orientation, or in a later settings note). The user runs it from the `/` menu in the chat panel. It is not one of your own agent skills (Claude Code's `.claude/skills`, Antigravity's skills): when the user says "skill", they mean a BojuBot skill unless they say otherwise.

### Files
- `<skills folder>/<Name>.md`, or `<skills folder>/<Name>/SKILL.md` (a folder per skill). The menu shows the file or folder name, so name it the way it should appear ("Weekly review.md").
- Only files directly in the skills folder (and `SKILL.md` one folder down) are found; deeper subfolders are ignored.
- Create it with your file tools at that path. The `/` menu rereads the folder every time it opens, so the skill appears immediately. Ctrl+P commands for skills (when the user turned that on) appear after BojuBot: Reload skills.

### Format
Optional YAML frontmatter, then the body. The body is the prompt the agent gets when the skill runs.

Frontmatter fields:
- category (string, default "Prompts"): heading the skill is grouped under in the `/` menu
- description (string): one-line subtitle in the menu
- autorun (boolean, default false): true sends the prompt at once; false puts it in the chat input for the user to review
- params (list): form fields shown before the skill runs (below)

Each params entry:
- id (required): name used as {{id}} in the body; letters, digits, underscores
- type (required): input (one line) · textarea (several lines) · dropdown (needs options) · checkboxes (needs options; value is the checked options, comma-separated) · obsidianmd_note (vault note picker; the note's full content is attached, and {{id}} is removed from the body)
- label (required): field label
- description, placeholder, default: optional
- options: list of strings, for dropdown and checkboxes
- validations: { required: true } blocks submitting while the field is empty

Every field is a direct property of the entry: no nesting other than validations.

### Body
- {{id}} is replaced by the field's value. Tokens left empty are removed, and so are extra blank lines.
- Wrap optional free-text fields in an XML-style tag, so an empty value leaves no dangling label:
  <extra_instructions>
  {{extra}}
  </extra_instructions>
- Write the body as plain instructions to the agent ("open the note in Obsidian"). Never put @@BOJU lines in a skill: BojuBot's own context tells the agent how to act on them.
- Claude Code's skill format also works: an arguments list in the frontmatter (each name becomes an input field; argument-hint is the first field's placeholder) and $ARGUMENTS, $0, $1… or $name in the body.

### Example
---
category: Writing
description: Summarize a note
autorun: true
params:
  - id: target
    type: obsidianmd_note
    label: Note to summarize
    validations:
      required: true
  - id: length
    type: dropdown
    label: Length
    options: [short, medium, long]
    default: short
  - id: extra
    type: textarea
    label: Anything else? (optional)
---
Summarize the attached note. Keep it {{length}}, and keep its decisions and open questions.

<extra_instructions>
{{extra}}
</extra_instructions>

### After writing one
Tell the user the skill's name, its category and that it's in the `/` menu. Don't run it yourself.

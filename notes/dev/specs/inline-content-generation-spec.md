# Inline Content Generation — Feature Spec

**Issue:** [#10](https://github.com/ScottKirvan/BojuBot/issues/10)  
**Status: PROPOSED** — design complete, not yet implemented (issue #10).  
**Branch:** (not started)
**Updated:** 2026/4/22

---

## Overview

Embed AI-generation prompts directly in vault notes using a tag syntax. When BojuBot detects a tag, it immediately marks it as pending, fires a headless Claude call, and replaces the tag with the generated result. Tags are **one-shot** — consumed on execution and not re-evaluated on subsequent opens.

Works in both regular notes and template files (with protection for the template library itself — see Exclusions).

---

## Syntax

Tags use Templater-style angle-bracket delimiters with a JSON payload:

```
<% bojubot: {"prompt": "your instruction here"} %>
```

### Why this syntax

No universal community standard exists for consumed/replaced inline tags. The candidates considered:

| Pattern              | Plugin                            | Notes                                                                                                                                                                                                                                               |
| -------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<% bojubot: ... %>` | Templater                         | **Chosen.** Templater is the dominant template plugin; users already have the mental model that `<% %>` tags get processed and replaced. Templater safely ignores unrecognised prefixes, so this tag passes through intact to the destination note. |
| `{{bojubot: ...}}`   | QuickAdd, Obsidian core Templates | Familiar but Obsidian's core Templates plugin behaviour with unknown `{{...}}` variables is unverified — could silently strip tags.                                                                                                                 |
| `` `bojubot: ...` `` | Dataview (inline)                 | Dataview tags re-evaluate on every render; they are not consumed. Wrong mental model for one-shot replacement.                                                                                                                                      |
| `%%bojubot: ...%%`   | (none)                            | Obsidian's native comment syntax. Exclusively associated with passive, hidden comments — using it for executable content would be confusing.                                                                                                        |

### Why JSON for the payload

JSON is used instead of a plain string so the tag format is extensible without breaking existing tags. New capabilities are added as new optional keys; any key unrecognised by the current version is silently ignored. This means a tag written today will still work after future BojuBot updates that add new keys.

---

## Tag Reference

All keys are optional except that at least one of `prompt` or `include` must be present.

### `prompt` (string)

The literal instruction passed to Claude.

```
<% bojubot: {"prompt": "Write a one-sentence summary of this note"} %>
```

### `context` (boolean, default: inherits setting)

When `true`, the full body of the **current note** is injected into Claude's context alongside the prompt, allowing instructions like "summarize this note" or "extract all action items from this note" to work without copying content into the tag itself. When `false`, only the prompt (and any `include`) is sent.

Defaults to the plugin setting **"Inject note content as context"** if not specified.

```
<% bojubot: {"prompt": "List the action items in this note", "context": true} %>
```

### `include` (string — vault path)

Path to a vault note whose contents are injected into Claude's context as additional input. The included file is always treated as **context**, not as an instruction — what Claude does with it is determined by `prompt`.

This enables two patterns:

**Skill execution** — `include` points at a skill note containing a detailed instruction set; `prompt` tells Claude to execute it:
```
<% bojubot: {"prompt": "Execute the skill in the included context", "include": "Skills/meeting-summary.md"} %>
```

**Reference material** — `include` points at a reference document; `prompt` tells Claude how to use it:
```
<% bojubot: {"prompt": "Summarize the key decisions from the included document", "include": "Projects/Q2-review.md"} %>
```

Both `include` and `context` can be combined. In that case Claude receives: the included file content + the current note body + the prompt.

### Reserved keys (not yet implemented)

These keys are documented here for forward-compatibility planning. They are currently ignored by BojuBot.

| Key          | Type   | Planned purpose                                                                           |
| ------------ | ------ | ----------------------------------------------------------------------------------------- |
| `output`     | string | Format hint for the generated content: `"plain"`, `"markdown"`, `"list"`, `"code"`        |
| `max_tokens` | number | Constrain response length — useful for predictable short insertions                       |
| `model`      | string | Override the Claude model for this tag, e.g. `"haiku"` for simple/cheap fills             |
| `system`     | string | Per-tag system prompt override, replacing the default insertion-focused system prompt     |
| `id`         | string | Named tag identifier — reserved for future targeting of specific tags from the chat panel |

---

## Trigger

BojuBot registers a `vault.on('modify', file)` listener. On every file modification:

1. Read the file content
2. Scan for the tag pattern
3. If found and the file is not excluded, begin processing

This catches file saves, Templater templaexecution (Templater writes the file when it processes), and any other plugin that modifies vault files. No background polling — zero overhead on files with no tags.

### Triggering from Templater

Templater exposes `tp.hooks.on_all_templates_executed()` internally, but this is only callable from within a template, not from an external plugin. The `vault.on('modify')` approach is therefore the correct external integration point — it fires naturally when Templater finishes writing the instantiated file.

---

## Processing Flow

### 1. Tag detected

BojuBot immediately rewrites the file, replacing the tag with a visible pending marker:

```
⏳ *BojuBot generating…*
```

This gives the user immediate feedback that the tag was recognized. The original prompt text is preserved internally in the pending job queue (not in the file) so it can be restored on cancel.

A dismissible Notice (toast) also appears: `"BojuBot: generating inline content — [Cancel]"`

### 2. Headless Claude call

BojuBot spawns a short-lived Claude subprocess (no chat session, no `--resume`):

- **System prompt:** "You are generating content to be inserted directly into a Markdown note. Return only the content itself — no preamble, no explanation, no markdown fences unless the content is code. The output will be inserted verbatim."
- **User message:** The prompt text extracted from the tag, optionally prepended with the note's own content as context (see Settings).
- **Flags:** `--print --output-format text` (not stream-json — we don't need streaming for inline insertion)

### 3. Cancel

Clicking Cancel in the Notice:
- Kills the Claude subprocess
- Removes the `⏳ …` placeholder line from the file
- Restores the original tag so the user can retry later

### 4. Generation completes

The `⏳ …` line is replaced in-file with the generated content, inserted as plain markdown.

### 5. Error

If Claude errors or the call times out, the `⏳ …` line is replaced with the original tag text and a Notice is shown: `"BojuBot: inline generation failed — tag restored"`. The tag is restored (not deleted) so the user can retry by saving the file.

---

## Multiple Tags in One File

If a file contains multiple tags, they are processed **sequentially** — one Claude call at a time. All tags get their `⏳ …` placeholder immediately (in a single file write), then each is resolved in order. This prevents burst spawning and keeps token usage predictable.

---

## Exclusions and Template Protection

### Folder exclusion list (settings)

Folders listed here are never scanned. Default: the user's configured Templater template folder (if detectable) and `Templates/`.

Files inside excluded folders can be freely edited without triggering processing — this is the primary protection for template libraries. A template with `<% bojubot: {"prompt": "summarize this note"} %>` lives safely in the Templates folder. When Templater instantiates it into a new note elsewhere in the vault, that new file gets scanned and the tag fires.

### Per-file frontmatter opt-out

Adding `bojubot-inline: false` to a note's frontmatter skips that file entirely, regardless of folder. Useful for individual files outside excluded folders (e.g., a scratch note you're actively editing that happens to contain a tag you're not ready to run).

---

## Settings

| Setting                        | Type      | Default         | Description                                                |
| ------------------------------ | --------- | --------------- | ---------------------------------------------------------- |
| Inline generation              | toggle    | off (initially) | Master switch; off by default until feature is stable      |
| Excluded folders               | text list | `Templates/`    | Folders skipped during scanning                            |
| Inject note content as context | toggle    | on              | Passes the note's full body to Claude alongside the prompt |
| Generation timeout (seconds)   | number    | 30              | Auto-cancel after this duration                            |

---

## Key Files (implementation targets)

| File                     | Change                                                            |
| ------------------------ | ----------------------------------------------------------------- |
| `main.ts`                | Register vault modify listener; wire up to inline processor       |
| `src/InlineProcessor.ts` | New file — tag detection, job queue, Claude spawn, file rewrite   |
| `src/settings.ts`        | Add inline generation settings fields                             |
| `test/unit.test.ts`      | Tests for tag detection regex, file rewrite logic, queue behavior |

---

## Out of Scope

- **Recurring/live tags** — tags that re-evaluate on every open (Dataview-style). Separate issue.
- **Inline generation from the chat panel** — initiating inline fills from a chat turn. Separate issue.
- **Multi-turn prompts** — this is one-shot only; no follow-up or correction loop.
- **Canvas nodes** — canvas file format is JSON, not Markdown; separate consideration.

---

## Open Questions

1. **Pending UX** — `⏳ *BojuBot generating…*` italic line acceptable, or prefer something less intrusive?
2. **Context injection default** — inject note body by default (on), or opt-in (off)?
3. **Master switch default** — off until stable feels right; confirm.

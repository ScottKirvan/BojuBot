# 7. Video Studio & Multimedia

Turn Obsidian into a pre-production and post-production studio for YouTubers, educators, and video creators: packaging-first thumbnail concepts, dual-column AV scripts, visual Canvas beat sheets, and CLI subtitle/transcription automation.

---

## Recipe 7.1: 3-Second Hook Lab (Shorts / TikTok / Reels)

- **Difficulty:** 🟢 Beginner
- **Problem:** Short-form vertical video has an immediate drop-off rate if the visual or spoken hook fails to create a pattern interrupt within 3 seconds.
- **Solution:** Evaluates your video concept and generates 5 distinct 3-second opening hooks combining visual action and spoken dialogue.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** Active Note.
- **Recipe / Skill:** Save as `video-hooks.md`:
  ```markdown
  ---
  category: Video
  description: Generate 5 visual and verbal pattern interrupts for short-form video hooks
  autorun: true
  ---
  Review the active video outline. Generate 5 distinct 3-second opening hooks:

  1. **The Pattern Interrupt:** A visual and verbal shock that contradicts expectations.
  2. **The Terminal Delete:** *"Watch what happens when I delete this one configuration line..."*
  3. **The Contrarian Attack:** Challenging common advice with a sharp counter-claim.
  4. **The Visual Demonstration:** Immediate action without introductory throat-clearing.
  5. **The Mystery Box:** Posing a specific, high-stakes question whose answer is revealed at the end.

  For each hook, specify:
  - **Spoken Line (Audio):** Max 12 words spoken in under 3 seconds.
  - **Visual Action:** Exact on-screen movement or camera switch.
  ```
- **Discussion & Nuances:** Tailored for fast-paced vertical video where viewer retention hinges on the first 45 frames.
- **See Also:** [Recipe 7.2: Thumbnail & Title Matrix](#recipe-7-2-thumbnail-title-matrix-packaging-first)

---

## Recipe 7.2: Thumbnail & Title Matrix (Packaging First)

- **Difficulty:** 🟢 Beginner
- **Problem:** Filming a video before knowing the packaging often leads to meandering, unfocused videos that struggle to find an audience.
- **Solution:** Generates 4 high-CTR packaging concepts pairing clickable titles with visual scene compositions and image generation prompts.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** Active Note.
- **Recipe / Skill:** Save as `thumbnail-matrix.md`:
  ```markdown
  ---
  category: Video
  description: Generate 4 high-CTR thumbnail compositions paired with clickable titles
  autorun: true
  ---
  Analyze the core premise of the active video note.

  Generate 4 "Packaging First" concepts:
  - **Title (under 50 chars):** High curiosity, no clickbait falsehoods.
  - **Visual Composition:** What appears on the left vs. right (facial expression, graphic, color contrast).
  - **Thumbnail Text:** Max 3–4 punchy words that complement (never duplicate) the title.
  - **Image Generation Prompt:** Ready-to-run prompt for Midjourney or local diffusion to generate background elements.
  ```
- **Discussion & Nuances:** Forces you to commit to a clear premise before writing the full script.
- **See Also:** [Recipe 7.3: Dual-Column AV Video Scriptwriting](#recipe-7-3-dual-column-av-video-scriptwriting)

---

## Recipe 7.3: Dual-Column AV Video Scriptwriting

- **Difficulty:** 🟢 Beginner
- **Problem:** Standard prose scripts fail during shooting because you cannot see what the camera is showing while the narrator speaks.
- **Solution:** Formats rough outlines into an industry-standard Audio/Visual (AV) Production Table with visual cues, B-roll notes, and a shooting checklist.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** Active Note.
- **Recipe / Skill:** Save as `av-script-formatter.md`:
  ```markdown
  ---
  category: Video
  description: Format an outline into a two-column Audio/Visual production script
  autorun: true
  ---
  Convert the active video outline into an Audio/Visual (AV) Production Table:

  | Timestamp | Visual / B-Roll / Graphics (Left Column) | Audio / Narration (Right Column) |
  | :--- | :--- | :--- |
  | `0:00 - 0:10` | [Close up of speaker; kinetic typography graphic pops on screen] | "[Hook sentence spoken with high energy]" |
  | `0:10 - 0:35` | [Switch to screen recording of terminal / IDE error] | "[Explain the specific failure mode]" |

  Guidelines:
  - Include visual cues: Talking Head, B-Roll, Code Screen, Terminal, Graphic.
  - Break sentences into natural speaking cadence.
  - Insert `[PAUSE]` indicators where necessary.
  - At the bottom of the table, include a **Shooting Checklist** of all required B-roll clips.
  ```
- **Discussion & Nuances:** 
  > [!TIP] Teleprompter Pacing
  > Standard conversational speaking rate is approximately 130–150 words per minute. BojuBot calculates reading time estimates based on this pacing.
- **See Also:** [Recipe 7.4: Canvas Video Beat Sheet](#recipe-7-4-canvas-video-beat-sheet-visual-storyboarding)

---

## Recipe 7.4: Canvas Video Beat Sheet & Visual Storyboarding

- **Difficulty:** 🟢 Beginner
- **Problem:** Spotting retention dead zones (e.g. talking on camera for 60 seconds without visual change) is difficult in text documents.
- **Solution:** Converts your video outline into a horizontal Canvas timeline with color-coded cards for host, screen recordings, B-roll, and retention spikes.
- **Prerequisites:** None (Obsidian Canvas).
- **Permission Level:** `Standard`
- **Context Workflow:** Active Note.
- **Recipe / Skill:** Save as `video-beat-sheet.md`:
  ```markdown
  ---
  category: Video
  description: Generate an interactive Canvas beat sheet color-coding talking head vs B-roll vs graphics
  autorun: true
  ---
  Convert the active video script into `[VideoName] - Beat Sheet.canvas`:

  Create connected cards arranged left-to-right representing the timeline:
  - 🟨 **Yellow Cards:** Host on camera / Talking head.
  - 🟦 **Blue Cards:** Screen recording / Terminal / Code walkthrough.
  - 🟩 **Green Cards:** Real-world B-roll demonstration.
  - 🟥 **Red Cards:** Retention spikes (sound effects, zooms, pattern interrupts).

  Ensure no stretch of talking-head cards exceeds 45 seconds without a visual cut. Open the canvas when finished.
  ```
- **Discussion & Nuances:** Provides a visual "pacing thermometer" for your video editing workflow.
- **See Also:** [Recipe 7.3: Dual-Column AV Video Scriptwriting](#recipe-7-3-dual-column-av-video-scriptwriting)

---

## Recipe 7.5: YouTube Chapter Timestamps via Whisper CLI

- **Difficulty:** 🔴 Advanced
- **Problem:** Manually scrubbing through an exported video timeline to type chapter markers into YouTube video descriptions is tedious manual work.
- **Solution:** Executes local Whisper CLI on your rendered audio, transcribing with timestamps and formatting the exact YouTube chapter marker block.
- **Prerequisites:** Local `whisper` CLI installed in OS PATH.
- **Permission Level:** `Full Access / Shell`
- **Context Workflow:** Chat prompt.
- **Recipe / Skill:** Direct chat prompt:
  ```text
  Run Whisper on `assets/audio/episode-12.mp3` to transcribe with timestamps. 
  Extract 5 to 7 clean chapter markers and write the YouTube description block to `Episode 12 - Metadata.md`.
  ```
- **Discussion & Nuances:** 
  > [!WARNING] Requires Whisper CLI
  > This recipe requires OpenAI's `whisper` binary installed in your command line environment.
  > 
  > **Zero-Install Alternative:** If you do not have Whisper installed, paste your rough script or video timestamps into chat and prompt BojuBot: *"Generate YouTube chapter markers and description from this text."*
- **See Also:** [Recipe 7.6: SRT Subtitle Cleaner & Technical Glossary Fixer](#recipe-7-6-srt-subtitle-cleaner-technical-glossary-fixer)

---

## Recipe 7.6: SRT Subtitle Cleaner & Technical Glossary Fixer

- **Difficulty:** 🟢 Beginner
- **Problem:** Automatic speech-to-text tools mishear niche programming libraries and command names (e.g. transcribing "Claude Code" as "clod code").
- **Solution:** Audits a raw `.srt` subtitle file against your project terminology, correcting phonetic errors while keeping timestamps intact.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** Chat prompt with file path.
- **Recipe / Skill:** Direct chat prompt:
  ```text
  Audit `captions.srt` against my project glossary. 
  Fix any phonetic misinterpretations (e.g., change 'clod code' to 'Claude Code', 'taiwind' to 'Tailwind', 'datavue' to 'Dataview'). 
  Preserve exact subtitle timestamps and line numbers.
  ```
- **Discussion & Nuances:** Saves 30 minutes of manual subtitle proofreading before uploading captions to YouTube.
- **See Also:** None.

---

## Recipe 7.7: Vertical 9:16 Clip Cutter (FFmpeg)

- **Difficulty:** 🔴 Advanced
- **Problem:** Slicing a long landscape video into vertical shorts for TikTok and Reels requires opening Premiere or DaVinci for simple cuts.
- **Solution:** Automatically runs FFmpeg to crop, center, and export a vertical 9:16 clip based on specified timestamps.
- **Prerequisites:** Local `ffmpeg` CLI installed in OS PATH.
- **Permission Level:** `Full Access / Shell`
- **Context Workflow:** Chat prompt.
- **Recipe / Skill:** Direct chat prompt:
  ```text
  Using FFmpeg, extract a clip from `assets/video/long-form.mp4` between 02:15 and 02:45. 
  Crop to 9:16 vertical (1080x1920) centered on the speaker, and save the result as `assets/video/short-clip-1.mp4`.
  ```
- **Discussion & Nuances:** 
  > [!WARNING] Requires FFmpeg CLI
  > This recipe requires the `ffmpeg` binary installed on your workstation.
- **See Also:** None.

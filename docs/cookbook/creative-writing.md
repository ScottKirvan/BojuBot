# 4. Creative Writing & Fiction

Psychological levers and momentum engines to overcome decision paralysis, defeat the inner critic, bridge awkward scene transitions, and inject unexpected creative constraints.

---

## Recipe 4.1: The Three Doors (Overcoming Decision Paralysis)

- **Difficulty:** 🟢 Beginner
- **Problem:** You know where your narrative or essay currently stands, but you are frozen trying to choose the "perfect" direction forward.
- **Solution:** Outlines three radically different continuations (The Expected Path, The Contrarian/Obstacle Path, and The Wildcard) to trigger your editorial instincts.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** Active Note (reads the last 300–500 words of the current file).
- **Recipe / Skill:** Save as `three-doors.md`:
  ```markdown
  ---
  category: Writing
  description: Break through decision paralysis with 3 divergent paths forward
  autorun: true
  ---
  Read the final 300–500 words of the active draft. 

  Present three distinctly different continuations to help me decide what comes next:

  ### 🚪 Door 1: The Logical Next Step
  [Develop the existing premise naturally; state the main argument or consequence that follows logically.]

  ### 🚪 Door 2: The Contrarian / Challenge Path
  [Introduce a sharp objection, counter-example, or sudden obstacle that complicates the situation.]

  ### 🚪 Door 3: The Wildcard / Lateral Shift
  [Pivot to an unexpected historical analogy, personal story, or shift in perspective that recontextualizes the point.]

  For each door, provide a 2-sentence premise and a sample opening sentence.
  ```
- **Discussion & Nuances:** 
  > [!TIP] The Value of Bad Options
  > You rarely have to choose any of the three verbatim. Seeing concrete options triggers your natural editorial instincts (*"Definitely not Door 2, but Door 1 gave me an idea..."*).
- **See Also:** [Recipe 4.3: Bridge the Chasm](#recipe-4-3-bridge-the-chasm-stuck-transitions), [Recipe 4.8: Story Roulette](#recipe-4-8-story-roulette-narrative-complications)

---

## Recipe 4.2: The Ugly Draft Machine (Taming the Inner Critic)

- **Difficulty:** 🟢 Beginner
- **Problem:** You freeze up trying to write elegant prose on the first pass.
- **Solution:** Ingests messy, rambling bullet points or voice-to-text transcriptions and drafts an aggressively casual, zero-fluff rough draft prioritizing momentum over polish.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** None / Modal input.
- **Recipe / Skill:** Save as `ugly-draft.md`:
  ```markdown
  ---
  category: Writing
  description: Convert messy thoughts or bullets into an unpretentious, high-momentum rough draft
  params:
    - id: rough_input
      type: textarea
      label: Raw notes / brain dump
      placeholder: Paste messy thoughts, bullets, or fragments here
  ---
  Convert the following rough notes into a continuous prose draft:

  <rough_notes>
  {{rough_input}}
  </rough_notes>

  Guidelines:
  1. **Aggressively Casual:** Prioritize momentum and clarity over polish. Do not attempt to sound literary, poetic, or academic.
  2. **Zero Fluff:** Cut transitional throat-clearing (e.g. "It is important to remember that...").
  3. **Preserve Nuance:** Keep the core technical ideas and specific examples intact.

  Append the resulting draft to the bottom of the active note.
  ```
- **Discussion & Nuances:** 
  > [!TIP] Dictation Synergy
  > This skill pairs extraordinarily well with mobile voice memos or speech-to-text. Paste your raw, stream-of-consciousness transcript into the field and let BojuBot provide structure.
- **See Also:** [Recipe 4.4: The Socratic Interviewer](#recipe-4-4-the-socratic-interviewer-low-energy-writing)

---

## Recipe 4.3: Bridge the Chasm (Stuck Transitions)

- **Difficulty:** 🟢 Beginner
- **Problem:** You know what Section A is, and you know what Section B needs to be, but you cannot figure out how to transition between them without it sounding awkward or abrupt.
- **Solution:** Generates 3 transitional bridges: a conceptual bridge, a rhetorical bridge, and a narrative/example bridge.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** None / Modal input.
- **Recipe / Skill:** Save as `bridge-the-chasm.md`:
  ```markdown
  ---
  category: Writing
  description: Generate 3 smooth transitional bridges between two disconnected sections
  params:
    - id: section_a
      type: textarea
      label: Ending of Section A
      placeholder: Paste the last paragraph of Section A
    - id: section_b
      type: textarea
      label: Beginning of Section B
      placeholder: Paste the opening paragraph of Section B
  ---
  Review the transition between Section A and Section B:

  **End of Section A:**
  "{{section_a}}"

  **Start of Section B:**
  "{{section_b}}"

  Generate 3 distinct transitional options (1–2 paragraphs each) to bridge the chasm:
  1. **Conceptual Bridge:** Links the two ideas through a shared underlying principle or contrasting consequence.
  2. **Rhetorical Bridge:** Poses an evocative question at the end of A that B directly answers.
  3. **Narrative / Example Bridge:** Uses a brief real-world scenario or technical incident to pivot naturally from A to B.
  ```
- **Discussion & Nuances:** Eliminates the classic writer's block obstacle where two strong sections sit separated by an empty paragraph.
- **See Also:** [Recipe 4.1: The Three Doors](#recipe-4-1-the-three-doors-overcoming-decision-paralysis)

---

## Recipe 4.4: The Socratic Interviewer (Low-Energy Writing)

- **Difficulty:** 🟢 Beginner
- **Problem:** Typing feels exhausting, you have writer's fatigue, or you can't untangle a complex concept in linear sentences.
- **Solution:** BojuBot becomes an inquisitive dialogue partner that reads what you have so far and asks one probing question at a time.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** Active Note.
- **Recipe / Skill:** Save as `socratic-interview.md`:
  ```markdown
  ---
  category: Writing
  description: An inquisitive dialogue partner that extracts your ideas one question at a time
  autorun: true
  ---
  Act as an inquisitive, peer-to-peer technical editor interviewing me about the topic in the active note.

  Read what I have written so far, then ask me **exactly one probing question** at a time to help me unpack:
  - Unstated assumptions
  - Real-world failure modes
  - What someone encountering this for the first time might misunderstand

  Do not offer praise or multiple questions. Ask one direct, punchy question and wait for my response.
  ```
- **Discussion & Nuances:** 
  > [!TIP] Compiling the Dialogue
  > You can answer in bullet points, rough fragments, or voice-to-text. After 4–5 turns, ask BojuBot: *"Compile my answers into a draft section."*
- **See Also:** [Recipe 4.2: The Ugly Draft Machine](#recipe-4-2-the-ugly-draft-machine-taming-the-inner-critic)

---

## Recipe 4.5: The Metaphor Foundry (Concretizing Abstract Concepts)

- **Difficulty:** 🟢 Beginner
- **Problem:** Explaining complex concepts in purely technical jargon makes writing dry, abstract, and forgettable.
- **Solution:** Generates 5 concrete, physical analogies drawn from non-technical domains (architecture, cooking, carpentry, maritime, biology).
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** Active Note or selection via `Alt+S` (`BojuBot: Send selection as context`).
- **Recipe / Skill:** Save as `metaphor-foundry.md`:
  ```markdown
  ---
  category: Writing
  description: Generate 5 concrete, physical analogies drawn from distinct non-software domains
  autorun: true
  ---
  Analyze the highlighted concept or active section.

  Generate 5 concrete physical analogies to help a reader visualize this concept:
  1. **Civil Engineering / Architecture:** Structures, foundations, load-bearing walls.
  2. **Maritime Navigation / Aviation:** Currents, waypoints, instruments, ballast.
  3. **Culinary / Kitchen Management:** Mise en place, heat regulation, reduction.
  4. **Carpentry / Woodworking:** Grain, joinery, jigs, tolerances.
  5. **Biology / Ecology:** Symbiosis, feedback loops, metabolic cost.

  For each analogy, write a 2-sentence explanation demonstrating how it maps to the core technical idea.
  ```
- **Discussion & Nuances:** A single strong metaphor can anchor an entire chapter or essay.
- **See Also:** None.

---

## Recipe 4.6: The Devil's Advocate / Skeptical Reader

- **Difficulty:** 🟢 Beginner
- **Problem:** Writing stalls because an argument feels ungrounded or repetitive, and you don't know what counter-arguments to address.
- **Solution:** Adopts the lens of a battle-tested, skeptical reader pushing back with 3 unsentimental objections.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** Active Note.
- **Recipe / Skill:** Save as `devils-advocate.md`:
  ```markdown
  ---
  category: Writing
  description: A ruthless, skeptical critic pushing back on the active argument with 3 objections
  autorun: true
  ---
  Adopt the lens of a battle-tested, skeptical senior practitioner reading the active draft.

  Push back on the core thesis with **3 sharp, unsentimental objections**:
  1. *"Where does this break down under production pressure or high scale?"*
  2. *"What unintended negative behavior does this practice incentivize?"*
  3. *"Why is this not just unnecessary overhead compared to simpler alternatives?"*

  Force me to defend my ideas. Keep the tone collegial but rigorous.
  ```
- **Discussion & Nuances:** Defending an idea against a concrete objection is much easier than generating prose in a vacuum.
- **See Also:** [Recipe 4.4: The Socratic Interviewer](#recipe-4-4-the-socratic-interviewer-low-energy-writing)

---

## Recipe 4.7: Oblique Strategies (Breaking Writing Ruts)

- **Difficulty:** 🟢 Beginner
- **Problem:** The prose feels formulaic, repetitive, or drained of energy.
- **Solution:** Injects Brian Eno-style arbitrary creative constraints (e.g., verb bans, hazard label descriptions, in-media-res cuts) to reframe your thinking.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** Active Note.
- **Recipe / Skill:** Save as `oblique-strategies.md`:
  ```markdown
  ---
  category: Creative
  description: Inject arbitrary creative constraints (inspired by Brian Eno) to jolt momentum
  autorun: true
  ---
  Review the active section. Choose and apply one of the following arbitrary constraints to the next rewrite:

  1. **The Verb Constraint:** Rewrite the next 200 words without using any form of the verb "to be" (*is, was, were, be, being, been*).
  2. **The Hazard Label:** Explain the core concept as if drafting the text for a hazardous material safety warning card.
  3. **The In-Media-Res Cut:** Delete the first two introductory sentences and begin directly inside the moment of failure.
  4. **The Monosyllabic Pass:** Rewrite the explanation using only common, short words without technical jargon.

  Provide the rewritten snippet and explain how the constraint reframed the idea.
  ```
- **Discussion & Nuances:** Imposing strict arbitrary rules often unlocks surprising, memorable turns of phrase.
- **See Also:** [Recipe 4.8: Story Roulette](#recipe-4-8-story-roulette-narrative-complications)

---

## Recipe 4.8: Story Roulette (Narrative Complications)

- **Difficulty:** 🟢 Beginner
- **Problem:** Fiction or narrative nonfiction scenes stall when characters achieve their immediate objective too easily without tension.
- **Solution:** Injects a randomized narrative complication, physical constraint, or sensory limitation into the active scene.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** Active Note.
- **Recipe / Skill:** Save as `story-roulette.md`:
  ```markdown
  ---
  category: Creative
  description: Inject a randomized narrative complication or physical obstacle into the active scene
  autorun: true
  ---
  Read the active scene. 

  Roll a narrative complication to raise the stakes:
  1. **Sensory Deprivation:** Introduce a sudden physical change in the environment (loss of light, deafening sound, extreme cold).
  2. **Social Disruption:** An unexpected third person enters the room who must not discover what the other two characters are discussing.
  3. **Ticking Clock:** Introduce an unavoidable time deadline that cuts the current dialogue or task in half.

  Present a 3-sentence scene continuation applying one of these complications.
  ```
- **Discussion & Nuances:** Keeps storytelling dynamic and eliminates predictable plot lines.
- **See Also:** [Recipe 4.1: The Three Doors](#recipe-4-1-the-three-doors-overcoming-decision-paralysis)

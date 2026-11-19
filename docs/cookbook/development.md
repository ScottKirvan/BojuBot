# 8. Developer & Multi-Agent Workflows

Bridge software engineering, repository telemetry, documentation maintenance, and autonomous subagent supervision directly from your Obsidian vault.

---

## Recipe 8.1: Developer Cognition: "Where Was I?"

- **Difficulty:** 🔴 Advanced
- **Problem:** Returning to a repository after an interruption or weekend leaves you disoriented, wasting 15 minutes checking dirty diffs and stashes.
- **Solution:** Inspects git working trees, uncommitted diffs, recent commit logs, and current branches to compile an instant 60-second resumption briefing.
- **Prerequisites:** Vault must be initialized as a Git repository (`git init`).
- **Permission Level:** `Full Access / Shell`
- **Context Workflow:** None.
- **Recipe / Skill:** Save as `where-was-i.md`:
  ```markdown
  ---
  category: Engineering
  description: Inspect git diffs and branch status to provide an instant resumption briefing
  autorun: true
  ---
  Inspect the local git repository status:
  1. Check the current branch and recent commit history (last 3 commits).
  2. Inspect uncommitted changes (`git status` and `git diff --stat`).
  3. Check if there are any active stashes.

  Generate a concise 4-bullet "Where Was I?" briefing:
  - **Active Branch & Focus:** What branch are we on and what issue/feature does it target?
  - **Unfinished Work:** What files are currently dirty and what was the apparent direction of the edits?
  - **Recent Progress:** What was the last thing committed?
  - **Recommended Next Step:** What test should be run or file edited to resume momentum?
  ```
- **Discussion & Nuances:** 
  > [!NOTE] Git Repository Required
  > This recipe runs `git status` and `git diff` commands. If your vault is synced via iCloud or Obsidian Sync without Git tracking, this recipe will not apply.
- **See Also:** [Recipe 8.8: Work Session Flow Reconstructor](#recipe-8-8-work-session-flow-reconstructor)

---

## Recipe 8.2: Code-to-Doc Drift Auditor

- **Difficulty:** 🟢 Beginner
- **Problem:** As features evolve in `src/`, documentation in `docs/` silently drifts out of date, leaving stale parameters and missing options.
- **Solution:** Compares exported interfaces, CLI flags, and settings in recent commits against user guides, drafting the missing paragraphs.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** None / Modal input.
- **Recipe / Skill:** Save as `doc-drift-auditor.md`:
  ```markdown
  ---
  category: Documentation
  description: Cross-reference recent source code changes against documentation guides
  params:
    - id: source_path
      type: input
      label: Source file/folder
      default: src/
    - id: docs_path
      type: input
      label: Documentation folder
      default: docs/
  ---
  Compare recent changes in `{{source_path}}` against documentation in `{{docs_path}}`.

  1. Review exported types, settings fields, or command IDs introduced or modified in the last 10 commits.
  2. Search `{{docs_path}}` to see if those additions are documented.
  3. Report any drift:
   - **Undocumented Additions:** New options, methods, or behaviors absent from docs.
   - **Stale Examples:** Deprecated signatures still referenced in user guides.
  4. Draft the missing paragraphs in the exact style and tone of the existing documentation pages.
  ```
- **Discussion & Nuances:** Keeps public documentation in sync with production code without separate audit sprints.
- **See Also:** None.

---

## Recipe 8.3: Conventional Changelog & Release Synthesizer

- **Difficulty:** 🔴 Advanced
- **Problem:** Writing release notes manually from Git histories is slow and prone to omitting bug fixes or contributor credits.
- **Solution:** Parses conventional commits (`feat:`, `fix:`, `docs:`, `chore:`) since the last tag, categorizing changes into release announcements.
- **Prerequisites:** Vault must be a Git repository with Conventional Commits.
- **Permission Level:** `Full Access / Shell`
- **Context Workflow:** None.
- **Recipe / Skill:** Save as `release-changelog.md`:
  ```markdown
  ---
  category: Engineering
  description: Generate a structured changelog entry from conventional commits since the last tag
  autorun: true
  ---
  Analyze git commits since the most recent release tag.

  Group the changes following Conventional Commits standards:
  - 🚀 **Features (`feat:`):** New capabilities visible to users.
  - 🐛 **Bug Fixes (`fix:`):** Resolved issues and behavioral corrections.
  - 📚 **Documentation (`docs:`):** Additions or updates to guides.
  - ⚙️ **Under the Hood (`refactor:`, `chore:`, `perf:`):** Internal refactoring, performance improvements, and dependencies.

  Format the output ready to be appended to `CHANGELOG.md` or used as GitHub Release notes.
  ```
- **Discussion & Nuances:** Integrates cleanly with automated versioning tools like `release-please`.
- **See Also:** None.

---

## Recipe 8.4: Automated GitHub Issue Kanban Sync

- **Difficulty:** 🔴 Advanced
- **Problem:** Updating Obsidian Kanban boards manually against GitHub issues and pull requests requires constant manual dragging.
- **Solution:** Queries open GitHub issues and PRs via `gh`, formatting an interactive `obsidian-kanban` Markdown board note.
- **Prerequisites:** Community plugin `obsidian-kanban`, GitHub CLI (`gh`) installed and authenticated via `gh auth login`.
- **Permission Level:** `Full Access / Shell`
- **Context Workflow:** None / Modal input.
- **Recipe / Skill:** Save as `kanban-sync.md`:
  ```markdown
  ---
  category: Engineering
  description: Query GitHub issues and update an obsidian-kanban markdown board
  params:
    - id: repo
      type: input
      label: GitHub Repo
      placeholder: e.g. owner/repo
  ---
  Query GitHub issues using `gh issue list --repo {{repo}} --state open --limit 30`.

  Update or generate the Kanban board note `GitHub Backlog.md` with the following structure:

  ---
  kanban-plugin: basic
  ---

  ## Backlog
  [Issues without assignees or labeled `help wanted` / `good first issue`]

  ## In Progress
  [Issues with assignees or labeled `in progress`]

  ## Ready for Review
  [Pull requests currently open targeting main]

  Format each card as:
  - [ ] #[IssueNumber]: [Title] ([Labels])
  ```
- **Discussion & Nuances:** 
  > [!WARNING] Requires GitHub CLI Authentication
  > Verify your GitHub CLI is signed in by running `gh auth status` before executing this recipe.
- **See Also:** None.

---

## Recipe 8.5: Autonomous Subagent Assignment Generator

- **Difficulty:** 🟢 Beginner
- **Problem:** Handing off tasks to autonomous AI coding agents (such as Claude Code, Antigravity CLI, or background subagents) fails if prompts lack pre-flight checks and strict file seams.
- **Solution:** Ingests an issue number, checks repository rules (e.g. `AGENTS.md`), and compiles an airtight, turnkey assignment prompt.
- **Prerequisites:** None.
- **Permission Level:** `Standard`
- **Context Workflow:** None / Modal input.
- **Recipe / Skill:** Save as `agent-task-brief.md`:
  ```markdown
  ---
  category: Agent Supervision
  description: Compile an AGENTS.md-compliant assignment brief for an autonomous subagent
  params:
    - id: issue_number
      type: input
      label: Issue Number or Description
  ---
  Read the requirements for issue {{issue_number}} and consult `AGENTS.md`.

  Compile a turnkey assignment brief for an autonomous subagent containing:
  1. **Goal Summary:** Clear one-paragraph objective.
  2. **Pre-flight Checks:** Exact commands to run before writing code (`node --version`, `git status`, `npm test`).
  3. **Seam & Boundary Rules:** Which files may be edited and which must not be touched.
  4. **Testing Criteria:** Happy path and edge case test expectations.
  5. **Conventional Commit & PR Template:** Required commit format and regression callout headings.

  Output the complete launch command ready to pass to the agent CLI.
  ```
- **Discussion & Nuances:** Ensures subagents execute autonomously without going off the rails or editing unauthorized files.
- **See Also:** [Recipe 8.10: Autonomous PR Reviewer & Sanity Checker](#recipe-8-10-autonomous-pr-reviewer-sanity-checker)

---

## Recipe 8.6: Code Archaeologist ("Why Does This Line Exist?")

- **Difficulty:** 🔴 Advanced
- **Problem:** You encounter a bizarre edge-case check or regex in code; there are no comments, and you fear refactoring it will trigger regressions.
- **Solution:** Traces the code history via `git log -S` and `git blame` across branches to tell the narrative story of what production bug originally prompted it.
- **Prerequisites:** Vault must be initialized as a Git repository.
- **Permission Level:** `Full Access / Shell`
- **Context Workflow:** Chat prompt.
- **Recipe / Skill:** Direct chat prompt:
  ```text
  Run `git log -S` and `git blame` on line 142 of `src/parser.ts`. 
  Find the original commit that introduced this logic, read the pull request discussion and commit message, and tell me the narrative story of what production bug this was designed to solve.
  ```
- **Discussion & Nuances:** 
  > [!NOTE] Git Tracking Required
  > Unlocks tribal knowledge buried deep in Git history without leaving your Obsidian chat panel.
- **See Also:** [Recipe 8.9: Bug Post-Mortem & Knowledge Base Extractor](#recipe-8-9-bug-post-mortem-knowledge-base-extractor)

---

## Recipe 8.7: Git Telemetry & Commit Cadence Burn-Up

- **Difficulty:** 🔴 Advanced
- **Problem:** Development velocity metrics in GitHub Insights or Jira are disconnected from the vault notes where you plan your sprints.
- **Solution:** Analyzes git logs to count commits, compute net code churn, and generate a native Mermaid `xychart-beta` bar chart.
- **Prerequisites:** Vault must be initialized as a Git repository.
- **Permission Level:** `Full Access / Shell`
- **Context Workflow:** None.
- **Recipe / Skill:** Save as `git-telemetry.md`:
  ```markdown
  ---
  category: Engineering
  description: Analyze git log commit velocity and generate an Obsidian Mermaid xychart-beta
  autorun: true
  ---
  Analyze git commit history for the last 30 days:
  1. Count the number of commits per week.
  2. Calculate net lines added vs. deleted.
  3. Determine the ratio of human commits vs. bot/agent merges.

  Output a native Mermaid `xychart-beta` bar chart illustrating weekly velocity, followed by a 3-bullet analysis of momentum toward the next release tag.
  ```
- **Discussion & Nuances:** Mermaid `xychart-beta` is built natively into Obsidian and requires zero plugins.
- **See Also:** None.

---

## Recipe 8.8: Work Session Flow Reconstructor

- **Difficulty:** 🔴 Advanced
- **Problem:** At the end of a long day of coding, you have no record of where the hours went or what was accomplished for your work log.
- **Solution:** Inspects local git commit timestamps, stashes, and diffs, writing a chronological milestone log into today's active Daily Note.
- **Prerequisites:** Vault must be initialized as a Git repository.
- **Permission Level:** `Full Access / Shell`
- **Context Workflow:** Active Note (focused on today's daily note).
- **Recipe / Skill:** Save as `session-reconstructor.md`:
  ```markdown
  ---
  category: Engineering
  description: Analyze commit timestamps and diff sizes to log focused coding bursts to today's daily note
  autorun: true
  ---
  Inspect local git commits and stash activity made today:
  1. Extract commit timestamps, commit messages, and files touched.
  2. Identify focused coding bursts vs. idle time.
  3. Append a clean `## Work Session Log` section into today's active Daily Note, listing the chronological milestones shipped today.
  ```
- **Discussion & Nuances:** Automatically documents your engineering work without interrupting your coding flow.
- **See Also:** [Recipe 8.1: Developer Cognition: "Where Was I?"](#recipe-8-1-developer-cognition-where-was-i)

---

## Recipe 8.9: Bug Post-Mortem & Knowledge Base Extractor

- **Difficulty:** 🔴 Advanced
- **Problem:** Fixed bugs are rarely documented, leading to the same architectural mistakes recurring months later.
- **Solution:** Analyzes the resolved commit diff and PR discussion, generating an architectural "Lesson Learned" note with invariant rules.
- **Prerequisites:** Vault must be initialized as a Git repository.
- **Permission Level:** `Full Access / Shell`
- **Context Workflow:** None / Modal input.
- **Recipe / Skill:** Save as `bug-postmortem.md`:
  ```markdown
  ---
  category: Documentation
  description: Convert a resolved bug commit and discussion into an architectural Lesson Learned note
  params:
    - id: issue_or_commit
      type: input
      label: Issue # or Commit Hash
  ---
  Analyze the commit diff and resolution for {{issue_or_commit}}:

  Generate a permanent "Lesson Learned" note in `Notes/Postmortems/`:
  1. **Trigger Incident:** What symptom or error was observed?
  2. **Root Cause Analysis:** Why did the architecture allow this state to occur?
  3. **The Fix:** Summary of code changes and tests added to prevent regression.
  4. **Permanent Invariant:** What rule should future developers (and AI agents) follow when editing this subsystem?

  Link the note back to relevant architectural notes in the vault.
  ```
- **Discussion & Nuances:** Forms a permanent institutional knowledge base that AI agents can consult before refactoring code.
- **See Also:** [Recipe 8.6: Code Archaeologist ("Why Does This Line Exist?")](#recipe-8-6-code-archaeologist-why-does-this-line-exist)

---

## Recipe 8.10: Autonomous PR Reviewer & Sanity Checker

- **Difficulty:** 🔴 Advanced
- **Problem:** Reviewing automated PRs from bots or outside contributors requires manually verifying commit formats, test suites, and regression risks.
- **Solution:** Evaluates PR diffs via `gh`, checking against repository guidelines and staging a comprehensive review comment.
- **Prerequisites:** GitHub CLI (`gh`) installed and authenticated.
- **Permission Level:** `Full Access / Shell`
- **Context Workflow:** None / Modal input.
- **Recipe / Skill:** Save as `pr-sanity-checker.md`:
  ```markdown
  ---
  category: Agent Supervision
  description: Audit an open PR against repo standards, conventional commits, and test checklists
  params:
    - id: pr_number
      type: input
      label: Pull Request #
  ---
  Review pull request #{{pr_number}} using `gh pr view {{pr_number}}` and `gh pr diff {{pr_number}}`:

  Audit against repository standards:
  - [ ] Conventional Commit format followed in title and commits.
  - [ ] Includes `## Testing` manual verification steps.
  - [ ] Includes `## Regression Risk` section with specific callouts.
  - [ ] Unit tests added or updated for new public methods.
  - [ ] No gitignored build artifacts (`main.js`, `styles.css`) included in diff.

  Draft a clean review comment summarizing approvals and blockers.
  ```
- **Discussion & Nuances:** Catches low-level standards violations before you spend human review time on architectural choices.
- **See Also:** [Recipe 8.5: Autonomous Subagent Assignment Generator](#recipe-8-5-autonomous-subagent-assignment-generator)

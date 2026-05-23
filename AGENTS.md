# AGENTS.md — BojuBot Development Guide

BojuBot is an Obsidian plugin that runs a Claude Code CLI subprocess inside a vault,
providing an agentic chat panel for reading, writing, creating, moving, and organizing
notes. Desktop only (Windows, Mac, Linux). No mobile support.

-----

## Agent Identity

- GitHub username: `SKVFX-DevBot`
- Fork URL: `https://github.com/SKVFX-DevBot/BojuBot`
- Upstream URL: `https://github.com/ScottKirvan/BojuBot`
- Local clone: `~/BojuBot`

**Recommended invocation:**

```bash
claude --allowedTools "Read" "Edit" "Write" "Glob" "Grep" "Bash(git:*)" "Bash(npm:*)" "Bash(npx:*)" "Bash(gh:*)" "Bash(node:*)" "Bash(cd:*)" \
  -p "Clone https://github.com/SKVFX-DevBot/BojuBot to ~/BojuBot if it does not already exist, then read AGENTS.md from that directory and work on the next available issue."
```

**Verify `gh` authentication before doing anything else:**

```bash
gh auth status
```

If not authenticated, run `gh auth login` and select HTTPS when prompted. If auth fails and cannot be resolved, log the error and exit — do not proceed.

-----

## Repository Overview

GitHub: `https://github.com/ScottKirvan/BojuBot`

> The tree below may be outdated. The local clone is authoritative. Run `git ls-files` for the canonical file list.

```
BojuBot/
├── main.ts                      # Plugin entry point (root-level, compiled from src/)
├── main.js                      # Compiled output (gitignored in source control)
├── styles.css                   # Plugin stylesheet (gitignored in source control)
├── manifest.json                # Obsidian plugin manifest (do not edit version manually)
├── package.json
├── tsconfig.json
├── esbuild.config.mjs           # Build configuration
├── src/                         # TypeScript source
│   ├── ClaudeProcess.ts         # Claude Code CLI subprocess lifecycle
│   ├── ClaudeSession.ts         # Session state and serialization
│   ├── ClaudeView.ts            # Main chat panel (Obsidian ItemView)
│   ├── ContextGenerationModal.ts
│   ├── ContextManager.ts        # Vault context injection
│   ├── FrontmatterGuard.ts      # Prevents accidental frontmatter corruption
│   ├── QueryHandler.ts          # User input → subprocess routing
│   ├── UIBridge.ts              # @@BOJU_ACTION dispatch layer
│   ├── constants.ts
│   ├── settings.ts              # Plugin settings tab and defaults
│   ├── declarations.d.ts        # Ambient type declarations
│   ├── modals/
│   │   ├── AboutModal.ts
│   │   ├── ExportToVaultModal.ts
│   │   └── SessionListModal.ts
│   └── utils/
│       ├── fileTree.ts          # Vault file tree generation for context
│       ├── logger.ts            # [BojuBot]-prefixed debug logging
│       ├── sessionStorage.ts    # Persist/load chat sessions
│       └── shellEnv.ts         # Shell environment resolution for subprocess
└── test/
    └── unit.test.ts             # Unit tests (Node built-in test runner via tsx)
```

-----

## Development Environment

**Prerequisites:**

- Node.js 18 or later (required for the built-in `--test` runner used by `npm test`)
- Claude Code CLI installed and authenticated
- Obsidian desktop with a test vault

**Setup:**

```bash
npm install
npm run dev       # watch mode, compiles main.ts → main.js
```

**Build:**

```bash
npm run build
```

**Tests:**

```bash
npm test          # runs: npx tsx --test test/unit.test.ts (Node built-in test runner)

# Run a single test by name pattern:
npx tsx --test --test-name-pattern="<pattern>" test/unit.test.ts
```

-----

## Session Pre-flight

Before selecting an issue or writing any code, run these checks in order. Stop and alert the user if any step fails.

```bash
# 1. Verify Node version (must be 18+)
node --version

# 2. Verify gh is authenticated as the agent account
gh auth status

# 3. Verify git remotes are correct
git remote -v   # origin → SKVFX-DevBot/BojuBot, upstream → ScottKirvan/BojuBot

# 4. Verify clean working tree on main
git status      # must show: On branch main, nothing to commit

# 5. Sync with upstream
git fetch upstream && git rebase upstream/main   # must succeed with no conflicts

# 6. Verify baseline tests pass before making any changes
npm test
```

If `gh auth status` fails, run `gh auth login` and select HTTPS. If any other step fails, stop and alert the user — do not proceed.

-----

## Fork Workflow

Contributions to BojuBot are made via personal forks. Do not push branches directly to
`ScottKirvan/BojuBot`. The upstream repository is `https://github.com/ScottKirvan/BojuBot`.

**Initial setup (once):**

```bash
# Fork ScottKirvan/BojuBot on GitHub, then:
git clone git@github.com:<your-account>/BojuBot.git
cd BojuBot
git remote add upstream https://github.com/ScottKirvan/BojuBot.git
```

**Before starting any issue — mandatory:**

```bash
git remote -v   # confirm 'origin' points to fork and 'upstream' points to ScottKirvan/BojuBot
git fetch upstream
git checkout main
git rebase upstream/main
git push origin main          # keep your fork's main current
```

If `upstream` is not set, run:

```bash
git remote add upstream https://github.com/ScottKirvan/BojuBot.git
```

Do not skip this step. PRs submitted against a stale base will be closed.

If `git rebase upstream/main` encounters conflicts, stop immediately and alert the user — do not attempt to resolve conflicts on `main`.

**After submitting a PR — mandatory:**

```bash
git checkout main             # return to main when done
```

After the PR is created, update the issue's project board status to `Pending Review` using the same `gh project item-edit` pattern from Issue Handling.

Always restore the local repo to `main` after your work is complete. Do not leave the repo
checked out on a feature branch. The next session (human or agent) should always start from
a known state.

**Submit PRs** from a branch on your fork targeting `ScottKirvan/BojuBot:main`.

-----

## Branching and Commits

- Prefer the `Glob` tool for finding files by pattern and the `Grep` tool for searching file contents over `find | xargs grep` bash patterns — they require no extra permissions and avoid compound command prompts
- **Never use `cd && <command>` compound patterns** — they trigger a security prompt that blocks autonomous operation. Always use full paths or command-specific flags instead:

  | Instead of                  | Use                            |
  | --------------------------- | ------------------------------ |
  | `cd ~/BojuBot && git <cmd>` | `git -C ~/BojuBot <cmd>`       |
  | `cd ~/BojuBot && npm <cmd>` | `npm --prefix ~/BojuBot <cmd>` |
  | `cd ~/BojuBot && ls <path>` | `ls ~/BojuBot/<path>`          |
  | `cd ~/BojuBot && npx <cmd>` | `npx --prefix ~/BojuBot <cmd>` |
- Branch naming: `feat/short-description`, `fix/short-description`, `docs/short-description`
- One issue per branch. Branch from your fork’s `main` (after syncing upstream). PR targets upstream `main`.
- **Commit messages must follow Conventional Commits** — release-please depends on this:

| Prefix      | When to use                         |
| ----------- | ----------------------------------- |
| `feat:`     | New user-visible feature            |
| `fix:`      | Bug fix                             |
| `docs:`     | Documentation only                  |
| `test:`     | Adding or fixing tests              |
| `refactor:` | Code change with no behavior change |
| `chore:`    | Build, deps, config                 |

- Write commit message to temp file (use Write tool or echo): `git -C ~/BojuBot commit -F /tmp/commit-msg.txt`
- Breaking changes: add `!` after prefix (`feat!:`) and include `BREAKING CHANGE:` in footer.
- Scope is optional but encouraged: `feat(session):`, `fix(ui):`, `docs(readme):`

-----

## Deliverable Checklist

Every PR must include all of the following. Do not submit a PR with items missing.

- [ ] **Code** — implements the feature or fix described in the issue
- [ ] **Unit tests** — new or updated tests covering the changed behavior; must include the happy path and at least one failure or edge case for each new public function
- [ ] **Docs** — inline JSDoc on public methods; update README or User Guide if behavior is user-visible
- [ ] **Testing procedure** — a `## Testing` section in the PR description (see format below)
- [ ] **Regression callouts** — a `## Regression Risk` section in the PR description (see format below)

-----

## PR Description Format

```markdown
## Summary
[One paragraph: what this PR does and why.]

## Issue
Closes #[issue number]

## Testing
[Step-by-step instructions a human reviewer can follow to manually verify the feature works.
Be specific: which Obsidian settings to enable, what to type in the chat panel, what the
expected result is.]

1. Open Obsidian with a test vault that has BojuBot enabled.
2. ...
3. Expected: ...

## Regression Risk
[List any existing functionality that could be affected by this change.
If none, write "None identified" — do not leave blank.]

- Session persistence: [affected / not affected, reason]
- Vault file operations: [affected / not affected, reason]
- Claude Code subprocess lifecycle: [affected / not affected, reason]
- [add others as relevant]

## Notes
[Anything else the reviewer should know: known limitations, follow-up issues, 
design decisions made.]
```

-----

## Code Style

- TypeScript strict mode — no `any` unless unavoidable, and comment why
- Obsidian API patterns: use `this.app`, `this.app.vault`, `Notice`, `Modal` etc. as appropriate
- Do not use `console.log` in production paths — use the logging utilities from `src/utils/logger.ts`:

```typescript
import { log, warn, logv } from ‘./utils/logger’;

log(‘ClaudeProcess’, ‘subprocess started’);   // INFO — always written
warn(‘UIBridge’, ‘unknown action’, action);   // WARN — always written
logv(‘ContextManager’, ‘tree depth’, depth);  // INFO — verbose mode only
```
- Async/await preferred over raw Promise chains
- No external runtime dependencies without discussion — Obsidian plugins run in a sandboxed environment

-----

## Testing Approach

Obsidian’s plugin API is not easily headless. Unit tests should:

- Mock the Obsidian `App`, `Vault`, and `Plugin` interfaces — use the existing mock patterns in `test/unit.test.ts`
- Test logic that doesn’t require a live Obsidian instance: parsing, state management, subprocess communication, session serialization
- Not mock everything into uselessness — if a test only asserts that a mock was called, reconsider whether it provides value

**What agents should not attempt to test via unit tests:**

- Actual Obsidian UI rendering
- Live Claude Code CLI subprocess behavior

These are covered by manual testing (see PR `## Testing` section) and eventually by BojuBot-driven integration tests.

-----

## Issue Handling

Issues are tracked on the upstream repo. Always use `--repo ScottKirvan/BojuBot` with `gh` commands:

```bash
gh issue list --repo ScottKirvan/BojuBot
```

**If no issue is specified, select one as follows:**

1. Filter to open issues with label `good first issue` or `help wanted`
2. Exclude any issue that is already assigned, has an open PR, has project board status `In Progress` or `Pending Review`, or is labeled `needs discussion` or `blocked`
3. Prefer smaller, self-contained issues over large ones
4. Pick the highest-priority remaining issue using this label order: `critical` > `high` > `medium` > `low`. Unlabeled issues have unknown priority — treat them as `medium` and flag the missing label in your claim comment
5. Comment on the issue stating you are picking it up before doing anything else — this prevents collisions with other agents or contributors

**Once you have an issue (assigned or self-selected):**

- Read the full issue before starting, including any linked issues or prior comments
- **Before writing any code**, check whether the fix or feature has already been implemented. If it has, add a clear comment to the issue explaining what was found and where, then set the issue label/status to `Duplicate: Needs Review` — do not open a PR.
- Assign the issue to yourself (`gh issue edit <number> --repo ScottKirvan/BojuBot --add-assignee SKVFX-DevBot`) and set its status to `In Progress` on the project board (project: **BojuBot Public Roadmap**, number: **3**, owner: **ScottKirvan**). Use the following to discover field and option IDs at runtime, then update the item:

```bash
# Get project field IDs and option IDs
gh project field-list 3 --owner ScottKirvan

# Get item ID for the issue (match by issue number in output)
gh project item-list 3 --owner ScottKirvan --format json

# Update the Status field (use node IDs from above)
gh project item-edit --id <item-node-id> --project-id <project-node-id> --field-id <status-field-id> --single-select-option-id <in-progress-option-id>
```
- If the issue has acceptance criteria, your PR must satisfy all of them
- If acceptance criteria are missing or ambiguous, add a `## Assumptions` section to the PR description listing what you assumed
- If the issue is too large to complete in one PR, comment on the issue describing the split before proceeding
- If the agent's account already has a comment on the issue from a prior session, treat the issue as already claimed — do not post a duplicate claim comment. Check whether a branch for this issue exists on the fork (`git branch -r | grep <issue-keyword>`) before starting fresh work, in case the prior session left partial progress.

-----

## Partial Implementations

If you cannot fully implement an issue — blocked by complexity, a dependency, or scope
that turned out larger than expected — do not abandon the work or leave it uncommitted.
Partial progress is often still valuable.

**What to do:**

1. Commit everything that is complete and working on your branch
2. Submit a PR using `Addresses #[issue number]` instead of `Closes #[issue number]`
   — this prevents GitHub from auto-closing the issue on merge
3. Add a `## Remaining Work` section to the PR description:
- What was completed
- What was not completed
- Why (blocked by what, too complex in what specific way, what would be needed to finish)
- Any relevant technical findings that would help whoever picks it up next
1. Post a comment on the original issue with the same summary, so the issue’s history
   is self-contained for the next contributor

**Do not:**

- Open new issues for the remaining work — that is the maintainer’s call
- Restructure or re-scope the original issue — leave it as-is
- Submit a PR that `Closes` an issue you have not fully implemented

-----

## AGENTS.md Feedback Log

If you encounter anything that contradicts, is missing from, or is inaccurate in this document — wrong paths, stale commands, missing steps, unclear instructions — append a note to `AGENTS_FEEDBACK.md` in the repo root:

```bash
echo "## [$(date -u +%Y-%m-%dT%H:%M:%SZ)] <brief description>\n\n<details>\n" >> AGENTS_FEEDBACK.md
```

Do not stop work to report it — just log it and continue. A human will review the file and update AGENTS.md accordingly. Do not commit `AGENTS_FEEDBACK.md` as part of a feature/fix PR — commit it separately as `docs: agents feedback`.

-----

## Escalation Policy

Stop and notify the user rather than guessing or proceeding if any of the following occur:

- Rebase conflicts on `main`
- `npm test` failures not caused by the agent's own changes
- Ambiguous acceptance criteria that could lead to multiple valid implementations
- An issue that appears already fixed but is still open
- A required permission (GitHub assignment, label, project board update) that fails
- Any pre-flight check that cannot be resolved automatically

Do not attempt workarounds. Log the blocker clearly and wait for instruction.

-----

## What NOT to Do

- Do not bump version numbers manually — release-please handles versioning
- Do not commit `main.js`, `styles.css` build artifacts — these are gitignored
- Do not modify `manifest.json` version field manually
- Do not add dependencies to `package.json` without noting it in the PR summary
- Do not commit `package-lock.json` changes unless new packages were intentionally added — if `npm install` modifies the lockfile without a dependency change, stash or discard it before creating the PR; if a legitimate update is needed, commit it separately as `chore: update package-lock.json`
- Do not submit a PR that fails tests (`npm test`)
- Do not submit a PR with TypeScript errors (`npm run build` must pass)
- Do not leave the repo checked out on a feature branch — always `git checkout main` when done
- Do not `git push --force` or `git push --force-with-lease` to any branch without explicit user approval
- Do not close, reopen, or delete issues — only comment, assign, and label
- Do not use `$()` command substitution in bash commands — use the `Write` tool to create a temp file (e.g. `/tmp/commit-msg.txt`) and reference it instead (e.g. `git commit -F /tmp/commit-msg.txt`)
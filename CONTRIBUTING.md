# Contributing to BojuBot

Thank you for considering contributing to BojuBot! This document covers how to report bugs, suggest features, and submit code changes.

## Code of Conduct

This project is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold it.

---

## Reporting Bugs

Before filing a bug report, check [existing issues](https://github.com/ScottKirvan/BojuBot/issues) to avoid duplicates.

**Include in your bug report:**
- Steps to reproduce
- What you expected vs. what happened
- Obsidian version, OS, and BojuBot version
- Any relevant error messages from the developer console (Ctrl/Cmd+Shift+I in Obsidian)

---

## Suggesting Features

Use the [feature request template](https://github.com/ScottKirvan/BojuBot/issues/new?template=feature_request.md). Describe the use case clearly — what problem it solves and how you'd expect it to work.

---

## Development Setup

### Prerequisites

- Node.js 18+
- npm
- Claude Code CLI installed **and logged in** natively in PowerShell (not just in WSL on Windows)
  - Install: `irm https://claude.ai/install.ps1 | iex` (PowerShell) or `curl -fsSL https://claude.ai/install.sh | bash` (Mac/Linux)
  - Verify: `claude --version`
  - Log in: run `claude` in a terminal — it will prompt for authentication on first launch, or type `/login` inside the REPL
- Obsidian desktop
- A throwaway test vault (do not develop against your real vault)

### Clone and Build

```bash
git clone https://github.com/ScottKirvan/BojuBot.git
cd BojuBot
npm install
npm run build      # one-shot build → main.js
npm run dev        # watch mode (rebuilds on save)
```

### Test Vault Setup

Link the plugin into a throwaway Obsidian vault for live testing.

**Mac/Linux:**
```bash
ln -s /path/to/BojuBot /path/to/test-vault/.obsidian/plugins/bojubot
```

**Windows (PowerShell, run as admin):**
```powershell
New-Item -ItemType Directory -Force -Path "D:\test-vault\.obsidian\plugins"
New-Item -ItemType SymbolicLink `
  -Path "D:\test-vault\.obsidian\plugins\bojubot" `
  -Target "D:\path\to\BojuBot"
```

In Obsidian:
1. Open the test vault
2. Settings → Community Plugins → disable Safe Mode
3. Enable **BojuBot** in the installed plugins list

### Fast Iteration

Install the [Hot Reload](https://github.com/pjeby/hot-reload) community plugin in your test vault. With `npm run dev` running, saving any source file rebuilds and reloads the plugin automatically — no manual restart needed.

Without Hot Reload: use Ctrl/Cmd+P → "Reload app without saving" after each build.

### Project Structure

```
BojuBot/
  main.ts                      ← plugin entry point, commands, custom icon registration
  manifest.json                ← plugin metadata (id, name, version)
  package.json
  tsconfig.json
  esbuild.config.mjs           ← bundles main.js; embeds assets as base64 data URLs
  styles.css
  assets/
    media/
      logo.png                 ← About modal / plugin browser logo (embedded at build time)
  src/
    ClaudeView.ts              ← chat panel UI, session state, setup/auth error panels
    ClaudeProcess.ts           ← binary detection, spawn (PowerShell on Win), stream-json parsing
    ContextManager.ts          ← vault tree + context file + memory instruction assembly
    ContextGenerationModal.ts  ← first-run modal for context file setup
    UIBridge.ts                ← @@BOJU_ACTION protocol: parse + execute Obsidian UI actions
    settings.ts                ← settings schema and settings tab UI
    declarations.d.ts          ← TypeScript module declarations (e.g. *.jpg imports)
    modals/
      SessionListModal.ts      ← session history list modal
      AboutModal.ts            ← about / help modal
    utils/
      shellEnv.ts              ← shell environment resolution
      fileTree.ts              ← vault folder/file tree builder
      sessionStorage.ts        ← session CRUD, .jsonl parse, canResumeLocally
      logger.ts                ← file + console logging, estimateTokens
  test/
    unit.test.ts               ← unit tests (npm test)
    stdin-quote-test.mjs       ← end-to-end stdin/quote test (calls Claude)
    spawn-test.mjs             ← standalone spawn smoke test
  notes/                       ← user guide, changelog, TODO
  notes/dev/                   ← internal design docs (not user-facing)
  .github/                     ← CI workflow, release-please config, issue templates
```

---

## Commit Message Convention

BojuBot uses [Conventional Commits](https://www.conventionalcommits.org/) — these drive automated versioning via [release-please](https://github.com/googleapis/release-please).

| Prefix             | Effect          | Use for                         |
| ------------------ | --------------- | ------------------------------- |
| `feat:`            | bumps MINOR     | new user-facing feature         |
| `fix:`             | bumps PATCH     | bug fix                         |
| `feat!:` / `fix!:` | bumps MAJOR     | breaking change                 |
| `docs:`            | no version bump | documentation only              |
| `refactor:`        | no version bump | code change, no behavior change |
| `chore:`           | no version bump | maintenance, deps, tooling      |
| `test:`            | no version bump | adding or updating tests        |

**Examples:**
```
feat: add session resume on panel open
fix: correct binary detection on Windows
docs: add frontmatter schema to user guide
chore: update esbuild to 0.21
feat!: change context file default path to _claude-context.md
```

---

## Pull Request Process

1. Fork the repo and create a branch from `main`
2. Make your changes — keep PRs focused on a single concern
3. Ensure `npm run build` passes with no TypeScript errors
4. Update documentation (`docs` folder, `README.md`) if your change affects user-facing behavior
5. Submit the PR — describe what changed and why

CHANGELOG is generated automatically by release-please from commit messages; you don't need to edit it manually.

---

## Questions?

Open an issue, or reach out via:
- [LinkedIn](https://www.linkedin.com/in/scottkirvan/)
- [Discord](https://discord.gg/TN6XJSNK5Y) — cptvideo

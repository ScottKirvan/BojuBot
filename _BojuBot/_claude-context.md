# Vault Context

This file serves as persistent memory across BojuBot sessions in this vault. It is automatically injected at the start of each session.

## Vault Overview
- **Repository / Vault:** BojuBot development workspace and test vault.
- **Project Purpose:** BojuBot is an Obsidian plugin that integrates AI agents (Claude Code CLI and Google Antigravity CLI) directly into Obsidian for note management, synthesis, and workflow automation.

## Structure & Key Locations
- `src/` — Plugin TypeScript source code (backends, views, session management, UI bridge, modals, utilities).
- `test/` — Unit test suite (`test/unit.test.ts`).
- `docs/` — VitePress documentation and user guides.
- `.obsidian/` — Vault settings and active plugins (`bojubot`, `hot-reload`, `obsidian-git`, `unhide`, `obsidian42-brat`).
- `_BojuBot/` — Plugin storage (`_claude-context.md`, exported sessions, skills).

## Conventions & Workflow
- **Commit Style:** Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).
- **Code Standards:** TypeScript strict mode, no bare `console.log` in production (use `src/utils/logger.ts`).
- **Testing:** Verify changes with `npm test` before committing.
- **Protocol:** Inter-process UI actions and queries use the `@@BOJU` line format.

## Primary Role & Focus
- **Core Tasks:** Assist with **testing** (test plans, manual testing, QA validation), **documentation** (VitePress docs, guides, feature references), and **creating skills** (`_BojuBot/skills`).
- **Code Boundary:** Do **not** work on or edit application source code (`src/`). Code implementation is handled separately.

## Notes for Assistant
- Current active backend is Google Antigravity CLI (`gemini-3.8-flash`).
- Default permission mode is Standard (full note read/write; shell commands require explicit permission).
- User interaction rule: When the user asks a question, answer it directly. Do not edit or modify files unless explicitly instructed to do so.
- Maintain this file with concise, high-signal observations as workflows evolve.

_Last updated: 2026-11-17_

# Obsidian Claude Plugin — Technical Bootstrap

**Purpose:** Day-one setup checklist. Get from zero to a running plugin in a test vault.

---

## Prerequisites

Confirm these are in place before starting:

- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] Claude Code installed and authenticated (`claude --version` to verify; run `claude` to launch the REPL and type `/login` to authenticate)
- [ ] Obsidian desktop installed
- [ ] A test vault ready (can be a throwaway vault — don't develop against your real vault until the plugin is stable)

---

## 1. Scaffold the Plugin

Anthropic's official Obsidian sample plugin is the right starting point:

```bash
git clone https://github.com/obsidianmd/obsidian-sample-plugin.git obsidian-claude-plugin
cd obsidian-claude-plugin
npm install
```

Key files in the scaffold:

```
obsidian-claude-plugin/
  main.ts          ← entry point, your primary workspace
  manifest.json    ← plugin metadata (id, name, version, minAppVersion)
  styles.css       ← plugin CSS
  esbuild.config.mjs  ← build config (usually don't need to touch)
  package.json
```

Update `manifest.json` immediately:

```json
{
  "id": "obsidian-claude",
  "name": "Claude",
  "version": "0.1.0",
  "minAppVersion": "1.0.0",
  "description": "Claude Code integration for Obsidian vaults",
  "author": "Scott",
  "authorUrl": "",
  "isDesktopOnly": true
}
```

`isDesktopOnly: true` is important — this plugin uses Node APIs unavailable in mobile.

---

## 2. Install into Test Vault

The plugin needs to live inside the vault's `.obsidian/plugins/` directory. Easiest approach during development: symlink.

```bash
# Mac/Linux
ln -s /path/to/obsidian-claude-plugin /path/to/test-vault/.obsidian/plugins/obsidian-claude

# Windows (PowerShell, run as admin)
New-Item -ItemType SymbolicLink -Path "C:\vault\.obsidian\plugins\obsidian-claude" -Target "C:\dev\obsidian-claude-plugin"
```

In Obsidian:
1. Settings → Community Plugins → turn off Safe Mode
2. Community Plugins → Installed Plugins → enable "Claude"

After each build, use Ctrl/Cmd+P → "Reload app without saving" to pick up changes. Or install the **Hot Reload** community plugin to automate this.

---

## 3. Build

**One-shot build:**
```bash
npm run build
```

**Watch mode (recommended during development):**
```bash
npm run dev
```

Watch mode rebuilds on every save. With [Hot Reload](https://github.com/pjeby/hot-reload) installed in the test vault, the plugin reloads automatically. The iteration loop becomes: save file → plugin reloads → test.

Build output is `main.js` in the project root, which gets picked up by the symlink.

---

## 4. TypeScript Config for Node APIs

The scaffold's default `tsconfig.json` may not include Node types. Confirm/update:

```bash
npm install --save-dev @types/node
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "inlineSourceMap": true,
    "inlineSources": true,
    "module": "ESNext",
    "target": "ES6",
    "allowSyntheticDefaultImports": true,
    "moduleResolution": "node",
    "lib": ["dom", "es5", "es6", "es7"],
    "types": ["node"]
  },
  "include": ["**/*.ts"]
}
```

---

## 5. Shell Environment Resolution

Run this once at plugin startup to capture the user's full shell environment. Cache the result — don't run on every spawn.

```typescript
import { execSync } from 'child_process';

function resolveShellEnv(): Record<string, string> {
  try {
    const shell = process.env.SHELL || '/bin/bash';
    const output = execSync(`${shell} -l -c env`, {
      encoding: 'utf8',
      timeout: 5000,
    });
    
    const env: Record<string, string> = {};
    for (const line of output.split('\n')) {
      const idx = line.indexOf('=');
      if (idx > 0) {
        const key = line.substring(0, idx);
        const val = line.substring(idx + 1);
        env[key] = val;
      }
    }
    return env;
  } catch (e) {
    console.warn('Shell env resolution failed, falling back to process.env', e);
    return { ...process.env } as Record<string, string>;
  }
}
```

On Windows, adjust to use `cmd.exe /c set` or PowerShell equivalent, or skip and rely on settings override.

---

## 6. Claude Binary Detection

Check locations in order, use the first hit:

```typescript
import { existsSync } from 'fs';
import { join } from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

function findClaudeBinary(settingsOverride?: string): string | null {
  // 1. User settings override
  if (settingsOverride && existsSync(settingsOverride)) {
    return settingsOverride;
  }

  // 2. Shell resolution (respects user's PATH properly)
  try {
    const result = execSync('which claude', { encoding: 'utf8' }).trim();
    if (result && existsSync(result)) return result;
  } catch {}

  // 3. Known install locations
  const home = os.homedir();
  const candidates = [
    join(home, '.local', 'bin', 'claude'),           // Linux/Mac native install
    join(home, '.npm-global', 'bin', 'claude'),       // npm global install
    '/usr/local/bin/claude',                          // system install
    join(home, 'AppData', 'Local', 'Programs', 'claude', 'claude.exe'), // Windows
    join(home, '.local', 'bin', 'claude.exe'),        // Windows alt
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}
```

If a settings override path is provided but doesn't exist, return `null` immediately — do not fall through to auto-detect. This makes misconfigured paths explicit rather than silently ignored.

If `null` is returned, show a full setup panel in the chat view with platform-specific install instructions, copy buttons, and an "Open terminal" button to launch authentication.

---

## 7. Spawning Claude

Basic spawn pattern for non-interactive use:

```typescript
import { spawn, ChildProcess } from 'child_process';

function spawnClaude(
  binaryPath: string,
  prompt: string,
  vaultRoot: string,
  env: Record<string, string>
): ChildProcess {
  const args = [
    '--output-format', 'stream-json',
    '--print',
    '--no-update',          // don't auto-update mid-session
    prompt
  ];

  return spawn(binaryPath, args, {
    cwd: vaultRoot,
    env: env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}
```

For conversation continuation, add `--resume <sessionId>` or `--continue` to args.

---

## 8. Stream-JSON Parsing

Claude outputs newline-delimited JSON objects. Parse incrementally:

```typescript
function parseStreamOutput(
  process: ChildProcess,
  onText: (delta: string) => void,
  onToolCall: (tool: string, input: unknown) => void,
  onDone: () => void,
  onError: (err: string) => void
) {
  let buffer = '';

  process.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? ''; // keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        handleStreamMessage(msg, onText, onToolCall, onDone);
      } catch {
        // not all lines are JSON — skip
      }
    }
  });

  process.stderr?.on('data', (chunk: Buffer) => {
    onError(chunk.toString());
  });

  process.on('close', onDone);
}

function handleStreamMessage(
  msg: Record<string, unknown>,
  onText: (delta: string) => void,
  onToolCall: (tool: string, input: unknown) => void,
  onDone: () => void
) {
  switch (msg.type) {
    case 'content_block_delta':
      if ((msg.delta as Record<string, unknown>)?.type === 'text_delta') {
        onText(((msg.delta as Record<string, unknown>).text as string) ?? '');
      }
      break;
    case 'tool_use':
      onToolCall(msg.name as string, msg.input);
      break;
    case 'message_stop':
      onDone();
      break;
  }
}
```

---

## 9. Obsidian Plugin Entry Point Structure

Minimal `main.ts` to validate everything is wired:

```typescript
import { Plugin, WorkspaceLeaf } from 'obsidian';
import { ClaudeView, VIEW_TYPE_CLAUDE } from './src/ClaudeView';
import { ClaudeSettings, DEFAULT_SETTINGS, ClaudeSettingsTab } from './src/settings';

export default class ClaudePlugin extends Plugin {
  settings: ClaudeSettings;
  shellEnv: Record<string, string> = {};
  claudeBinaryPath: string | null = null;

  async onload() {
    await this.loadSettings();

    // Resolve environment once at startup
    this.shellEnv = await resolveShellEnv();
    this.claudeBinaryPath = findClaudeBinary(this.settings.binaryPath);

    if (!this.claudeBinaryPath) {
      // Show notice — don't hard fail
      new Notice('Claude plugin: claude binary not found. Check settings.');
    }

    // Register the chat view
    this.registerView(VIEW_TYPE_CLAUDE, (leaf) => new ClaudeView(leaf, this));

    // Register a custom SVG icon, then use it for the ribbon.
    // Pass only the inner SVG elements (no <svg> wrapper); use currentColor for all strokes/fills.
    // Obsidian expects a 0 0 100 100 coordinate space.
    addIcon('bojubot', `
      <path d="M10,32 C24,12 38,12 50,32 C62,52 76,52 90,32"
            stroke="currentColor" fill="none" stroke-width="8" stroke-linecap="round"/>
      <path d="M10,50 C24,30 38,30 50,50 C62,70 76,70 90,50"
            stroke="currentColor" fill="none" stroke-width="8" stroke-linecap="round"/>
      <path d="M10,68 C24,48 38,48 50,68 C62,88 76,88 90,68"
            stroke="currentColor" fill="none" stroke-width="8" stroke-linecap="round"/>
    `);

    // Ribbon icon to open panel
    this.addRibbonIcon('bojubot', 'BojuBot', () => {
      this.activateView();
    });

    this.addSettingTab(new ClaudeSettingsTab(this.app, this));
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_CLAUDE);

    if (existing.length) {
      leaf = existing[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE_CLAUDE, active: true });
    }

    workspace.revealLeaf(leaf);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
```

---

## 10. Recommended File Structure

```
obsidian-claude-plugin/
  main.ts                  ← plugin entry, minimal
  manifest.json
  styles.css
  package.json
  tsconfig.json
  esbuild.config.mjs
  src/
    ClaudeView.ts          ← chat panel UI (ItemView subclass)
    ClaudeSession.ts       ← session load/save/resume logic
    ClaudeProcess.ts       ← binary detection, spawn, stream parsing
    ContextManager.ts      ← context file, pinned notes, frontmatter scanning
    FrontmatterGuard.ts    ← intercept writes, enforce readonly/protect
    settings.ts            ← settings schema and settings tab UI
    utils/
      shellEnv.ts
      fileTree.ts          ← vault folder tree builder
      sessionStorage.ts    ← read/write .obsidian/claude/sessions/
```

---

## References

- [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin)
- [Obsidian Plugin API Docs](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [Obsidian Plugin Developer Docs](https://docs.obsidian.md/Home)
- [Claude Code CLI Docs](https://code.claude.com/docs)
- [Cline source (reference implementation)](https://github.com/cline/cline)

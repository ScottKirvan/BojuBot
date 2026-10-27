/**
 * UI Bridge reliability check for the Antigravity backend (agent-backends spec, "Testing").
 * Sends 20 one-turn prompts with the real Standard-mode orientation and scores the
 * @@BOJU lines each model emits. Uses real agy quota (about 12k tokens per prompt),
 * so it is not part of `npm test`.
 *
 *   npx tsx test/agy-bridge-check.ts [model ...]     (no model = Antigravity's default)
 *
 * BRIDGE_ONLY=8,19,20   run only those cases (1-based)
 * BRIDGE_VERBOSE=1      print each reply and tool call input
 *
 * Runs in a throwaway vault under the OS temp dir's sibling D:\2\deleteme on Windows
 * (writes inside %TEMP% behave differently in agy), or BRIDGE_VAULT if set.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { findAgyBinary, spawnAgy, parseAgyStream, ANTIGRAVITY_ORIENTATION } from '../src/backends/antigravity';
import { renderOrientation } from '../src/utils/orientation';
import { BOJU_PREFIX } from '../src/constants';

(globalThis as unknown as { window: typeof globalThis }).window = globalThis;

const ACTIONS = new Set(['open-file', 'open-file-split', 'open-file-new-tab', 'navigate-heading', 'show-notice', 'set-label', 'report-problem',
  'request-permission', 'rename-file', 'move-file', 'delete-file', 'open-settings', 'focus-search', 'run-command']);
const QUERIES = new Set(['backlinks', 'outlinks', 'tags', 'file-list', 'help']);

interface Case {
  prompt: string;
  /** Every one of these must appear, as action names or query types. */
  expect: string[];
  /** None of these may appear (confirm-first actions, or any line for plain questions: '*'). */
  forbid?: string[];
}

const CASES: Case[] = [
  { prompt: 'Open Projects/Plan.md', expect: ['open-file'] },
  { prompt: 'Open Projects/Plan.md in a split pane to the right', expect: ['open-file-split'] },
  { prompt: 'Open Inbox/todo.md in a new tab', expect: ['open-file-new-tab'] },
  { prompt: 'Jump to the "Next Steps" heading in Projects/Plan.md', expect: ['navigate-heading'] },
  { prompt: "Pop up a notice that says 'Backup done'", expect: ['show-notice'] },
  { prompt: 'My name is Scott, please call me that from now on', expect: ['set-label'] },
  { prompt: 'Rename Inbox/todo.md to tasks.md', expect: ['rename-file'] },
  { prompt: 'Move Inbox/todo.md into the Archive folder', expect: ['move-file'] },
  { prompt: 'Delete Inbox/scratch.md', expect: ['delete-file'] },
  { prompt: 'Open the quick switcher for me', expect: [], forbid: ['focus-search'] },
  { prompt: 'Show me which notes link to Projects/Plan.md', expect: ['backlinks'] },
  { prompt: 'Show me what Projects/Plan.md links to', expect: ['outlinks'] },
  { prompt: 'What tags does Projects/Plan.md have?', expect: ['tags'] },
  { prompt: 'Show me a list of the files in the Projects folder', expect: ['file-list'] },
  { prompt: 'Open Projects/Plan.md and Inbox/todo.md side by side', expect: ['open-file', 'open-file-split'] },
  { prompt: "What's a good title for a note about sourdough starters? Just suggest one.", expect: [], forbid: ['*'] },
  { prompt: 'Open Projects/Plan.md in a new tab and jump to its Goals heading', expect: ['open-file-new-tab', 'navigate-heading'] },
  { prompt: 'Open Inbox/scratch.md', expect: ['open-file', 'show-notice'] },
  { prompt: 'Find the notes tagged #project', expect: ['tags'] },
  { prompt: 'Rename Projects/Plan.md to Roadmap.md', expect: ['rename-file'] },
];

function makeVault(root: string): void {
  rmSync(root, { recursive: true, force: true });
  const files: Record<string, string> = {
    'Projects/Plan.md': '---\ntags: [project, planning]\n---\n# Plan\n\n## Goals\nShip it.\n\n## Next Steps\n- [[Inbox/todo]]\n',
    'Projects/Notes.md': 'See [[Plan]].\n',
    'Inbox/todo.md': '- buy milk\n',
    'Inbox/scratch.md': 'scratch\n',
    'Archive/.keep': '',
  };
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), body);
  }
}

interface TurnResult { names: string[]; invalid: string[]; tools: string[]; log: string[]; error?: string }

function runTurn(binary: string, cwd: string, prompt: string, model?: string): Promise<TurnResult> {
  return new Promise((resolve) => {
    const r: TurnResult = { names: [], invalid: [], tools: [], log: [] };
    const take = (line: string, kind: 'action' | 'query') => {
      try {
        const obj = JSON.parse(line.slice(BOJU_PREFIX.length)) as Record<string, unknown>;
        const name = String(kind === 'action' ? obj.action : obj.query);
        if ((kind === 'action' ? ACTIONS : QUERIES).has(name)) r.names.push(name);
        else r.invalid.push(line);
      } catch { r.invalid.push(line); }
    };
    const proc = spawnAgy({ binaryPath: binary, prompt, cwd, env: { ...process.env } as Record<string, string>, permissionMode: 'standard', model });
    parseAgyStream(proc, {
      onText: (t) => {
        r.log.push(`text: ${t.trim()}`);
        if (t.includes(BOJU_PREFIX.trim())) r.invalid.push(...t.split('\n').filter(l => l.includes(BOJU_PREFIX.trim())));
      },
      onAction: (l) => { r.log.push(l); take(l, 'action'); },
      onQuery: (l) => { r.log.push(l); take(l, 'query'); },
      onToolCall: (name, input) => { r.tools.push(name); r.log.push(`tool ${name} ${JSON.stringify(input)}`); },
      onPermissionDenied: () => { /* scored by lines only */ },
      onUsage: () => { /* not scored */ },
      onApiError: (e) => { r.error = e.message; },
      onError: () => { /* stderr is not scored */ },
      onDone: () => resolve(r),
    });
  });
}

async function checkModel(binary: string, vault: string, template: string, model?: string): Promise<void> {
  const orientation = renderOrientation(template, {
    identityName: 'BojuBot', supportLine: 'https://github.com/ScottKirvan/BojuBot', cwdDisplay: 'vault root',
    customCwd: false, permissionMode: 'standard', backend: ANTIGRAVITY_ORIENTATION,
  });
  let lines = 0, invalid = 0, passed = 0;
  console.log(`\n=== ${model ?? 'Antigravity default model'}`);
  const only = (process.env.BRIDGE_ONLY ?? '').split(',').filter(Boolean).map(Number);
  const cases = only.length ? CASES.filter((_c, i) => only.includes(i + 1)) : CASES;
  for (const c of cases) {
    makeVault(vault); // file actions may have changed it
    const r = await runTurn(binary, vault, `<vault_context>\n${orientation}\n</vault_context>\n\n${c.prompt}`, model);
    lines += r.names.length + r.invalid.length;
    invalid += r.invalid.length;
    const missing = c.expect.filter(n => !r.names.includes(n));
    const forbidden = (c.forbid ?? []).filter(n => (n === '*' ? r.names.length > 0 : r.names.includes(n)));
    const ok = !r.error && missing.length === 0 && forbidden.length === 0 && r.invalid.length === 0;
    if (ok) passed++;
    const why = [
      r.error && `error: ${r.error}`,
      missing.length && `missing ${missing.join(', ')}`,
      forbidden.length && `unwanted ${forbidden.join(', ')}`,
      r.invalid.length && `invalid ${r.invalid.length}`,
    ].filter(Boolean).join('; ');
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.prompt}\n      lines: ${r.names.join(', ') || '(none)'}${r.tools.length ? `  tools: ${r.tools.join(', ')}` : ''}${why ? `\n      ${why}` : ''}`);
    if (process.env.BRIDGE_VERBOSE) for (const l of r.log) console.log(`        ${l.slice(0, 300)}`);
  }
  console.log(`--- ${model ?? 'default'}: ${passed}/${cases.length} prompts passed; ${lines - invalid}/${lines} @@BOJU lines valid`);
}

(async () => {
  const binary = findAgyBinary();
  if (!binary) throw new Error('agy not found');
  const template = readFileSync(join(__dirname, '..', 'src', 'orientation.md'), 'utf8').split('\r').join('');
  const vault = process.env.BRIDGE_VAULT ?? (process.platform === 'win32' ? 'D:\\2\\deleteme\\agy-bridge-vault' : join(tmpdir(), '..', 'agy-bridge-vault'));
  const models = process.argv.slice(2);
  for (const m of models.length ? models : [undefined]) await checkModel(binary, vault, template, m);
  rmSync(vault, { recursive: true, force: true });
})().catch((e: unknown) => { console.error(e); process.exit(1); });

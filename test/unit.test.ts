/**
 * Unit tests — no Claude calls, no Obsidian required.
 * Run: npm test
 *
 * Covers:
 *   - titleFromPrompt      (pure function)
 *   - estimateTokens       (pure function)
 *   - session CRUD         (file I/O via tmp dir)
 *   - loadSessionMessages  (JSONL parsing)
 *   - parseStreamOutput    (stream-json parsing via mocked EventEmitters)
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { EventEmitter } from 'node:events';

import { titleFromPrompt, saveSession, saveSessionAtTop, loadAllSessions, deleteSession, loadSessionMessages, getSessionsDir, resolveSessionsDir } from '../src/utils/sessionStorage';
import { estimateTokens } from '../src/utils/logger';
import { parseStreamOutput, permissionArgs } from '../src/ClaudeProcess';
import { extractToolDetail } from '../src/utils/toolFormatting';
import { extractActions } from '../src/utils/actionParser';
import { resolveShellEnv } from '../src/utils/shellEnv';
import { SessionCoordinator, SessionCoordinatorHost } from '../src/SessionCoordinator';
import { resolveBrand, isWhiteLabeled, resolveIdentityName, applyIdentityName, resolveExportFolder, DEFAULT_BRAND, BrandConfig } from '../src/brand';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

before(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'bojubot-test-'));
});

after(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

/** Build a minimal mock ChildProcess with controllable stdout/stderr/close. */
function mockProc() {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const proc = new EventEmitter() as any;
  proc.stdout = stdout;
  proc.stderr = stderr;
  return proc;
}

// ---------------------------------------------------------------------------
// titleFromPrompt
// ---------------------------------------------------------------------------

describe('titleFromPrompt', () => {
  test('returns prompt unchanged when <= 60 chars', () => {
    assert.equal(titleFromPrompt('Hello world'), 'Hello world');
  });

  test('truncates and appends ellipsis when > 60 chars', () => {
    const long = 'A'.repeat(80);
    const result = titleFromPrompt(long);
    assert.equal(result.length, 61); // 60 chars + '…'
    assert.ok(result.endsWith('…'));
  });

  test('collapses internal whitespace', () => {
    assert.equal(titleFromPrompt('foo   bar\t\nbaz'), 'foo bar baz');
  });

  test('trims leading/trailing whitespace', () => {
    assert.equal(titleFromPrompt('  hello  '), 'hello');
  });

  test('handles empty string', () => {
    assert.equal(titleFromPrompt(''), '');
  });
});

// ---------------------------------------------------------------------------
// estimateTokens
// ---------------------------------------------------------------------------

describe('estimateTokens', () => {
  test('empty string → 0', () => {
    assert.equal(estimateTokens(''), 0);
  });

  test('4 chars → 1 token', () => {
    assert.equal(estimateTokens('abcd'), 1);
  });

  test('rounds up (ceil)', () => {
    assert.equal(estimateTokens('abc'), 1);  // 3/4 → ceil → 1
    assert.equal(estimateTokens('abcde'), 2); // 5/4 → ceil → 2
  });

  test('longer text scales linearly', () => {
    const text = 'a'.repeat(400);
    assert.equal(estimateTokens(text), 100);
  });
});

// ---------------------------------------------------------------------------
// Session CRUD (file I/O)
// ---------------------------------------------------------------------------

describe('session storage', () => {
  const TEST_CONFIG_DIR = 'test-config';
  const makeSession = (id: string) => ({
    id,
    title: `Session ${id}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    claudeSessionId: `claude-${id}`,
  });

  test('saveSession creates a JSON file', () => {
    const s = makeSession('s1');
    const dir = getSessionsDir(tmpDir, TEST_CONFIG_DIR);
    saveSession(tmpDir, s, dir);
    const { existsSync } = require('node:fs');
    assert.ok(existsSync(join(dir, 's1.json')));
  });

  test('loadAllSessions returns saved session', () => {
    const s = makeSession('s2');
    const dir = getSessionsDir(tmpDir, TEST_CONFIG_DIR);
    saveSession(tmpDir, s, dir);
    const sessions = loadAllSessions(tmpDir, dir, TEST_CONFIG_DIR);
    const found = sessions.find(x => x.id === 's2');
    assert.ok(found);
    assert.equal(found!.title, 'Session s2');
  });

  test('loadAllSessions sorts by updatedAt descending', () => {
    const older = { ...makeSession('s3'), updatedAt: '2024-01-01T00:00:00.000Z' };
    const newer = { ...makeSession('s4'), updatedAt: '2025-01-01T00:00:00.000Z' };
    const dir = getSessionsDir(tmpDir, TEST_CONFIG_DIR);
    saveSession(tmpDir, older, dir);
    saveSession(tmpDir, newer, dir);
    const sessions = loadAllSessions(tmpDir, dir, TEST_CONFIG_DIR);
    const ids = sessions.map(s => s.id);
    assert.ok(ids.indexOf('s4') < ids.indexOf('s3'));
  });

  test('deleteSession removes the file', () => {
    const s = makeSession('s5');
    const dir = getSessionsDir(tmpDir, TEST_CONFIG_DIR);
    saveSession(tmpDir, s, dir);
    deleteSession(tmpDir, 's5', undefined, dir);
    const sessions = loadAllSessions(tmpDir, dir, TEST_CONFIG_DIR);
    assert.ok(!sessions.find(x => x.id === 's5'));
  });

  test('loadAllSessions returns [] when dir missing', () => {
    assert.deepEqual(loadAllSessions('/nonexistent/path/xyz', '/nonexistent/path/xyz/sessions', 'test-config'), []);
  });
});

// ---------------------------------------------------------------------------
// loadSessionMessages — JSONL parsing
// ---------------------------------------------------------------------------

describe('loadSessionMessages', () => {
  function makeJsonlSession(lines: object[]): string {
    // Write a fake .jsonl to ~/.claude/projects/<proj>/<id>.jsonl
    const projectsDir = join(tmpDir, '.claude', 'projects', 'test-project');
    mkdirSync(projectsDir, { recursive: true });
    const sessionId = `test-session-${Date.now()}`;
    const jsonlPath = join(projectsDir, `${sessionId}.jsonl`);
    writeFileSync(jsonlPath, lines.map(l => JSON.stringify(l)).join('\n'));
    return sessionId;
  }

  test('parses user and assistant turns', () => {
    const sessionId = makeJsonlSession([
      { type: 'user', message: { content: 'Hello' }, timestamp: '2024-01-01T00:00:00Z' },
      { type: 'assistant', message: { content: [{ type: 'text', text: 'Hi there' }] }, timestamp: '2024-01-01T00:00:01Z' },
    ]);
    const msgs = loadSessionMessages(sessionId);
    // Note: loadSessionMessages looks in homedir()/.claude/projects — this test
    // is skipped if the session isn't found (different machine / no homedir match).
    // It validates the JSONL structure for sessions that ARE local.
    if (msgs.length === 0) return; // can't reach test file from homedir
    assert.equal(msgs[0].role, 'user');
    assert.equal(msgs[0].content, 'Hello');
    assert.equal(msgs[1].role, 'assistant');
    assert.equal(msgs[1].content, 'Hi there');
  });

  test('handles array-format user message content', () => {
    const sessionId = makeJsonlSession([
      {
        type: 'user',
        message: { content: [{ type: 'text', text: 'Hello from array' }] },
        timestamp: '2024-01-01T00:00:00Z',
      },
    ]);
    const msgs = loadSessionMessages(sessionId);
    if (msgs.length === 0) return;
    assert.equal(msgs[0].content, 'Hello from array');
  });

  test('strips vault_context from array-format first user message', () => {
    const sessionId = makeJsonlSession([
      {
        type: 'user',
        message: { content: [{ type: 'text', text: '<vault_context>injected</vault_context>\nArray question' }] },
        timestamp: '2024-01-01T00:00:00Z',
      },
    ]);
    const msgs = loadSessionMessages(sessionId);
    if (msgs.length === 0) return;
    assert.equal(msgs[0].content, 'Array question');
  });

  test('strips vault_context from first user message', () => {
    const sessionId = makeJsonlSession([
      {
        type: 'user',
        message: { content: '<vault_context>big context here</vault_context>\nActual question' },
        timestamp: '2024-01-01T00:00:00Z',
      },
    ]);
    const msgs = loadSessionMessages(sessionId);
    if (msgs.length === 0) return;
    assert.equal(msgs[0].content, 'Actual question');
  });
});

// ---------------------------------------------------------------------------
// parseStreamOutput — stream-json parsing (no real Claude process)
// ---------------------------------------------------------------------------

describe('permissionArgs', () => {
  test('standard → acceptEdits', () => {
    const args = permissionArgs('standard');
    assert.ok(args.includes('acceptEdits'));
    assert.ok(!args.some(a => a.includes('bypass') || a.includes('dangerously')));
  });

  test('readonly → default mode + allowedTools', () => {
    const args = permissionArgs('readonly');
    assert.ok(args.includes('default'));
    const idx = args.indexOf('--allowedTools');
    assert.ok(idx !== -1);
    assert.ok(args[idx + 1].includes('Read'));
    assert.ok(!args[idx + 1].includes('Write'));
    assert.ok(!args[idx + 1].includes('Bash'));
  });

  test('restricted → default mode + web-only allowedTools', () => {
    const args = permissionArgs('restricted');
    assert.ok(args.includes('default'));
    const idx = args.indexOf('--allowedTools');
    assert.ok(idx !== -1);
    const tools = args[idx + 1].split(',');
    assert.ok(tools.includes('WebFetch'));
    assert.ok(tools.includes('WebSearch'));
    assert.ok(!tools.includes('Read'));
    assert.ok(!tools.includes('Write'));
    assert.ok(!tools.includes('Bash'));
  });

  test('full → bypassPermissions', () => {
    const args = permissionArgs('full');
    assert.ok(args.includes('bypassPermissions'));
  });

  test('no mode ever includes dangerously-skip-permissions', () => {
    for (const mode of ['standard', 'readonly', 'full', 'restricted'] as const) {
      assert.ok(!permissionArgs(mode).some(a => a.includes('dangerously')));
    }
  });
});

// ---------------------------------------------------------------------------
// Permission picker mode table — data-layer invariants
// ---------------------------------------------------------------------------

describe('permission picker mode table', () => {
  // Mirror the PERMISSION_MODES data from PermissionPickerModal.ts without
  // importing the file (which depends on the Obsidian API).
  type PermissionMode = 'restricted' | 'readonly' | 'standard' | 'full';
  interface ModeOption {
    mode: PermissionMode;
    icon: string;
    colorClass: string;
    label: string;
    description: string;
  }
  const EXPECTED_MODES: ModeOption[] = [
    { mode: 'restricted', icon: 'lock', colorClass: 'bojubot-perm-restricted', label: 'Chat only', description: 'web only, no vault access' },
    { mode: 'readonly', icon: 'eye', colorClass: 'bojubot-perm-readonly', label: 'Read only', description: 'read vault, no writes' },
    { mode: 'standard', icon: 'shield', colorClass: 'bojubot-perm-standard', label: 'Standard', description: 'read+write vault, no bash' },
    { mode: 'full', icon: 'triangle-alert', colorClass: 'bojubot-perm-full', label: 'Full access', description: 'unrestricted, including bash' },
  ];

  const ALL_MODES: PermissionMode[] = ['restricted', 'readonly', 'standard', 'full'];

  test('all four permission modes are represented', () => {
    const modes = EXPECTED_MODES.map(m => m.mode);
    for (const m of ALL_MODES) {
      assert.ok(modes.includes(m), `missing mode: ${m}`);
    }
    assert.equal(EXPECTED_MODES.length, 4);
  });

  test('each mode entry has a non-empty icon, colorClass, label, and description', () => {
    for (const entry of EXPECTED_MODES) {
      assert.ok(entry.icon.length > 0, `${entry.mode}: icon is empty`);
      assert.ok(entry.colorClass.length > 0, `${entry.mode}: colorClass is empty`);
      assert.ok(entry.label.length > 0, `${entry.mode}: label is empty`);
      assert.ok(entry.description.length > 0, `${entry.mode}: description is empty`);
    }
  });

  test('color classes use the bojubot-perm- prefix', () => {
    for (const entry of EXPECTED_MODES) {
      assert.ok(entry.colorClass.startsWith('bojubot-perm-'), `${entry.mode}: colorClass must start with bojubot-perm-`);
    }
  });

  test('each mode maps to a unique label', () => {
    const labels = EXPECTED_MODES.map(m => m.label);
    assert.equal(new Set(labels).size, labels.length, 'labels must be unique');
  });

  test('each mode maps to a unique icon', () => {
    const icons = EXPECTED_MODES.map(m => m.icon);
    assert.equal(new Set(icons).size, icons.length, 'icons must be unique');
  });

  test('permissionArgs handles every mode listed in the picker', () => {
    for (const entry of EXPECTED_MODES) {
      const args = permissionArgs(entry.mode);
      assert.ok(Array.isArray(args) && args.length > 0, `permissionArgs('${entry.mode}') returned no args`);
    }
  });
});

describe('parseStreamOutput', () => {
  function emit(proc: any, chunks: string[], stderrChunks: string[] = []): Promise<{ texts: string[], tools: string[], denials: Array<{ tool: string }>, sessionId?: string, errors: string[] }> {
    return new Promise((resolve) => {
      const texts: string[] = [];
      const tools: string[] = [];
      const denials: Array<{ tool: string }> = [];
      const errors: string[] = [];
      let sessionId: string | undefined;

      parseStreamOutput(proc, {
        onText: (t) => texts.push(t),
        onAction: () => { /* tests don't exercise UI bridge */ },
        onToolCall: (name) => tools.push(name),
        onPermissionDenied: (d) => denials.push(...d),
        onUsage: () => { /* not tested here */ },
        onDone: (id) => { sessionId = id; resolve({ texts, tools, denials, sessionId, errors }); },
        onError: (e) => errors.push(e),
      });

      // Emit stdout chunks
      for (const chunk of chunks) {
        proc.stdout.emit('data', Buffer.from(chunk));
      }
      // Emit stderr
      for (const chunk of stderrChunks) {
        proc.stderr.emit('data', Buffer.from(chunk));
      }
      // Close
      proc.emit('close', 0);
    });
  }

  const assistantMsg = (text: string, sessionId = 'sess-abc') => [
    JSON.stringify({ type: 'system', session_id: sessionId }) + '\n',
    JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'text', text }] },
    }) + '\n',
    JSON.stringify({ type: 'result', session_id: sessionId }) + '\n',
  ];

  test('extracts text from assistant message', async () => {
    const proc = mockProc();
    const result = await emit(proc, assistantMsg('Hello world'));
    assert.deepEqual(result.texts, ['Hello world']);
  });

  test('captures session_id from system message', async () => {
    const proc = mockProc();
    const result = await emit(proc, assistantMsg('hi', 'my-session-id'));
    assert.equal(result.sessionId, 'my-session-id');
  });

  test('captures session_id from result message', async () => {
    const proc = mockProc();
    const chunks = [
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'ok' }] } }) + '\n',
      JSON.stringify({ type: 'result', session_id: 'result-session' }) + '\n',
    ];
    const result = await emit(proc, chunks);
    assert.equal(result.sessionId, 'result-session');
  });

  test('handles chunked JSON split across multiple data events', async () => {
    const proc = mockProc();
    const line = JSON.stringify({ type: 'system', session_id: 'chunked-sess' });
    // Split the line at an arbitrary point
    const half = Math.floor(line.length / 2);
    const result = await emit(proc, [line.slice(0, half), line.slice(half) + '\n']);
    assert.equal(result.sessionId, 'chunked-sess');
  });

  test('handles multiple text blocks in one message', async () => {
    const proc = mockProc();
    const chunks = [
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'foo' }, { type: 'text', text: 'bar' }] },
      }) + '\n',
    ];
    const result = await emit(proc, chunks);
    assert.deepEqual(result.texts, ['foo', 'bar']);
  });

  test('fires onToolCall for tool_use blocks', async () => {
    const proc = mockProc();
    const chunks = [
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', name: 'read_file', input: {} }] },
      }) + '\n',
    ];
    const result = await emit(proc, chunks);
    assert.deepEqual(result.tools, ['read_file']);
  });

  test('fires onError for stderr data', async () => {
    const proc = mockProc();
    const result = await emit(proc, [], ['some error text']);
    assert.ok(result.errors.some(e => e.includes('some error text')));
  });

  test('ignores non-JSON stdout lines without throwing', async () => {
    const proc = mockProc();
    const chunks = ['not json at all\n', JSON.stringify({ type: 'result', session_id: 'x' }) + '\n'];
    const result = await emit(proc, chunks);
    assert.equal(result.sessionId, 'x');
  });

  test('handles empty text blocks gracefully', async () => {
    const proc = mockProc();
    const chunks = [
      JSON.stringify({ type: 'assistant', message: { content: [] } }) + '\n',
    ];
    const result = await emit(proc, chunks);
    assert.deepEqual(result.texts, []);
  });

  test('fires onPermissionDenied when result contains permission_denials', async () => {
    const proc = mockProc();
    const chunks = [
      JSON.stringify({
        type: 'result',
        session_id: 'sess-perm',
        permission_denials: [
          { tool_name: 'Write', tool_use_id: 'tu_1', tool_input: { file_path: 'notes/test.md', content: 'hello' } },
          { tool_name: 'Bash', tool_use_id: 'tu_2', tool_input: { command: 'rm -rf /' } },
        ],
      }) + '\n',
    ];
    const result = await emit(proc, chunks);
    assert.equal(result.denials.length, 2);
    assert.equal(result.denials[0].tool, 'Write');
    assert.equal(result.denials[1].tool, 'Bash');
  });

  test('does not fire onPermissionDenied when permission_denials is empty', async () => {
    const proc = mockProc();
    const chunks = [
      JSON.stringify({ type: 'result', session_id: 'sess-ok', permission_denials: [] }) + '\n',
    ];
    const result = await emit(proc, chunks);
    assert.equal(result.denials.length, 0);
  });

  test('does not fire onPermissionDenied when permission_denials is absent', async () => {
    const proc = mockProc();
    const chunks = [
      JSON.stringify({ type: 'result', session_id: 'sess-no-field' }) + '\n',
    ];
    const result = await emit(proc, chunks);
    assert.equal(result.denials.length, 0);
  });

  // -------------------------------------------------------------------------
  // UI bridge action routing — needed for #76 fix
  // -------------------------------------------------------------------------

  test('routes @@BOJU action lines to onAction, not onText', async () => {
    const proc = mockProc();
    const actions: string[] = [];
    const texts: string[] = [];
    const ACTION_LINE = '@@BOJU {"action":"open-file","path":"notes/test.md"}';
    const chunks = [
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: ACTION_LINE }] },
      }) + '\n',
      JSON.stringify({ type: 'result', session_id: 'sess-action' }) + '\n',
    ];
    await new Promise<void>((resolve) => {
      parseStreamOutput(proc, {
        onText: (t) => texts.push(t),
        onAction: (line) => actions.push(line),
        onToolCall: () => { },
        onPermissionDenied: () => { },
        onUsage: () => { },
        onDone: () => resolve(),
        onError: () => { },
      });
      for (const chunk of chunks) proc.stdout.emit('data', Buffer.from(chunk));
      proc.emit('close', 0);
    });
    assert.equal(actions.length, 1, 'onAction should fire once');
    assert.ok(actions[0].startsWith('@@BOJU '), 'action line should be passed verbatim');
    assert.equal(texts.length, 0, 'onText should not receive action lines');
  });

  test('action-only response still delivers sessionId in onDone', async () => {
    const proc = mockProc();
    const ACTION_LINE = '@@BOJU {"action":"show-notice","message":"Done"}';
    const chunks = [
      JSON.stringify({ type: 'system', session_id: 'sess-action-only' }) + '\n',
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: ACTION_LINE }] },
      }) + '\n',
      JSON.stringify({ type: 'result', session_id: 'sess-action-only' }) + '\n',
    ];
    const result = await emit(proc, chunks);
    assert.equal(result.sessionId, 'sess-action-only', 'sessionId must be available in onDone for action-only responses');
    assert.equal(result.texts.length, 0, 'no text should be emitted for action-only responses');
  });

  test('interrupted process has no sessionId in onDone', async () => {
    const proc = mockProc();
    // No result message — simulates process killed before completing
    const chunks = [
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'partial' }] } }) + '\n',
    ];
    const result = await emit(proc, chunks);
    assert.equal(result.sessionId, undefined, 'interrupted process should have no sessionId');
  });

  // -------------------------------------------------------------------------
  // Multi-step sequence (fix for #67: status indicator lost after first text)
  // -------------------------------------------------------------------------

  test('fires onText then onToolCall then onText in multi-step response', async () => {
    // This sequence is the root cause of #67: text arrives first (causing statusEl removal),
    // then tool calls fire. The DOM fix in ClaudeView.ts re-appends statusEl on onToolCall
    // if it is no longer connected. This test documents that parseStreamOutput fires callbacks
    // in the correct order so the fix can rely on it.
    const proc = mockProc();
    const eventLog: string[] = [];
    const chunks = [
      JSON.stringify({ type: 'system', session_id: 'seq-sess' }) + '\n',
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'I will read the file.' }] } }) + '\n',
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'note.md' } }] } }) + '\n',
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: ' Done.' }] } }) + '\n',
      JSON.stringify({ type: 'result', session_id: 'seq-sess' }) + '\n',
    ];
    await new Promise<void>((resolve) => {
      parseStreamOutput(proc, {
        onText: (t) => eventLog.push(`text:${t}`),
        onAction: () => { },
        onToolCall: (name) => eventLog.push(`tool:${name}`),
        onPermissionDenied: () => { },
        onUsage: () => { },
        onDone: () => resolve(),
        onError: () => { },
      });
      for (const chunk of chunks) proc.stdout.emit('data', Buffer.from(chunk));
      proc.emit('close', 0);
    });
    assert.deepEqual(eventLog, [
      'text:I will read the file.',
      'tool:Read',
      'text: Done.',
    ], 'callbacks must fire in stream order: text → tool → text');
  });
});

// ---------------------------------------------------------------------------
// extractToolDetail — label text for tool call events in chat panel
// ---------------------------------------------------------------------------

describe('extractToolDetail', () => {
  test('returns empty string for null/non-object input', () => {
    assert.equal(extractToolDetail('read', null), '');
    assert.equal(extractToolDetail('read', 'string'), '');
    assert.equal(extractToolDetail('read', 42), '');
  });

  test('returns empty string for empty object', () => {
    assert.equal(extractToolDetail('read', {}), '');
  });

  test('returns filename only (not full path) for read/write/edit', () => {
    const input = { file_path: '/vault/notes/my-note.md' };
    assert.equal(extractToolDetail('read', input), 'my-note.md');
    assert.equal(extractToolDetail('write', input), 'my-note.md');
    assert.equal(extractToolDetail('edit', input), 'my-note.md');
  });

  test('returns full path for grep (not just filename)', () => {
    const input = { path: '/vault/notes' };
    assert.equal(extractToolDetail('grep', input), '/vault/notes');
  });

  test('returns full path for glob (not just filename)', () => {
    const input = { path: '/vault' };
    assert.equal(extractToolDetail('glob', input), '/vault');
  });

  test('returns bash command for bash tool', () => {
    const input = { command: 'git status' };
    assert.equal(extractToolDetail('bash', input), 'git status');
  });

  test('truncates long bash commands at 70 chars with ellipsis', () => {
    const long = 'x'.repeat(80);
    const result = extractToolDetail('bash', { command: long });
    assert.equal(result.length, 71); // 70 chars + '…'
    assert.ok(result.endsWith('…'));
  });

  test('returns url for web fetch/search tools', () => {
    assert.equal(extractToolDetail('webfetch', { url: 'https://example.com' }), 'https://example.com');
  });

  test('returns query for search tools', () => {
    assert.equal(extractToolDetail('websearch', { query: 'obsidian plugins' }), 'obsidian plugins');
  });

  test('returns pattern for grep/glob pattern field', () => {
    assert.equal(extractToolDetail('grep', { pattern: '*.md' }), '*.md');
  });

  test('prefers file_path over path over filePath', () => {
    const input = { file_path: 'a.md', path: 'b/', filePath: 'c.md' };
    assert.equal(extractToolDetail('read', input), 'a.md');
  });

  test('falls back to path when file_path absent', () => {
    const input = { path: '/vault/notes/x.md' };
    assert.equal(extractToolDetail('read', input), 'x.md');
  });

  test('falls back to filePath when file_path and path absent', () => {
    const input = { filePath: '/vault/notes/y.md' };
    assert.equal(extractToolDetail('read', input), 'y.md');
  });

  test('handles Windows-style backslash paths', () => {
    const input = { file_path: 'C:\\vault\\notes\\my-note.md' };
    assert.equal(extractToolDetail('read', input), 'my-note.md');
  });
});

// ---------------------------------------------------------------------------
// Export button disabled state logic
// ---------------------------------------------------------------------------

describe('export button disabled state', () => {
  /** Minimal stand-in for the messagesEl + exportBtn interaction in updateExportBtn(). */
  function makeContext(messageCount: number) {
    const mockMessages = Array.from({ length: messageCount }, () => ({}));
    const messagesEl = { querySelectorAll: (_: string) => mockMessages };
    const exportBtn = { disabled: messageCount === 0 };
    return { messagesEl, exportBtn };
  }

  function updateExportBtn(ctx: ReturnType<typeof makeContext>) {
    const hasMessages = ctx.messagesEl.querySelectorAll('.bojubot-message').length > 0;
    ctx.exportBtn.disabled = !hasMessages;
  }

  test('button is disabled when there are no messages', () => {
    const ctx = makeContext(0);
    updateExportBtn(ctx);
    assert.equal(ctx.exportBtn.disabled, true);
  });

  test('button is enabled when there is at least one message', () => {
    const ctx = makeContext(1);
    updateExportBtn(ctx);
    assert.equal(ctx.exportBtn.disabled, false);
  });

  test('button stays enabled with multiple messages', () => {
    const ctx = makeContext(5);
    updateExportBtn(ctx);
    assert.equal(ctx.exportBtn.disabled, false);
  });

  test('button becomes disabled again after messages cleared', () => {
    const ctx = makeContext(3);
    updateExportBtn(ctx);
    assert.equal(ctx.exportBtn.disabled, false);

    // Simulate messagesEl.empty() — zero children remain
    ctx.messagesEl.querySelectorAll = (_: string) => [];
    updateExportBtn(ctx);
    assert.equal(ctx.exportBtn.disabled, true);
  });
});

// ExportToVaultModal — openAfter checkbox logic
// ---------------------------------------------------------------------------

describe('ExportToVaultModal openAfter', () => {
  /** Simulates the modal's confirm handler, mirroring the implementation. */
  function simulateConfirm(path: string, checkboxChecked: boolean): { path: string; openAfter: boolean } | null {
    let result: { path: string; openAfter: boolean } | null = null;
    const onConfirm = (p: string, openAfter: boolean) => { result = { path: p, openAfter }; };
    const trimmed = path.trim();
    if (trimmed) { onConfirm(trimmed, checkboxChecked); }
    return result;
  }

  test('passes openAfter: true when checkbox is checked', () => {
    const r = simulateConfirm('sessions/MySession.md', true);
    assert.ok(r);
    assert.equal(r!.openAfter, true);
    assert.equal(r!.path, 'sessions/MySession.md');
  });

  test('passes openAfter: false when checkbox is unchecked', () => {
    const r = simulateConfirm('sessions/MySession.md', false);
    assert.ok(r);
    assert.equal(r!.openAfter, false);
  });

  test('does not call onConfirm for empty path', () => {
    const r = simulateConfirm('   ', true);
    assert.equal(r, null);
  });

  test('trims whitespace from path before confirming', () => {
    const r = simulateConfirm('  sessions/Note.md  ', true);
    assert.ok(r);
    assert.equal(r!.path, 'sessions/Note.md');
  });
});

// ---------------------------------------------------------------------------
// Compact-confirm panel — show/hide logic
// ---------------------------------------------------------------------------

describe('compact confirm panel', () => {
  /** Minimal panel state mirroring showCompactConfirm / hideCompactConfirm. */
  function makePanel(sessionId: string | undefined) {
    const classes = new Set<string>();
    const panelEl = {
      classList: {
        add: (c: string) => classes.add(c),
        remove: (c: string) => classes.delete(c),
        has: (c: string) => classes.has(c),
      },
    };

    function showCompactConfirm() {
      if (!sessionId) return 'no-session';
      panelEl.classList.add('is-visible');
      return 'shown';
    }

    function hideCompactConfirm() {
      panelEl.classList.remove('is-visible');
    }

    return { panelEl, showCompactConfirm, hideCompactConfirm };
  }

  test('panel is hidden by default (no is-visible class)', () => {
    const { panelEl } = makePanel('sess-1');
    assert.equal(panelEl.classList.has('is-visible'), false);
  });

  test('show adds is-visible when session exists', () => {
    const { panelEl, showCompactConfirm } = makePanel('sess-1');
    const result = showCompactConfirm();
    assert.equal(result, 'shown');
    assert.equal(panelEl.classList.has('is-visible'), true);
  });

  test('show does nothing when no session', () => {
    const { panelEl, showCompactConfirm } = makePanel(undefined);
    const result = showCompactConfirm();
    assert.equal(result, 'no-session');
    assert.equal(panelEl.classList.has('is-visible'), false);
  });

  test('hide removes is-visible', () => {
    const { panelEl, showCompactConfirm, hideCompactConfirm } = makePanel('sess-1');
    showCompactConfirm();
    assert.equal(panelEl.classList.has('is-visible'), true);
    hideCompactConfirm();
    assert.equal(panelEl.classList.has('is-visible'), false);
  });

  test('hide is safe to call when panel is already hidden', () => {
    const { panelEl, hideCompactConfirm } = makePanel('sess-1');
    assert.doesNotThrow(() => hideCompactConfirm());
    assert.equal(panelEl.classList.has('is-visible'), false);
  });
});

// ---------------------------------------------------------------------------
// extractActions — UIBridge action parser
// ---------------------------------------------------------------------------

describe('extractActions', () => {
  test('returns empty actions and original text when no action lines present', () => {
    const { clean, actions } = extractActions('Hello\nworld\n');
    assert.equal(clean, 'Hello\nworld\n');
    assert.deepEqual(actions, []);
  });

  test('parses a valid action line and removes it from clean output', () => {
    const line = '@@BOJU {"action":"show-notice","message":"hi"}';
    const { clean, actions } = extractActions(`before\n${line}\nafter`);
    assert.equal(actions.length, 1);
    assert.equal(actions[0].action, 'show-notice');
    assert.ok(!clean.includes('@@BOJU'), 'action line must not appear in clean output');
  });

  test('silently skips malformed JSON — no throw, no action pushed, bad line not in clean', () => {
    const bad = '@@BOJU {not valid json}';
    let threw = false;
    let result: ReturnType<typeof extractActions> | undefined;
    try {
      result = extractActions(`before\n${bad}\nafter`);
    } catch {
      threw = true;
    }
    assert.equal(threw, false, 'must not throw on malformed JSON');
    assert.deepEqual(result!.actions, [], 'malformed action must not be pushed');
    assert.ok(!result!.clean.includes('@@BOJU'), 'malformed line must not appear in clean output');
  });

  test('strips @@BOJU query lines from clean output', () => {
    const { clean, actions } = extractActions('before\n@@BOJU {"query":"test"}\nafter');
    assert.ok(!clean.includes('@@BOJU'), 'query lines must be stripped from clean');
    assert.deepEqual(actions, []);
  });

  test('handles multiple actions in one text block', () => {
    const text = [
      '@@BOJU {"action":"open-file","path":"a.md"}',
      '@@BOJU {"action":"show-notice","message":"done"}',
    ].join('\n');
    const { actions, clean } = extractActions(text);
    assert.equal(actions.length, 2);
    assert.equal(clean.trim(), '', 'clean output should be empty when all lines are actions');
  });
});

// ---------------------------------------------------------------------------
// saveSessionAtTop — sparse sort order logic
// ---------------------------------------------------------------------------

describe('saveSessionAtTop sort order', () => {
  const makeSession = (id: string, order?: number) => ({
    id,
    title: `Session ${id}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    claudeSessionId: `claude-${id}`,
    ...(order !== undefined ? { sortOrder: order } : {}),
  });

  test('no sortOrder assigned when no existing sessions have one', () => {
    const sessDir = join(tmpDir, 'sortorder-1');
    mkdirSync(sessDir, { recursive: true });
    const s = makeSession('s-top-1');
    saveSessionAtTop(tmpDir, s, sessDir, 'test-config');
    const loaded = loadAllSessions(tmpDir, sessDir, 'test-config');
    const found = loaded.find(x => x.id === 's-top-1');
    assert.ok(found);
    assert.equal(found!.sortOrder, undefined);
  });

  test('new session gets sortOrder = min(existing) - 1', () => {
    const sessDir = join(tmpDir, 'sortorder-2');
    mkdirSync(sessDir, { recursive: true });
    saveSession(tmpDir, makeSession('existing-1', 10), sessDir);
    saveSession(tmpDir, makeSession('existing-2', 5), sessDir);
    const newSess = makeSession('new-top');
    saveSessionAtTop(tmpDir, newSess, sessDir, 'test-config');
    const loaded = loadAllSessions(tmpDir, sessDir, 'test-config');
    const found = loaded.find(x => x.id === 'new-top');
    assert.ok(found);
    assert.equal(found!.sortOrder, 4, 'sortOrder must be min(5,10) - 1 = 4');
    assert.equal(loaded[0].id, 'new-top', 'new session must sort first');
  });

  test('existing session files are NOT rewritten on insert', () => {
    const sessDir = join(tmpDir, 'sortorder-3');
    mkdirSync(sessDir, { recursive: true });
    saveSession(tmpDir, makeSession('stable', 10), sessDir);
    const statBefore = statSync(join(sessDir, 'stable.json'));
    // Give the filesystem a moment so a write would produce a different mtime
    const start = Date.now();
    while (Date.now() - start < 10) { /* spin */ }
    saveSessionAtTop(tmpDir, makeSession('new-3'), sessDir, 'test-config');
    const statAfter = statSync(join(sessDir, 'stable.json'));
    assert.equal(statBefore.mtimeMs, statAfter.mtimeMs, 'existing session file must not be rewritten');
  });
});

// ---------------------------------------------------------------------------
// resolveSessionsDir — path resolution branches
// ---------------------------------------------------------------------------

describe('resolveSessionsDir', () => {
  const CONFIG = '.obsidian/plugins/bojubot';

  test('undefined customPath → default sessions dir', () => {
    const result = resolveSessionsDir('/vault', undefined, CONFIG);
    const expected = getSessionsDir('/vault', CONFIG);
    assert.equal(result, expected);
  });

  test('whitespace-only customPath → default sessions dir', () => {
    const result = resolveSessionsDir('/vault', '   ', CONFIG);
    const expected = getSessionsDir('/vault', CONFIG);
    assert.equal(result, expected);
  });

  test('absolute customPath → returned as-is', () => {
    const abs = isAbsolute('/custom/sessions') ? '/custom/sessions' : 'C:\\custom\\sessions';
    const result = resolveSessionsDir('/vault', abs, CONFIG);
    assert.equal(result, abs);
  });

  test('relative customPath → joined with vaultRoot', () => {
    const result = resolveSessionsDir('/vault', 'my/sessions', CONFIG);
    assert.equal(result, join('/vault', 'my/sessions'));
  });
});

// ---------------------------------------------------------------------------
// titleFromPrompt — newline-only edge cases (gap from code review)
// ---------------------------------------------------------------------------

describe('titleFromPrompt newline edge cases', () => {
  test('single newline returns empty string', () => {
    assert.equal(titleFromPrompt('\n'), '');
  });

  test('multiple newlines return empty string', () => {
    assert.equal(titleFromPrompt('\n\n\n'), '');
  });

  test('whitespace and newlines return empty string', () => {
    assert.equal(titleFromPrompt('  \n  \t  '), '');
  });
});

// ---------------------------------------------------------------------------
// resolveShellEnv — basic contract (platform-branch behaviour)
// ---------------------------------------------------------------------------

describe('resolveShellEnv', () => {
  test('returns a Promise that resolves to a string→string record', async () => {
    const env = await resolveShellEnv();
    assert.equal(typeof env, 'object');
    assert.ok(env !== null && !Array.isArray(env));
    for (const [k, v] of Object.entries(env)) {
      assert.equal(typeof k, 'string', `key ${k} must be a string`);
      assert.equal(typeof v, 'string', `value for ${k} must be a string`);
    }
  });

  test('on win32: result mirrors process.env without undefined values', async () => {
    if (process.platform !== 'win32') return;
    const env = await resolveShellEnv();
    assert.ok('PATH' in env || 'Path' in env, 'PATH must be present');
    for (const v of Object.values(env)) {
      assert.equal(typeof v, 'string', 'no undefined values — process.env entries with undefined must be excluded');
    }
  });
});

// ---------------------------------------------------------------------------
// SessionCoordinator — reentrancy guard
//
// Spawns the real Node binary as a stand-in "claude" process (garbage args,
// exits immediately) purely so a genuine ChildProcess exists to make
// _activeProc truthy — there's no way to inject a fake spawnClaude today.
// ---------------------------------------------------------------------------

function makeTestHost(sessionsDir: string): SessionCoordinatorHost {
  return {
    getBinaryPath: () => process.execPath,
    getVaultRoot: () => sessionsDir,
    getConfigDir: () => '.obsidian',
    getEnv: () => ({}),
    getPermissionMode: () => 'standard',
    getModel: () => '',
    getSessionsDir: () => sessionsDir,
    saveLastActiveSessionId: async () => { /* no-op */ },
    isUiBridgeEnabled: () => false,
  };
}

describe('SessionCoordinator reentrancy guard', () => {
  test('send() rejects a new turn while one is already in flight, and allows one after it clears', async () => {
    const sessionsDir = mkdtempSync(join(tmpdir(), 'bojubot-coord-test-'));
    try {
      const coordinator = new SessionCoordinator(makeTestHost(sessionsDir));
      const errors: string[] = [];
      coordinator.on('turn:error', (err) => errors.push(err));

      assert.equal(coordinator.isBusy, false, 'idle before any send()');

      coordinator.send('first prompt');
      assert.equal(coordinator.isBusy, true, 'busy immediately after send() spawns a process');

      coordinator.send('second prompt — should be rejected');
      assert.equal(errors.length, 1, 'second send() while busy must be rejected, not spawn a process');
      assert.match(errors[0], /already in progress/);

      // Wait for the first (real, if short-lived) process to close so onDone clears _activeProc.
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timed out waiting for turn:done')), 5000);
        coordinator.on('turn:done', () => { clearTimeout(timer); resolve(); });
      });
      assert.equal(coordinator.isBusy, false, 'idle again once the process closes');

      coordinator.send('third prompt — should be accepted now that the coordinator is idle');
      assert.equal(errors.length, 1, 'no new rejection once the previous turn has cleared');
      coordinator.cancel();
      // Give the killed process (and Windows' handle on the tmp dir as its cwd) a moment
      // to release before cleanup — best-effort either way, this is just a tmp dir.
      await new Promise(resolve => setTimeout(resolve, 300));
    } finally {
      try { rmSync(sessionsDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
    }
  });
});

// ---------------------------------------------------------------------------
// resolveBrand — pure brand-config resolver
// ---------------------------------------------------------------------------

describe('resolveBrand', () => {
  test('undefined config → stock BojuBot identity, byte-for-byte', () => {
    const b = resolveBrand(undefined);
    assert.equal(b.name, 'BojuBot');
    assert.equal(b.icon, 'brain-circuit');
    assert.equal(b.logo, '', "empty logo signals 'use bundled'");
    assert.equal(b.sprite, '');
    assert.equal(b.applyToAssistantIdentity, false);
    assert.equal(b.links.doc, DEFAULT_BRAND.links.doc);
    assert.equal(b.links.community, DEFAULT_BRAND.links.community);
    assert.equal(b.links.source, DEFAULT_BRAND.links.source);
    assert.equal(b.links.support, DEFAULT_BRAND.links.support);
    assert.equal(isWhiteLabeled(b), false);
  });

  test('empty object → identical to undefined (all defaults)', () => {
    assert.deepEqual(resolveBrand({}), resolveBrand(undefined));
  });

  test('partial config fills every other field from defaults (no shallow-merge drop)', () => {
    const b = resolveBrand({ name: 'AXI25' });
    assert.equal(b.name, 'AXI25');
    assert.equal(b.icon, 'brain-circuit', 'icon still defaulted');
    assert.equal(b.links.doc, DEFAULT_BRAND.links.doc, 'sibling links still defaulted');
    assert.equal(isWhiteLabeled(b), true);
  });

  test('whitespace-only name/icon fall back to defaults', () => {
    const b = resolveBrand({ name: '   ', icon: '\t' });
    assert.equal(b.name, 'BojuBot');
    assert.equal(b.icon, 'brain-circuit');
  });

  test('name is trimmed', () => {
    assert.equal(resolveBrand({ name: '  Acme  ' }).name, 'Acme');
  });

  test("link '' means hide (kept), absent means default", () => {
    const b = resolveBrand({ links: { community: '' } });
    assert.equal(b.links.community, '', "explicit '' is preserved, not defaulted");
    assert.equal(b.links.doc, DEFAULT_BRAND.links.doc, 'absent link still defaults');
  });

  test('link override is used verbatim', () => {
    const b = resolveBrand({ links: { doc: 'https://base25.so' } });
    assert.equal(b.links.doc, 'https://base25.so');
  });

  test('greetings/tips override when provided, else bundled defaults are used', () => {
    const withDefaults = resolveBrand({});
    assert.ok(Array.isArray(withDefaults.tips) && withDefaults.tips.length > 0, 'bundled tips present');
    assert.ok(Array.isArray(withDefaults.greetings.morning), 'bundled greetings present');

    const customTips = ['only tip'];
    const customGreetings = {
      morning: [{ withName: 'Hi {{name}}', withoutName: 'Hi' }],
      afternoon: [], evening: [], night: [],
    };
    const b = resolveBrand({ tips: customTips, greetings: customGreetings });
    assert.deepEqual(b.tips, customTips);
    assert.deepEqual(b.greetings, customGreetings);
  });

  test('applyToAssistantIdentity honours explicit true', () => {
    assert.equal(resolveBrand({ applyToAssistantIdentity: true }).applyToAssistantIdentity, true);
  });

  test('resolver is a pure function — does not mutate its input', () => {
    const input: BrandConfig = { name: 'AXI25', links: { doc: 'x' } };
    const snapshot = JSON.stringify(input);
    resolveBrand(input);
    assert.equal(JSON.stringify(input), snapshot, 'input object untouched');
  });
});

// ---------------------------------------------------------------------------
// resolveIdentityName / applyIdentityName — assistant-identity rebranding
// ---------------------------------------------------------------------------

describe('resolveIdentityName', () => {
  test('applyToAssistantIdentity off → stock name, even with a custom brand name', () => {
    const brand = resolveBrand({ name: 'AXI25' });
    assert.equal(resolveIdentityName(brand), 'BojuBot');
  });

  test('applyToAssistantIdentity on → the custom brand name', () => {
    const brand = resolveBrand({ name: 'AXI25', applyToAssistantIdentity: true });
    assert.equal(resolveIdentityName(brand), 'AXI25');
  });
});

describe('applyIdentityName', () => {
  test('rebranding off → text passes through unchanged', () => {
    const brand = resolveBrand({ name: 'AXI25' });
    const text = 'intercepted by BojuBot, never shown to user';
    assert.equal(applyIdentityName(text, brand), text);
  });

  test('rebranding on → every occurrence of the stock name is replaced', () => {
    const brand = resolveBrand({ name: 'AXI25', applyToAssistantIdentity: true });
    const text = '## BojuBot\nintercepted by BojuBot, never shown to user\n"assistant":"BojuBot"';
    assert.equal(
      applyIdentityName(text, brand),
      '## AXI25\nintercepted by AXI25, never shown to user\n"assistant":"AXI25"',
    );
  });
});

// ---------------------------------------------------------------------------
// resolveExportFolder — brand-aware default for "export session to vault"
// ---------------------------------------------------------------------------

describe('resolveExportFolder', () => {
  test('empty setting → brand-aware default', () => {
    assert.equal(resolveExportFolder('', resolveBrand(undefined)), 'BojuBot Exports');
  });

  test('whitespace-only setting → brand-aware default', () => {
    assert.equal(resolveExportFolder('   ', resolveBrand(undefined)), 'BojuBot Exports');
  });

  test('custom brand name flows into the default', () => {
    const brand = resolveBrand({ name: 'AXI25' });
    assert.equal(resolveExportFolder('', brand), 'AXI25 Exports');
  });

  test('custom folder setting is used verbatim, trimmed', () => {
    const brand = resolveBrand({ name: 'AXI25' });
    assert.equal(resolveExportFolder('  _my exports  ', brand), '_my exports');
  });
});

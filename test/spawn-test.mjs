/**
 * Standalone Claude spawn test — no Obsidian required.
 * Run from PowerShell: node test/spawn-test.mjs
 *
 * Tests binary detection and stream-json output end-to-end.
 */

import { spawn, execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const PROMPT = 'Say exactly: hello from bojubot';

// ---------------------------------------------------------------------------
// Binary detection (mirrors ClaudeProcess.ts)
// ---------------------------------------------------------------------------

function findClaudeBinary() {
  try {
    const cmd = process.platform === 'win32' ? 'where claude' : 'which claude';
    const result = execSync(cmd, { encoding: 'utf8' }).trim().split('\n')[0];
    if (result && existsSync(result)) return result;
  } catch { /* not in PATH */ }

  const home = homedir();
  const candidates = [
    join(home, 'AppData', 'Local', 'Programs', 'claude', 'claude.exe'),
    join(home, 'AppData', 'Roaming', 'npm', 'claude.cmd'),
    join(home, 'AppData', 'Roaming', 'npm', 'claude'),
    join(home, '.local', 'bin', 'claude.exe'),
    join(home, '.local', 'bin', 'claude'),
    join(home, '.npm-global', 'bin', 'claude'),
    '/usr/local/bin/claude',
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const binary = findClaudeBinary();
if (!binary) {
  console.error('ERROR: claude binary not found');
  process.exit(1);
}

console.log('Binary:', binary);
console.log('Platform:', process.platform);
console.log('shell mode:', process.platform === 'win32');
console.log('Prompt:', PROMPT);
console.log('---');

const args = [
  '--output-format', 'stream-json',
  '--verbose',
  '--print',
  '--dangerously-skip-permissions',
  PROMPT,
];

// Strip CLAUDECODE so claude doesn't refuse to launch inside another session.
const env = { ...process.env };
delete env['CLAUDECODE'];

const proc = spawn(binary, args, {
  cwd: process.cwd(),
  env,
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: process.platform === 'win32',
});

console.log('PID:', proc.pid);

let buffer = '';

proc.stdout.on('data', (chunk) => {
  const raw = chunk.toString();
  process.stdout.write('[stdout] ' + raw);

  buffer += raw;
  const lines = buffer.split('\n');
  buffer = lines.pop() ?? '';

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.type === 'content_block_delta' && msg.delta?.type === 'text_delta') {
        process.stdout.write('[text] ' + msg.delta.text);
      } else {
        console.log('[msg]', msg.type, msg.session_id ?? '');
      }
    } catch {
      console.log('[non-json]', line.substring(0, 120));
    }
  }
});

proc.stderr.on('data', (chunk) => {
  process.stderr.write('[stderr] ' + chunk.toString());
});

proc.on('close', (code) => {
  console.log('\n--- process closed, exit code:', code);
});

proc.on('error', (err) => {
  console.error('Process error:', err.message);
});

// Timeout safety net
setTimeout(() => {
  console.error('\nTIMEOUT: no response after 30s — killing process');
  proc.kill();
}, 30_000);

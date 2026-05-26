import { existsSync } from 'fs';
import { BOJU_PREFIX } from './constants';
import { join } from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { spawn, ChildProcess } from 'child_process';
import { log as LOG, warn as WARN, logv as LOGV } from './utils/logger';
export type PermissionMode = 'standard' | 'readonly' | 'full' | 'restricted';

export interface PermissionDenial {
  tool: string;
  input: unknown;
}

/** Maps BojuBot permissionMode to Claude CLI args. */
export function permissionArgs(mode: PermissionMode): string[] {
  switch (mode) {
    case 'restricted':
      return [
        '--permission-mode', 'default',
        '--allowedTools', 'WebFetch,WebSearch',
      ];
    case 'readonly':
      return [
        '--permission-mode', 'default',
        '--allowedTools', 'Read,Glob,Grep,WebFetch,WebSearch',
      ];
    case 'full':
      return ['--permission-mode', 'bypassPermissions'];
    case 'standard':
    default:
      return ['--permission-mode', 'acceptEdits'];
  }
}

// ---------------------------------------------------------------------------
// Binary detection
// ---------------------------------------------------------------------------

export function findClaudeBinary(settingsOverride?: string): string | null {
  LOG('findClaudeBinary — platform:', process.platform);

  if (settingsOverride) {
    LOG('  trying settings override:', settingsOverride);
    if (existsSync(settingsOverride)) return settingsOverride;
    WARN('  settings override path not found — not falling back to auto-detect');
    return null;
  }

  // On Windows, use 'where'; on Mac/Linux use 'which'
  try {
    const cmd = process.platform === 'win32' ? 'where claude' : 'which claude';
    LOG('  trying PATH lookup:', cmd);
    const result = execSync(cmd, { encoding: 'utf8' }).trim().split('\n')[0];
    if (result && existsSync(result)) {
      LOG('  found via PATH:', result);
      return result;
    }
  } catch { /* not found in PATH */ }

  const home = os.homedir();
  const candidates = [
    // Windows
    join(home, 'AppData', 'Local', 'Programs', 'claude', 'claude.exe'),
    join(home, 'AppData', 'Roaming', 'npm', 'claude.cmd'),
    join(home, 'AppData', 'Roaming', 'npm', 'claude'),
    join(home, '.local', 'bin', 'claude.exe'),
    // Mac / Linux
    join(home, '.local', 'bin', 'claude'),
    join(home, '.npm-global', 'bin', 'claude'),
    '/usr/local/bin/claude',
  ];

  LOG('  trying candidate paths…');
  for (const c of candidates) {
    if (existsSync(c)) {
      LOG('  found at:', c);
      return c;
    }
  }

  WARN('  claude binary not found anywhere');
  return null;
}

// ---------------------------------------------------------------------------
// Spawn
// ---------------------------------------------------------------------------

export interface SpawnOptions {
  binaryPath: string;
  prompt: string;
  vaultRoot: string;
  env: Record<string, string>;
  resumeSessionId?: string;
  permissionMode?: PermissionMode;
  model?: string;
}

export function spawnClaude(opts: SpawnOptions): ChildProcess {
  const args = [
    '--output-format', 'stream-json',
    '--verbose',
    '--print',
    ...permissionArgs(opts.permissionMode ?? 'standard'),
  ];

  if (opts.model) {
    args.push('--model', opts.model);
  }

  if (opts.resumeSessionId) {
    args.push('--resume', opts.resumeSessionId);
  }
  // Prompt is written to stdin after spawn — avoids all shell/arg quoting issues.

  // Strip CLAUDECODE so claude doesn't refuse to launch inside another session.
  const env = { ...opts.env };
  delete env['CLAUDECODE'];

  LOG('spawnClaude cwd:', opts.vaultRoot, 'session:', opts.resumeSessionId ?? 'new');

  let proc: ChildProcess;

  if (process.platform === 'win32') {
    // On Windows, Electron's child_process piping doesn't work correctly with
    // cmd.exe (shell:true) or direct spawn (shell:false) — stdout is swallowed.
    // Spawning via powershell.exe -NonInteractive works reliably.
    // Single-quote flags only (no user content in args now — prompt goes via stdin).
    const ps = (s: string) => `'${s.replace(/'/g, "''")}'`;
    const psCmd = `& ${ps(opts.binaryPath)} ${args.map(ps).join(' ')}`;
    LOG('  powershell spawn');
    proc = spawn('powershell.exe', ['-NonInteractive', '-Command', psCmd], {
      cwd: opts.vaultRoot,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });
  } else {
    proc = spawn(opts.binaryPath, args, {
      cwd: opts.vaultRoot,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });
  }

  LOG('  pid:', proc.pid);

  // Write prompt via stdin — bypasses all shell/arg quoting issues.
  // claude --print reads from stdin when no positional prompt arg is given.
  if (!proc.stdin) {
    // stdin null means the process failed to open the pipe; throw so the
    // try/catch in the caller surfaces a real error instead of a silent close.
    throw new Error('Claude process started with no stdin pipe — cannot send prompt.');
  }
  proc.stdin.write(opts.prompt, 'utf8');
  proc.stdin.end();

  return proc;
}

/**
 * Kill a spawned claude process and its entire process tree.
 * On Windows, proc.kill() only kills the PowerShell wrapper — claude.exe keeps running.
 * taskkill /F /T kills the full tree.
 */
export function killProcess(proc: ChildProcess): void {
  if (!proc.pid) return;
  LOG('killProcess — pid:', proc.pid);
  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'ignore' });
    } catch {
      // Process may have already exited — ignore
    }
  } else {
    proc.kill('SIGTERM');
  }
}

// ---------------------------------------------------------------------------
// Stream-JSON parsing
// ---------------------------------------------------------------------------

export interface TokenUsage {
  inputTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
}

export interface StreamCallbacks {
  onText: (delta: string) => void;
  onAction: (line: string) => void;
  /** Called for each @@BOJU_QUERY line. Optional — existing callers unaffected. */
  onQuery?: (line: string) => void;
  onToolCall: (tool: string, input: unknown, toolUseId: string) => void;
  onToolResult?: (toolUseId: string, content: string) => void;
  onPermissionDenied: (denials: PermissionDenial[]) => void;
  onUsage: (usage: TokenUsage) => void;
  onDone: (sessionId?: string, clean?: boolean) => void;
  onError: (err: string) => void;
}

export function parseStreamOutput(proc: ChildProcess, cb: StreamCallbacks): void {
  let buffer = '';
  let sessionId: string | undefined;
  let gotResult = false;

  proc.stdout?.on('data', (chunk: Buffer) => {
    const raw = chunk.toString();
    LOGV('stdout chunk:', raw.substring(0, 200));
    buffer += raw;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line) as Record<string, unknown>;
        LOGV('  parsed msg type:', msg.type);
        handleMessage(msg, cb, (id) => { sessionId = id; }, (clean) => { gotResult = clean; });
      } catch {
        LOGV('  non-JSON line:', line.substring(0, 100));
      }
    }
  });

  proc.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    WARN('stderr:', text);
    cb.onError(text);
  });

  proc.on('close', (code) => {
    LOG('process closed — exit code:', code, '— sessionId:', sessionId, '— clean:', gotResult);
    cb.onDone(sessionId, gotResult);
  });
}

function handleMessage(
  msg: Record<string, unknown>,
  cb: StreamCallbacks,
  setSessionId: (id: string) => void,
  setGotResult: (clean: boolean) => void,
): void {
  switch (msg.type) {
    case 'system':
      if (msg.session_id) setSessionId(msg.session_id as string);
      break;
    case 'assistant': {
      // Full message format: {type:'assistant', message:{content:[{type:'text',text:'...'}], usage:{...}}}
      const message = msg.message as Record<string, unknown> | undefined;
      const rawUsage = message?.usage as Record<string, number> | undefined;
      if (rawUsage) {
        cb.onUsage({
          inputTokens: rawUsage.input_tokens ?? 0,
          cacheReadTokens: rawUsage.cache_read_input_tokens ?? 0,
          outputTokens: rawUsage.output_tokens ?? 0,
        });
      }
      const content = message?.content as Array<Record<string, unknown>> | undefined;
      if (content) {
        for (const block of content) {
          if (block.type === 'text') {
            const raw = (block.text as string) ?? '';
            // Route @@BOJU lines; dispatch on JSON key ("action" vs "query")
            const textLines: string[] = [];
            for (const line of raw.split('\n')) {
              if (line.startsWith(BOJU_PREFIX)) {
                try {
                  const parsed = JSON.parse(line.slice(BOJU_PREFIX.length)) as Record<string, unknown>;
                  if ('action' in parsed) {
                    cb.onAction(line);
                  } else if ('query' in parsed) {
                    cb.onQuery?.(line);
                  }
                } catch { /* malformed — treat as text */ textLines.push(line); }
              } else {
                textLines.push(line);
              }
            }
            const clean = textLines.join('\n');
            if (clean) cb.onText(clean);
          } else if (block.type === 'tool_use') {
            cb.onToolCall(block.name as string, block.input, block.id as string);
          }
        }
      }
      break;
    }
    case 'user': {
      if (!cb.onToolResult) break;
      const userMsg = msg.message as Record<string, unknown> | undefined;
      const userContent = userMsg?.content as Array<Record<string, unknown>> | undefined;
      if (userContent) {
        for (const block of userContent) {
          if (block.type === 'tool_result') {
            const id = block.tool_use_id as string;
            let text = '';
            if (typeof block.content === 'string') {
              text = block.content;
            } else if (Array.isArray(block.content)) {
              text = (block.content as Array<Record<string, unknown>>)
                .filter(b => b.type === 'text')
                .map(b => b.text as string)
                .join('');
            }
            cb.onToolResult(id, text);
          }
        }
      }
      break;
    }
    case 'result':
      setGotResult(!msg.is_error);
      if (msg.session_id) setSessionId(msg.session_id as string);
      {
        const raw = msg.permission_denials as Array<Record<string, unknown>> | undefined;
        if (raw?.length) {
          const denials: PermissionDenial[] = raw.map(d => ({
            tool: d.tool_name as string,
            input: d.tool_input,
          }));
          cb.onPermissionDenied(denials);
        }
      }
      break;
  }
}

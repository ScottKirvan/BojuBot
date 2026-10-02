import { existsSync } from 'fs';
import { BOJU_PREFIX } from './constants';
import { join } from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { spawn, ChildProcess } from 'child_process';
import { log as LOG, warn as WARN, logv as LOGV } from './utils/logger';
import { parseApiError, ApiError } from './utils/apiError';
import { CliCapabilities, UNKNOWN_CAPABILITIES, parseCliCapabilities, has } from './utils/cliCapabilities';
export type PermissionMode = 'standard' | 'readonly' | 'full' | 'restricted';

export interface PermissionDenial {
  tool: string;
  input: unknown;
}

/**
 * Maps BojuBot permissionMode to Claude CLI args. `caps` is what the installed
 * CLI reported in `--help`; with unknown capabilities (probe not finished or
 * failed) the args are exactly what BojuBot has always sent.
 */
export function permissionArgs(mode: PermissionMode, caps: CliCapabilities = UNKNOWN_CAPABILITIES): string[] {
  const args = modeArgs(mode, caps);
  // With `none`, anything that would need an interactive prompt is denied outright
  // (and reported in permission_denials) rather than left to --print mode's
  // implicit behavior. Harmless under bypassPermissions, which never prompts.
  if (has(caps, '--permission-prompts')) args.push('--permission-prompts', 'none');
  return args;
}

function modeArgs(mode: PermissionMode, caps: CliCapabilities): string[] {
  // 2.1.286 dropped `default` from the listed choices in favour of `manual` (#352).
  // `default` is still accepted for now, but use the listed name when it's there.
  const askMode = caps.permissionModes.includes('manual') ? 'manual' : 'default';
  switch (mode) {
    case 'restricted':
      return [
        '--permission-mode', askMode,
        '--allowedTools', 'WebFetch,WebSearch',
      ];
    case 'readonly':
      return [
        '--permission-mode', askMode,
        '--allowedTools', 'Read,Glob,Grep,WebFetch,WebSearch',
      ];
    case 'full':
      return ['--permission-mode', 'bypassPermissions'];
    case 'standard':
    default:
      // Deliberately NOT `--disallowedTools Bash` — that removes Bash from the
      // model's tool list entirely, so it can never be attempted, denied, or
      // logged. Real usage showed that's worse than the plain acceptEdits
      // behavior below: Claude attempts Bash, the CLI denies it, and *that*
      // denial is what populates permission_denials and drives the denial card
      // (with its "Allow full access for this session" retry). Confirmed by
      // direct testing that --disallowedTools silently breaks that whole flow —
      // no attempt means nothing to deny, so the card never appears and the
      // user has no signal beyond a plain "not available" text response.
      //
      // The denial is explicit when the CLI supports `--permission-prompts none`
      // (appended in permissionArgs above, #291): any Bash command acceptEdits
      // would prompt for is denied instead of relying on --print mode having no
      // one to ask. The CLI does auto-approve read-only Bash commands it
      // classifies as safe (e.g. `echo`, `ls`) in acceptEdits, with or without
      // the flag, so Standard means "no shell commands that change anything",
      // not "no Bash at all". On older CLIs without the flag, the denial is the
      // emergent --print-mode behavior described above.
      return ['--permission-mode', 'acceptEdits'];
  }
}

/**
 * Chat only (restricted) mode has no file-system tools at all, but Claude Code
 * still spawns with — and is aware of — its OS working directory regardless of
 * tool access. Spawning it there instead of the vault root keeps the vault's
 * file-system path from leaking through that awareness (e.g. via error text or
 * the model's own environment context, independent of anything BojuBot injects).
 * Called fresh on every spawn (never cached) so a mid-session permission
 * upgrade takes effect on the very next turn without needing a re-spawn.
 */
export function resolveSpawnCwd(mode: PermissionMode, sessionCwd: string | undefined, vaultRoot: string): string {
  if (mode === 'restricted') return os.tmpdir();
  return sessionCwd ?? vaultRoot;
}

/**
 * True when the effective permission mode allows vault writes (Standard or Full).
 * Used to gate UI Bridge file-mutating actions (rename-file, move-file,
 * delete-file), which run through that side-channel rather than Claude Code's
 * own tool permissions and so aren't otherwise subject to Read only / Chat
 * only's "no writes" guarantee.
 */
export function canWrite(permissionMode?: PermissionMode): boolean {
  return permissionMode === 'standard' || permissionMode === 'full';
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
  /** `--effort` level. Dropped unless the CLI listed it in `capabilities`. */
  effort?: string;
  /** Request token-by-token stream events. Dropped unless the CLI lists the flag. */
  includePartialMessages?: boolean;
  /** What the installed CLI supports. Omitted → unknown → the long-standing default args. */
  capabilities?: CliCapabilities;
}

/** CLI args for a chat turn. Pure — exported for tests. Never includes the prompt. */
export function buildSpawnArgs(
  opts: Pick<SpawnOptions, 'resumeSessionId' | 'permissionMode' | 'model' | 'effort' | 'includePartialMessages' | 'capabilities'>,
): string[] {
  const caps = opts.capabilities ?? UNKNOWN_CAPABILITIES;
  const args = [
    '--output-format', 'stream-json',
    '--verbose',
    '--print',
    ...permissionArgs(opts.permissionMode ?? 'standard', caps),
  ];

  if (opts.includePartialMessages && has(caps, '--include-partial-messages')) {
    args.push('--include-partial-messages');
  }

  if (opts.model) {
    args.push('--model', opts.model);
  }

  // Only ever a level the installed CLI listed in --help.
  if (opts.effort && has(caps, '--effort') && caps.effortLevels.includes(opts.effort)) {
    args.push('--effort', opts.effort);
  }

  if (opts.resumeSessionId) {
    args.push('--resume', opts.resumeSessionId);
  }
  return args;
}

export function spawnClaude(opts: SpawnOptions): ChildProcess {
  const args = buildSpawnArgs(opts);
  // Prompt is written to stdin after spawn — avoids all shell/arg quoting issues.

  LOG('spawnClaude cwd:', opts.vaultRoot, 'session:', opts.resumeSessionId ?? 'new');
  const proc = launchClaude(opts.binaryPath, args, opts.vaultRoot, opts.env);

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
 * Start the claude binary with `args`. Every invocation goes through here so the
 * Windows/Electron workaround and the env cleanup apply everywhere.
 * Never put user content in `args` — write it to stdin instead.
 */
function launchClaude(binaryPath: string, args: string[], cwd: string, baseEnv: Record<string, string>): ChildProcess {
  // Strip CLAUDECODE so claude doesn't refuse to launch inside another session.
  const env = { ...baseEnv };
  delete env['CLAUDECODE'];

  let proc: ChildProcess;

  if (process.platform === 'win32') {
    // On Windows, Electron's child_process piping doesn't work correctly with
    // cmd.exe (shell:true) or direct spawn (shell:false) — stdout is swallowed.
    // Spawning via powershell.exe -NonInteractive works reliably.
    // Single-quote flags only (no user content in args now — prompt goes via stdin).
    const ps = (s: string) => `'${s.replace(/'/g, "''")}'`;
    const psCmd = `& ${ps(binaryPath)} ${args.map(ps).join(' ')}`;
    LOG('  powershell spawn');
    proc = spawn('powershell.exe', ['-NonInteractive', '-Command', psCmd], {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });
  } else {
    proc = spawn(binaryPath, args, {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });
  }

  LOG('  pid:', proc.pid);
  return proc;
}

/**
 * Run claude to completion and resolve with its stdout. `stdin` (if given) is
 * written, and stdin is always closed so claude never waits for more input.
 * Rejects on spawn error, non-zero exit, or timeout (the process tree is killed).
 */
export function runClaude(
  binaryPath: string,
  args: string[],
  cwd: string,
  env: Record<string, string>,
  timeoutMs: number,
  stdin = '',
): Promise<string> {
  return new Promise((resolve, reject) => {
    let proc: ChildProcess;
    try {
      proc = launchClaude(binaryPath, args, cwd, env);
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
      return;
    }
    let out = '';
    let errText = '';
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      killProcess(proc);
      reject(new Error(`timed out after ${timeoutMs} ms`));
    }, timeoutMs);
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      fn();
    };

    proc.stdout?.on('data', (chunk: Buffer) => { out += chunk.toString(); });
    proc.stderr?.on('data', (chunk: Buffer) => { errText += chunk.toString(); });
    proc.on('error', (e) => settle(() => reject(e)));
    proc.on('close', (code) => settle(() => {
      if (code === 0) resolve(out);
      else reject(new Error(`exit code ${code}${errText.trim() ? `: ${errText.trim().substring(0, 200)}` : ''}`));
    }));

    if (stdin) proc.stdin?.write(stdin, 'utf8');
    proc.stdin?.end();
  });
}

const PROBE_TIMEOUT_MS = 10_000;

/**
 * Ask the installed CLI what it supports (`--version`, then `--help`). Never
 * rejects: any failure logs a line and yields UNKNOWN_CAPABILITIES, which keeps
 * spawn args at their long-standing defaults.
 */
export async function probeCliCapabilities(
  binaryPath: string,
  env: Record<string, string>,
  cwd: string,
): Promise<CliCapabilities> {
  try {
    const versionText = await runClaude(binaryPath, ['--version'], cwd, env, PROBE_TIMEOUT_MS);
    const helpText = await runClaude(binaryPath, ['--help'], cwd, env, PROBE_TIMEOUT_MS);
    const caps = parseCliCapabilities(helpText, versionText);
    LOG('CLI capabilities — version:', caps.version ?? 'unknown',
      '— permission modes:', caps.permissionModes.join(',') || '(unknown)',
      '— effort levels:', caps.effortLevels.join(',') || '(unsupported)',
      '— flags:', [...caps.flags].sort().join(' ') || '(none)');
    return caps;
  } catch (e) {
    WARN('CLI capability probe failed — using defaults:', e instanceof Error ? e.message : String(e));
    return UNKNOWN_CAPABILITIES;
  }
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
  /** Live preview of the text block being generated (needs --include-partial-messages).
   *  Receives the block's full text so far, raw — it may contain partial or complete
   *  @@BOJU lines. Display only: onText with the complete message always follows and
   *  is the source of truth. Optional — existing callers unaffected. */
  onTextPreview?: (blockText: string) => void;
  onAction: (line: string) => void;
  /** Called for each @@BOJU_QUERY line. Optional — existing callers unaffected. */
  onQuery?: (line: string) => void;
  onToolCall: (tool: string, input: unknown, toolUseId: string) => void;
  onToolResult?: (toolUseId: string, content: string) => void;
  /** Called when the CLI reports an API error (synthetic `API Error: ...` message).
   *  Optional — without it the error text is passed to onText as before. */
  onApiError?: (err: ApiError) => void;
  onPermissionDenied: (denials: PermissionDenial[]) => void;
  onUsage: (usage: TokenUsage) => void;
  onDone: (sessionId?: string, clean?: boolean) => void;
  onError: (err: string) => void;
}

export function parseStreamOutput(proc: ChildProcess, cb: StreamCallbacks): void {
  let buffer = '';
  let sessionId: string | undefined;
  let gotResult = false;
  const preview: PreviewState = { blockText: '' };

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
        handleMessage(msg, cb, (id) => { sessionId = id; }, (clean) => { gotResult = clean; }, preview);
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

/** Text of the main-thread content block currently being streamed (partial messages only). */
interface PreviewState {
  blockText: string;
}

/**
 * --include-partial-messages events. Only text deltas are used, and only to
 * build a display preview; everything else (tool input, thinking, usage) still
 * comes from the complete messages. Subagent events (parent_tool_use_id set)
 * are ignored so they can't interleave with the main reply.
 */
function handleStreamEvent(msg: Record<string, unknown>, cb: StreamCallbacks, preview: PreviewState): void {
  if (!cb.onTextPreview || msg.parent_tool_use_id) return;
  const event = msg.event as Record<string, unknown> | undefined;
  switch (event?.type) {
    case 'content_block_start':
      preview.blockText = '';
      break;
    case 'content_block_delta': {
      const delta = event.delta as Record<string, unknown> | undefined;
      if (delta?.type === 'text_delta' && typeof delta.text === 'string' && delta.text) {
        preview.blockText += delta.text;
        cb.onTextPreview(preview.blockText);
      }
      break;
    }
  }
}

function handleMessage(
  msg: Record<string, unknown>,
  cb: StreamCallbacks,
  setSessionId: (id: string) => void,
  setGotResult: (clean: boolean) => void,
  preview: PreviewState = { blockText: '' },
): void {
  switch (msg.type) {
    case 'system':
      if (msg.session_id) setSessionId(msg.session_id as string);
      break;
    case 'stream_event':
      handleStreamEvent(msg, cb, preview);
      break;
    case 'assistant': {
      // Full message format: {type:'assistant', message:{content:[{type:'text',text:'...'}], usage:{...}}}
      // The complete block supersedes its streamed preview. Tell the caller even
      // when the block yields no onText (e.g. it held only @@BOJU lines).
      if (!msg.parent_tool_use_id && preview.blockText) {
        preview.blockText = '';
        cb.onTextPreview?.('');
      }
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
            // API failures arrive as a synthetic assistant message, not as model output
            const apiError = message?.model === '<synthetic>' && cb.onApiError ? parseApiError(raw) : null;
            if (apiError) {
              WARN('API error:', apiError.raw);
              cb.onApiError?.(apiError);
              continue;
            }
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

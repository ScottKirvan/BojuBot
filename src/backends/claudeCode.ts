import { existsSync } from 'fs';
import { join } from 'path';
import * as os from 'os';
import { execSync, ChildProcess } from 'child_process';
import { log as LOG, warn as WARN, logv as LOGV } from '../utils/logger';
import { parseApiError } from '../utils/apiError';
import { CliCapabilities, UNKNOWN_CAPABILITIES, parseCliCapabilities, has } from '../utils/cliCapabilities';
import { extractResultText } from '../utils/planUsage';
import { splitBojuLines } from '../utils/bojuLines';
import { launchCli, runCli } from './process';
import type {
  AgentBackend,
  BackendOrientation,
  PermissionDenial,
  PermissionMode,
  StreamCallbacks,
  TurnOptions,
} from './types';

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

/** CLI args for a chat turn. Pure — exported for tests. Never includes the prompt. */
export function buildSpawnArgs(
  opts: Pick<TurnOptions, 'resumeSessionId' | 'permissionMode' | 'model' | 'effort' | 'includePartialMessages' | 'capabilities'>,
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

export function spawnClaude(opts: TurnOptions): ChildProcess {
  const args = buildSpawnArgs(opts);
  // Prompt is written to stdin after spawn — avoids all shell/arg quoting issues.

  LOG('spawnClaude cwd:', opts.cwd, 'session:', opts.resumeSessionId ?? 'new');
  const proc = launchCli(opts.binaryPath, args, opts.cwd, opts.env);

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

const USAGE_TIMEOUT_MS = 30_000;

/**
 * Run `/usage` in a throwaway side process and resolve with its plain-text
 * report. Never part of a conversation: no --resume, and no saved session when
 * the CLI supports --no-session-persistence. Rejects with a short message on failure.
 */
export async function fetchPlanUsage(
  binaryPath: string,
  env: Record<string, string>,
  cwd: string,
  caps: CliCapabilities = UNKNOWN_CAPABILITIES,
): Promise<string> {
  const args = ['--output-format', 'stream-json', '--verbose', '--print'];
  if (has(caps, '--no-session-persistence')) args.push('--no-session-persistence');
  const out = await runCli(binaryPath, args, cwd, env, USAGE_TIMEOUT_MS, '/usage');
  const result = extractResultText(out);
  const text = result?.text.trim() ?? '';
  if (!result || !text) throw new Error('Claude Code returned no usage information.');
  if (result.isError) throw new Error(text);
  return text;
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
    const versionText = await runCli(binaryPath, ['--version'], cwd, env, PROBE_TIMEOUT_MS);
    const helpText = await runCli(binaryPath, ['--help'], cwd, env, PROBE_TIMEOUT_MS);
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

// ---------------------------------------------------------------------------
// Stream-JSON parsing
// ---------------------------------------------------------------------------

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
            const { clean, lines } = splitBojuLines(raw);
            for (const l of lines) {
              if (l.kind === 'action') cb.onAction(l.line);
              else cb.onQuery?.(l.line);
            }
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

// ---------------------------------------------------------------------------
// Backend
// ---------------------------------------------------------------------------

/** Orientation wording for Claude Code. Tool names match Claude Code's built-in tools. */
export const CLAUDE_CODE_ORIENTATION: BackendOrientation = {
  agentLabel: 'Claude Code',
  environmentNote: `Your environment may list "Additional working directories" beyond your CWD — these come from Claude Code CLI's own global config and are not something {{BRAND}} set up; they are frequently leftover from unrelated projects. Ignore them: do not read, write, or explore any additional working directory unless the user explicitly directs you there.`,
  editToolHint: 'the Write or Edit tool',
  permissions: {
    restricted: {
      summary: 'Chat only',
      can: 'respond to messages, fetch web URLs (WebFetch), search the web (WebSearch), and work with any context the user explicitly attaches',
      cannot: 'read, write, or modify vault files. If asked to make file changes, describe exactly what you would change and ask the user to switch to Standard mode or apply the change themselves',
    },
    readonly: {
      summary: 'Read-only',
      can: 'read vault files (Read, Glob, Grep), fetch web URLs, and search the web',
      cannot: 'write or modify any files. If asked to make changes, show the user a diff or the exact content to paste',
    },
    standard: {
      summary: 'Standard',
      can: 'read and write vault files, fetch the web, and run read-only shell commands (Bash) such as ls, echo, or git status',
      cannot: 'run shell commands that change anything (write files, install, delete, download) — those are denied. Request permission if a task genuinely requires one',
    },
    full: {
      summary: 'Full access',
      can: 'use all tools including Bash shell commands',
      cannot: 'nothing — all tools are available',
    },
  },
};

export const claudeCodeBackend: AgentBackend = {
  id: 'claude-code',
  displayName: 'Claude Code',
  findBinary: findClaudeBinary,
  probe: probeCliCapabilities,
  spawnTurn: spawnClaude,
  parseStream: parseStreamOutput,
  fetchPlanUsage,
  compactPrompt: '/compact',
  readableHistory: true,
  listModels: null,
  unavailableModes: {},
  orientation: CLAUDE_CODE_ORIENTATION,
};

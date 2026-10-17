/**
 * Antigravity CLI (`agy`) backend. Verified against agy 1.4.0 — see
 * notes/dev/specs/agent-backends-spec.md for the stream format and permission
 * behavior this adapter relies on.
 */
import { existsSync } from 'fs';
import { join } from 'path';
import * as os from 'os';
import { execSync, ChildProcess } from 'child_process';
import { log as LOG, warn as WARN, logv as LOGV } from '../utils/logger';
import { CliCapabilities, UNKNOWN_CAPABILITIES, parseCliCapabilities, has } from '../utils/cliCapabilities';
import { splitBojuLines } from '../utils/bojuLines';
import type { ApiError } from '../utils/apiError';
import { launchCli, runCli, runCliCapture } from './process';
import type {
  AgentBackend,
  BackendOrientation,
  ModelOption,
  PermissionDenial,
  PermissionMode,
  StreamCallbacks,
  TurnOptions,
} from './types';

/**
 * Maps BojuBot permissionMode to agy args. agy has no per-run allow/deny rules
 * (those live in its global settings.json), so:
 * - Standard is `--mode accept-edits`: file writes allowed, shell commands
 *   soft-denied in print mode and reported in `denied_actions`. agy's default
 *   mode can't be used: it auto-denies every file write outside the system
 *   temp folder, because headless mode can't ask for approval.
 * - Read only is `--mode plan`, which leaves the workspace untouched.
 * - Chat only has no equivalent; it gets plan mode too (most restrictive
 *   available, fail closed). The UI doesn't offer Chat only on this backend.
 * Mode flags are sent whatever the probe says: silently dropping `--mode plan`
 * would turn Read only into a writable session.
 */
export function agyPermissionArgs(mode: PermissionMode): string[] {
  switch (mode) {
    case 'full':
      return ['--dangerously-skip-permissions'];
    case 'readonly':
    case 'restricted':
      return ['--mode', 'plan'];
    case 'standard':
    default:
      return ['--mode', 'accept-edits'];
  }
}

/** CLI args for a chat turn. Pure — exported for tests. Never includes the prompt. */
export function buildAgySpawnArgs(
  opts: Pick<TurnOptions, 'resumeSessionId' | 'permissionMode' | 'model' | 'effort' | 'capabilities'>,
): string[] {
  const caps = opts.capabilities ?? UNKNOWN_CAPABILITIES;
  // The prompt goes in as one stream-json line on stdin: `--print` would need it as an arg.
  const args = [
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    ...agyPermissionArgs(opts.permissionMode ?? 'standard'),
  ];
  if (opts.model) args.push('--model', opts.model);
  if (opts.effort && has(caps, '--effort') && caps.effortLevels.includes(opts.effort)) {
    args.push('--effort', opts.effort);
  }
  if (opts.resumeSessionId) args.push('--conversation', opts.resumeSessionId);
  return args;
}

/** The single stdin line that carries a prompt. Pure — exported for tests. */
export function agyPromptLine(prompt: string): string {
  return JSON.stringify({ event: 'user', message: { role: 'user', content: prompt } }) + '\n';
}

// ---------------------------------------------------------------------------
// Binary detection
// ---------------------------------------------------------------------------

export function findAgyBinary(settingsOverride?: string): string | null {
  LOG('findAgyBinary — platform:', process.platform);

  if (settingsOverride) {
    LOG('  trying settings override:', settingsOverride);
    if (existsSync(settingsOverride)) return settingsOverride;
    WARN('  settings override path not found — not falling back to auto-detect');
    return null;
  }

  try {
    const cmd = process.platform === 'win32' ? 'where agy' : 'which agy';
    LOG('  trying PATH lookup:', cmd);
    const result = execSync(cmd, { encoding: 'utf8' }).trim().split('\n')[0].trim();
    if (result && existsSync(result)) {
      LOG('  found via PATH:', result);
      return result;
    }
  } catch { /* not found in PATH */ }

  const home = os.homedir();
  const candidates = [
    // Windows installer location; Obsidian may have started before the installer updated PATH
    join(process.env.LOCALAPPDATA ?? join(home, 'AppData', 'Local'), 'agy', 'bin', 'agy.exe'),
    // Mac / Linux (unverified)
    join(home, '.local', 'bin', 'agy'),
    '/usr/local/bin/agy',
  ];
  for (const c of candidates) {
    if (existsSync(c)) {
      LOG('  found at:', c);
      return c;
    }
  }

  WARN('  agy binary not found anywhere');
  return null;
}

// ---------------------------------------------------------------------------
// Spawn, probe, usage
// ---------------------------------------------------------------------------

export function spawnAgy(opts: TurnOptions): ChildProcess {
  const args = buildAgySpawnArgs(opts);
  LOG('spawnAgy cwd:', opts.cwd, 'conversation:', opts.resumeSessionId ?? 'new');
  const proc = launchCli(opts.binaryPath, args, opts.cwd, opts.env);
  if (!proc.stdin) {
    throw new Error('Antigravity process started with no stdin pipe — cannot send prompt.');
  }
  // One prompt line, then close stdin so agy ends after this turn.
  proc.stdin.write(agyPromptLine(opts.prompt), 'utf8');
  proc.stdin.end();
  return proc;
}

const PROBE_TIMEOUT_MS = 10_000;

/** `agy --version` prints to stdout but `--help` to stderr. Never rejects. */
export async function probeAgyCapabilities(
  binaryPath: string,
  env: Record<string, string>,
  cwd: string,
): Promise<CliCapabilities> {
  try {
    const versionText = await runCli(binaryPath, ['--version'], cwd, env, PROBE_TIMEOUT_MS);
    const help = await runCliCapture(binaryPath, ['--help'], cwd, env, PROBE_TIMEOUT_MS);
    const caps = parseCliCapabilities(help.stdout + help.stderr, versionText);
    LOG('agy capabilities — version:', caps.version ?? 'unknown',
      '— effort levels:', caps.effortLevels.join(',') || '(unsupported)',
      '— flags:', [...caps.flags].sort().join(' ') || '(none)');
    return caps;
  } catch (e) {
    WARN('agy capability probe failed — using defaults:', e instanceof Error ? e.message : String(e));
    return UNKNOWN_CAPABILITIES;
  }
}

/** First argument that is a non-empty string, else `fallback`. */
function firstString(fallback: string, ...values: unknown[]): string {
  for (const v of values) if (typeof v === 'string' && v) return v;
  return fallback;
}

/**
 * Plain-text report from `agy --print /usage` JSON. Pure — exported for tests.
 * `formatTime` renders an ISO reset time (local time in the app; fixed in tests).
 */
export function formatAgyUsage(json: string, formatTime: (iso: string) => string = iso => new Date(iso).toLocaleString()): string {
  const parsed = JSON.parse(json) as Record<string, unknown>;
  if (parsed.status !== 'SUCCESS') {
    throw new Error(typeof parsed.error === 'string' && parsed.error ? parsed.error : 'Antigravity returned no usage information.');
  }
  const data = (parsed.command as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined;
  const groups = (data?.groups ?? []) as Array<Record<string, unknown>>;
  const lines: string[] = [];
  for (const g of groups) {
    lines.push(firstString('Models', g.name));
    for (const b of (g.buckets ?? []) as Array<Record<string, unknown>>) {
      const name = firstString('Limit', b.name, b.window);
      // agy's bucket names already say "… Remaining"
      const left = /remaining/i.test(name) ? '' : ' left';
      const pct = typeof b.remaining_fraction === 'number' ? `${Math.round(b.remaining_fraction * 100)}%${left}` : 'unknown';
      const reset = typeof b.reset_time === 'string' ? `, resets ${formatTime(b.reset_time)}` : '';
      lines.push(`  ${name}: ${pct}${reset}`);
    }
  }
  if (!lines.length) {
    const text = typeof parsed.response === 'string' ? parsed.response.trim() : '';
    if (!text) throw new Error('Antigravity returned no usage information.');
    return text;
  }
  return lines.join('\n');
}

/** `agy models` stdout ("id<TAB>name" per line) → model options. Pure — exported for tests. */
export function parseAgyModels(text: string): ModelOption[] {
  const models: ModelOption[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const tab = raw.indexOf('\t');
    if (tab <= 0) continue; // progress lines ("Fetching available models...") have no tab
    const id = raw.slice(0, tab).trim();
    const name = raw.slice(tab + 1).trim();
    if (!/^[\w.-]+$/.test(id)) continue;
    models.push({ id, displayName: name || id, description: '' });
  }
  return models;
}

const MODELS_TIMEOUT_MS = 20_000;

export async function listAgyModels(
  binaryPath: string,
  env: Record<string, string>,
  cwd: string,
): Promise<ModelOption[]> {
  const models = parseAgyModels(await runCli(binaryPath, ['models'], cwd, env, MODELS_TIMEOUT_MS));
  if (!models.length) throw new Error('Antigravity listed no models.');
  return models;
}

const USAGE_TIMEOUT_MS = 30_000;

export async function fetchAgyPlanUsage(
  binaryPath: string,
  env: Record<string, string>,
  cwd: string,
): Promise<string> {
  // A fixed command, so passing it as the --print value is safe.
  const out = await runCli(binaryPath, ['--output-format', 'json', '--print', '/usage'], cwd, env, USAGE_TIMEOUT_MS);
  return formatAgyUsage(out);
}

// ---------------------------------------------------------------------------
// Stream adapter
// ---------------------------------------------------------------------------

/** Tool step errors that mean "denied", as opposed to the tool failing. */
const DENIED_PREFIX = 'permission check failed';

/**
 * agy's stderr explanation of a headless auto-denial ("a tool required the
 * "command" permission that headless mode cannot prompt for…"). The denial
 * itself arrives on stdout and drives the denial card, so this is noise in the
 * chat. Pure — exported for tests.
 */
export function isAgyDenialNotice(text: string): boolean {
  return /permission that headless mode cannot prompt for/.test(text);
}

/**
 * An agy failure as an ApiError, so it gets the same error card as Claude
 * Code's API errors. `errorCode` picks the guidance (see formatApiError).
 * Pure — exported for tests.
 */
export function agyApiError(text: string): ApiError {
  const message = text.trim().replace(/^error:\s*/i, '');
  const errorCode = /authentication required|not (?:signed|logged) in|unauthenticated|sign in again/i.test(message)
    ? 'agy_auth'
    : /invalid model selection|not recognized as a known model/i.test(message)
      ? 'agy_invalid_model'
      : 'agy_error';
  return { status: null, message, errorCode, raw: text };
}

function reportAgyError(cb: StreamCallbacks, text: string): void {
  const err = agyApiError(text);
  if (cb.onApiError) cb.onApiError(err);
  else cb.onText(`Antigravity error: ${err.message}`);
}

export function parseAgyStream(proc: ChildProcess, cb: StreamCallbacks): void {
  const handler = createAgyStreamHandler(cb);
  let buffer = '';
  // agy prints fatal errors to stderr as "error: …" and usually again in
  // result.error. Held until close so the error card shows it once.
  let heldError = '';

  proc.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        handler.handle(JSON.parse(line) as Record<string, unknown>);
      } catch {
        LOGV('  non-JSON line:', line.substring(0, 100));
      }
    }
  });

  proc.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    WARN('agy stderr:', text);
    if (isAgyDenialNotice(text)) return;
    if (/^\s*error:/i.test(text) || heldError) {
      heldError += text;
      return;
    }
    cb.onError(text);
  });

  proc.on('close', (code) => {
    const { sessionId, clean, errorReported, resultSeen } = handler.finish();
    if (heldError.trim() && !errorReported) {
      // No result at all (agy exited before the turn): stderr is the only report of why.
      // After a result that wasn't an error, it's an ordinary stderr message.
      if (resultSeen) cb.onError(heldError);
      else reportAgyError(cb, heldError);
    }
    LOG('agy closed — exit code:', code, '— conversation:', sessionId, '— clean:', clean);
    cb.onDone(sessionId, clean);
  });
}

/**
 * Translates agy stream-json events into StreamCallbacks. Exported for tests.
 * Text arrives only as per-step deltas; a step's text is complete at DONE,
 * which is when it's parsed for @@BOJU lines — the same point Claude Code's
 * complete `assistant` message is.
 */
export function createAgyStreamHandler(cb: StreamCallbacks) {
  let sessionId: string | undefined;
  let clean = false;
  let errorReported = false;
  let resultSeen = false;
  const stepText = new Map<number, string>();
  const startedTools = new Set<number>();
  const deniedTools: PermissionDenial[] = [];
  let previewing = false;

  const toolId = (index: number) => `${sessionId ?? 'agy'}:${index}`;

  const handleStep = (s: Record<string, unknown>) => {
    if (s.subagent_info) return; // subagent steps would interleave with the main reply
    const index = s.step_index as number;
    const state = s.state as string;

    if (s.step_type === 'agent_response') {
      const text = (stepText.get(index) ?? '') + (typeof s.text_delta === 'string' ? s.text_delta : '');
      stepText.set(index, text);
      if (state === 'ACTIVE') {
        if (text && cb.onTextPreview) {
          previewing = true;
          cb.onTextPreview(text);
        }
        return;
      }
      // DONE or ERROR: the step's text is final.
      stepText.delete(index);
      if (previewing) {
        previewing = false;
        cb.onTextPreview?.('');
      }
      const { clean: shown, lines } = splitBojuLines(text);
      for (const l of lines) {
        if (l.kind === 'action') cb.onAction(l.line);
        else cb.onQuery?.(l.line);
      }
      if (shown.trim()) cb.onText(shown);
      const usage = s.usage as Record<string, number> | undefined;
      if (usage) {
        cb.onUsage({
          inputTokens: usage.input_tokens ?? 0,
          cacheReadTokens: usage.cache_read_tokens ?? 0,
          outputTokens: usage.output_tokens ?? 0,
        });
      }
      return;
    }

    if (s.step_type === 'tool') {
      const info = (s.tool_info ?? {}) as Record<string, unknown>;
      const name = (s.tool_name ?? info.name ?? 'tool') as string;
      if (!startedTools.has(index)) {
        startedTools.add(index);
        cb.onToolCall(name, info.parameters, toolId(index));
      }
      if (state === 'DONE') {
        cb.onToolResult?.(toolId(index), typeof info.output === 'string' ? info.output : '');
      } else if (state === 'ERROR') {
        const err = (info.error ?? {}) as Record<string, unknown>;
        const message = typeof err.message === 'string' ? err.message : 'Tool error';
        cb.onToolResult?.(toolId(index), message);
        if (message.startsWith(DENIED_PREFIX)) deniedTools.push({ tool: name, input: info.parameters });
      }
    }
  };

  return {
    handle(msg: Record<string, unknown>): void {
      if (typeof msg.conversation_id === 'string' && msg.conversation_id) sessionId = msg.conversation_id;
      switch (msg.event) {
        case 'init':
          break;
        case 'step_update':
          handleStep((msg.step_update ?? {}) as Record<string, unknown>);
          break;
        case 'result': {
          const r = (msg.result ?? {}) as Record<string, unknown>;
          resultSeen = true;
          if (typeof r.conversation_id === 'string' && r.conversation_id) sessionId = r.conversation_id;
          clean = r.status === 'SUCCESS';
          if (!clean && typeof r.error === 'string' && r.error.trim()) {
            reportAgyError(cb, r.error);
            errorReported = true;
          }
          const denied = (r.denied_actions ?? []) as Array<Record<string, unknown>>;
          if (deniedTools.length) {
            cb.onPermissionDenied([...deniedTools]);
          } else if (denied.length) {
            cb.onPermissionDenied(denied.map(d => ({
              tool: firstString('tool', d.display_name, d.action),
              input: { action: d.action },
            })));
          }
          break;
        }
      }
    },
    finish(): { sessionId: string | undefined; clean: boolean; errorReported: boolean; resultSeen: boolean } {
      return { sessionId, clean, errorReported, resultSeen };
    },
  };
}

// ---------------------------------------------------------------------------
// Backend
// ---------------------------------------------------------------------------

/** Orientation wording for Antigravity. Tool names match agy's built-in tools. */
export const ANTIGRAVITY_ORIENTATION: BackendOrientation = {
  agentLabel: 'Antigravity CLI',
  environmentNote: null,
  editToolHint: 'your file tools (write_to_file or replace_file_content)',
  permissions: {
    restricted: {
      summary: 'Chat only',
      can: 'respond to messages, search the web, and work with any context the user explicitly attaches',
      cannot: 'read, write, or modify vault files. If asked to make file changes, describe exactly what you would change and ask the user to switch to Standard mode or apply the change themselves',
    },
    readonly: {
      summary: 'Read-only',
      can: 'read vault files (view_file, grep_search, find_by_name, list_dir), read web pages, and search the web',
      cannot: 'write or modify any files. Answer directly in chat rather than drafting a plan for approval. If asked to make changes, show the user a diff or the exact content to paste',
    },
    standard: {
      summary: 'Standard',
      can: 'read and write vault files (view_file, write_to_file, replace_file_content), read web pages, and search the web',
      cannot: 'run shell commands (run_command) — they are denied unless the user has pre-approved them in Antigravity settings. Request permission if a task genuinely requires one',
    },
    full: {
      summary: 'Full access',
      can: 'use all tools including shell commands (run_command)',
      cannot: 'nothing — all tools are available',
    },
  },
};

export const antigravityBackend: AgentBackend = {
  id: 'antigravity',
  displayName: 'Antigravity',
  findBinary: findAgyBinary,
  probe: probeAgyCapabilities,
  spawnTurn: spawnAgy,
  parseStream: parseAgyStream,
  fetchPlanUsage: (binary, env, cwd) => fetchAgyPlanUsage(binary, env, cwd),
  compactPrompt: null,
  // Its history is a private SQLite store, so BojuBot keeps a transcript instead.
  readableHistory: false,
  listModels: listAgyModels,
  unavailableModes: {
    restricted: "Antigravity can't block file access for a single session.",
  },
  modeDescriptions: {
    readonly: 'read vault, no writes (plan mode)',
    standard: 'read+write vault, no shell commands',
    full: 'unrestricted, including shell',
  },
  orientation: ANTIGRAVITY_ORIENTATION,
};

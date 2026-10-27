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
import { type ApiError, AGY_AUTH, isAgyAuthFailure } from '../utils/apiError';
import { collapseEffortVariants, splitEffortVariant } from '../utils/agentModels';
import { launchCli, runCli, runCliCapture } from './process';
import { AGY_CHAT_AGENT, AGY_MAIN_AGENT, AgyAgentName, syncAgyAgentDefinitions } from './agyAgents';
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
 * Maps BojuBot permissionMode to agy's per-turn flags. agy has no per-run
 * allow/deny rules (those live in its global settings.json), so:
 * - Standard is `--mode accept-edits`: file writes allowed, shell commands
 *   soft-denied in print mode and reported in `denied_actions`. agy's default
 *   mode can't be used: it auto-denies every file write outside the system
 *   temp folder, because headless mode can't ask for approval.
 * - Read only is `--mode plan`, which leaves the workspace untouched.
 * - Chat only without its agent has no equivalent; it gets plan mode too
 *   (most restrictive available, fail closed). The UI doesn't offer Chat only
 *   then. With the bojubot-chat agent, see buildAgySpawnArgs().
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

/**
 * Set when agy refuses to start one of BojuBot's agents (it names a tool this
 * agy doesn't have, or the definition file has gone). From then on, until
 * agy is re-detected (it changed on disk, or its path changed) or Obsidian
 * reloads the plugin, new conversations start without an agent.
 */
let agentsRejected = false;

/** For tests: forget an earlier rejection. */
export function resetAgyAgentRejection(): void {
  agentsRejected = false;
}

/**
 * True when new conversations can use BojuBot's agent definitions: agy lists
 * `--agent`, the probe installed the definitions, and agy hasn't rejected them.
 */
export function agyAgentsAvailable(caps: CliCapabilities): boolean {
  return !agentsRejected && caps.agentDefinitions === true && has(caps, '--agent');
}

/** agy's errors for an agent it can't start. Pure — exported for tests. */
export function isAgyAgentRejection(text: string): boolean {
  return /unknown agent "bojubot|not found in registry|failed to resolve components/i.test(text);
}

/**
 * The agent a new conversation in `mode` starts as (#403), or undefined for
 * none: Chat only runs as bojubot-chat; Standard and Read only as bojubot; a
 * conversation started in Full access, or when the definitions aren't
 * available, has no agent and keeps all of agy's tools.
 */
export function agyConversationAgent(mode: PermissionMode, caps: CliCapabilities): AgyAgentName | undefined {
  if (!agyAgentsAvailable(caps)) return undefined;
  if (mode === 'restricted') return AGY_CHAT_AGENT;
  if (mode === 'full') return undefined;
  return AGY_MAIN_AGENT;
}

/**
 * agy fixes a conversation's tools when it starts, so moving a conversation
 * into or out of Chat only needs a new one: a Chat only conversation can't
 * gain file tools, and any other conversation can't lose them.
 */
export function agyNeedsNewConversation(agent: string | undefined, mode: PermissionMode): boolean {
  return (agent === AGY_CHAT_AGENT) !== (mode === 'restricted');
}

/** CLI args for a chat turn. Pure — exported for tests. Never includes the prompt. */
export function buildAgySpawnArgs(
  opts: Pick<TurnOptions, 'resumeSessionId' | 'permissionMode' | 'model' | 'effort' | 'capabilities' | 'agent'>,
): string[] {
  const caps = opts.capabilities ?? UNKNOWN_CAPABILITIES;
  // The prompt goes in as one stream-json line on stdin: `--print` would need it as an arg.
  const args = ['--input-format', 'stream-json', '--output-format', 'stream-json'];
  // The agent only matters when the conversation starts: agy keeps it for every
  // resumed turn and ignores --agent there.
  if (opts.agent && !opts.resumeSessionId) args.push('--agent', opts.agent);
  // bojubot-chat's tool list (web only) is its enforcement. Prompts are off so
  // read_url_content isn't auto-denied: headless mode can't ask for approval.
  args.push(...(opts.agent === AGY_CHAT_AGENT
    ? ['--dangerously-skip-permissions']
    : agyPermissionArgs(opts.permissionMode ?? 'standard')));
  const effort = opts.effort && has(caps, '--effort') && caps.effortLevels.includes(opts.effort) ? opts.effort : undefined;
  // agy rejects an effort-variant model with --effort ("conflicts with
  // --effort"): with a level, always send the base model.
  const model = effort && opts.model ? (splitEffortVariant(opts.model)?.base ?? opts.model) : opts.model;
  if (model) args.push('--model', model);
  if (effort) args.push('--effort', effort);
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
    throw new Error('The Antigravity CLI started with no stdin pipe — cannot send prompt.');
  }
  // One prompt line, then close stdin so agy ends after this turn.
  proc.stdin.write(agyPromptLine(opts.prompt), 'utf8');
  proc.stdin.end();
  return proc;
}

const PROBE_TIMEOUT_MS = 10_000;

/**
 * When agy lists `--agent`, install BojuBot's agent definitions (`install`,
 * replaceable for tests) and mark them usable. Without the flag nothing is
 * written; if writing fails the capabilities stay as they were, so spawns use
 * the plain mode flags. Exported for tests.
 */
export function withAgyAgentDefinitions(
  caps: CliCapabilities,
  install: () => unknown = () => syncAgyAgentDefinitions(),
): CliCapabilities {
  if (!has(caps, '--agent')) return caps;
  try {
    const written = install();
    if (Array.isArray(written) && written.length) LOG('agy agent definitions written:', written.join(', '));
    return { ...caps, agentDefinitions: true };
  } catch (e) {
    WARN('agy agent definitions could not be written — using plain mode flags:', e instanceof Error ? e.message : String(e));
    return caps;
  }
}

/** `agy --version` prints to stdout but `--help` to stderr. Never rejects. */
export async function probeAgyCapabilities(
  binaryPath: string,
  env: Record<string, string>,
  cwd: string,
): Promise<CliCapabilities> {
  try {
    const versionText = await runCli(binaryPath, ['--version'], cwd, env, PROBE_TIMEOUT_MS);
    const help = await runCliCapture(binaryPath, ['--help'], cwd, env, PROBE_TIMEOUT_MS);
    const caps = withAgyAgentDefinitions(parseCliCapabilities(help.stdout + help.stderr, versionText));
    LOG('agy capabilities — version:', caps.version ?? 'unknown',
      '— effort levels:', caps.effortLevels.join(',') || '(unsupported)',
      '— agent definitions:', caps.agentDefinitions ? 'installed' : 'not used',
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
    throw new Error(typeof parsed.error === 'string' && parsed.error ? parsed.error : 'The Antigravity CLI returned no usage information.');
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
    if (!text) throw new Error('The Antigravity CLI returned no usage information.');
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
  // One entry per base model, with the effort levels it has (#402)
  const models = collapseEffortVariants(parseAgyModels(await runCli(binaryPath, ['models'], cwd, env, MODELS_TIMEOUT_MS)));
  if (!models.length) throw new Error('The Antigravity CLI listed no models.');
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
  const errorCode = isAgyAuthFailure(message)
    ? AGY_AUTH
    : /invalid model selection|not recognized as a known model/i.test(message)
      ? 'agy_invalid_model'
      : isAgyAgentRejection(message)
        ? 'agy_agent_rejected'
        : 'agy_error';
  return { status: null, message, errorCode, raw: text };
}

function reportAgyError(cb: StreamCallbacks, text: string): void {
  const err = agyApiError(text);
  if (err.errorCode === 'agy_agent_rejected') {
    WARN('agy rejected BojuBot\'s agent definition — falling back to plain mode flags');
    agentsRejected = true;
  }
  if (cb.onApiError) cb.onApiError(err);
  else cb.onText(`Gemini error: ${err.message}`);
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
  let rejected = false;
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
            // agy gave the conversation an ID but never started it: don't bind
            // the session to it, so the next turn starts a fresh one.
            if (isAgyAgentRejection(r.error)) rejected = true;
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
      return { sessionId: rejected ? undefined : sessionId, clean, errorReported, resultSeen };
    },
  };
}

// ---------------------------------------------------------------------------
// Backend
// ---------------------------------------------------------------------------

/** Orientation wording for Antigravity. Tool names match agy's built-in tools. */
export const ANTIGRAVITY_ORIENTATION: BackendOrientation = {
  agentLabel: 'Antigravity CLI',
  // Without this, agy goes digging in BojuBot's main.js and GitHub source to learn
  // how to drive Obsidian (test/agy-bridge-check.ts), burning quota and turns.
  environmentNote: 'This orientation is all you need to work with {{BRAND}}. Do not read {{BRAND}} plugin files (main.js, manifest.json) or fetch its source code online. If unsure of an action or query, emit the help query for its reference instead.',
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
      cannot: 'run shell commands (run_command). Use your file tools instead, and request permission if a task genuinely requires a shell',
    },
    full: {
      summary: 'Full access',
      can: 'use all tools including shell commands (run_command)',
      cannot: 'nothing — all tools are available',
    },
  },
};

/** Chat only needs BojuBot's bojubot-chat agent (#403); without it agy can't
 *  block file access for a single session. Exported for tests. */
export function agyUnavailableModes(caps: CliCapabilities): Partial<Record<PermissionMode, string>> {
  return agyAgentsAvailable(caps) ? {} : { restricted: "The Antigravity CLI can't block file access for a single session." };
}

/** Picker wording. Chat only is only described when it's offered. Exported for tests. */
export function agyModeDescriptions(caps: CliCapabilities): Partial<Record<PermissionMode, string>> {
  return {
    ...(agyAgentsAvailable(caps) ? { restricted: 'web only, no file access; switching starts a new session' } : {}),
    readonly: 'read vault, no writes (plan mode)',
    standard: 'read+write vault, no shell commands',
    full: 'unrestricted, including shell',
  };
}

/** The Gemini sparkle from Microsoft's Codicons (CC BY 4.0, credited in src/credits.json;
 *  the mark itself is Google's). No Antigravity mark is published under an open license. */
const GEMINI_MARK_SVG = '<svg role="img" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="100%" height="100%"><title>Gemini (Antigravity CLI)</title><path d="M7.98695 0C8.15434 0 8.30031 0.114462 8.34117 0.276923C8.46604 0.773819 8.63059 1.25989 8.83323 1.73046C9.36295 2.96123 10.0898 4.0384 11.0127 4.96123C11.936 5.88431 13.0129 6.6112 14.2434 7.14092C14.7141 7.3435 15.2003 7.50805 15.6972 7.63298C15.8597 7.67385 15.9739 7.81957 15.9739 7.98695C15.9739 8.15434 15.8597 8.30031 15.697 8.34117C15.2001 8.46604 14.714 8.63059 14.2434 8.83323C13.0127 9.36295 11.9358 10.0898 11.0127 11.0127C10.0898 11.936 9.36295 13.0129 8.83323 14.2434C8.63056 14.7141 8.46593 15.2003 8.34092 15.6972C8.32114 15.7762 8.27558 15.8463 8.21146 15.8964C8.14734 15.9465 8.06833 15.9738 7.98695 15.9739C7.81957 15.9739 7.67385 15.8597 7.63298 15.697C7.50802 15.2001 7.34339 14.714 7.14068 14.2434C6.6112 13.0127 5.88455 11.9358 4.96123 11.0127C4.03815 10.0898 2.96123 9.36295 1.73046 8.83323C1.25987 8.63058 0.773805 8.46595 0.276923 8.34092C0.197979 8.3212 0.127873 8.27569 0.077712 8.21162C0.0275511 8.14755 0.00020297 8.06857 0 7.9872C0 7.81982 0.114462 7.67409 0.276923 7.63323C0.773826 7.50828 1.2599 7.34365 1.73046 7.14092C2.96123 6.61145 4.0384 5.88455 4.96123 4.96148C5.88431 4.03865 6.6112 2.96148 7.14092 1.73071C7.3435 1.26011 7.50804 0.774045 7.63298 0.277169C7.65267 0.198138 7.69819 0.127947 7.76232 0.0777335C7.82645 0.0275203 7.90551 0.000161972 7.98695 0Z"/></svg>';

export const antigravityBackend: AgentBackend = {
  id: 'antigravity',
  icon: { svg: GEMINI_MARK_SVG },
  label: 'Gemini (Antigravity CLI)',
  name: 'Gemini',
  cliName: 'Antigravity CLI',
  cliPhrase: 'the Antigravity CLI',
  findBinary: findAgyBinary,
  probe: probeAgyCapabilities,
  spawnTurn: spawnAgy,
  parseStream: parseAgyStream,
  fetchPlanUsage: (binary, env, cwd) => fetchAgyPlanUsage(binary, env, cwd),
  compactPrompt: null,
  // Its history is a private SQLite store, so BojuBot keeps a transcript instead.
  readableHistory: false,
  listModels: listAgyModels,
  effortVariants: true,
  unavailableModes: agyUnavailableModes,
  modeDescriptions: agyModeDescriptions,
  conversationAgent: agyConversationAgent,
  needsNewConversation: agyNeedsNewConversation,
  orientation: ANTIGRAVITY_ORIENTATION,
};

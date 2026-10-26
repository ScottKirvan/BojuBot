/**
 * Pure helpers for API errors reported by the Claude Code CLI.
 * No Obsidian API dependency — safe to import in unit tests.
 *
 * When the API rejects a request, the CLI emits a synthetic assistant message
 * (`message.model === '<synthetic>'`) whose text is `API Error: <status> <json>`,
 * followed by a `result` with `is_error: true`.
 */

import { TROUBLESHOOTING_URL } from '../constants';

export const API_ERROR_PREFIX = 'API Error:';

/** errorCode for a Claude Code sign-in failure (missing, expired or rejected login). */
export const CLAUDE_AUTH = 'claude_auth';
/** errorCode for an Antigravity sign-in failure. */
export const AGY_AUTH = 'agy_auth';

/** Troubleshooting sections the sign-in cards link to (docs/guide/troubleshooting.md). */
export const CLAUDE_SIGN_IN_HELP_URL = `${TROUBLESHOOTING_URL}#signing-in-to-claude-code-again`;
export const AGY_SIGN_IN_HELP_URL = `${TROUBLESHOOTING_URL}#signing-in-to-antigravity-again`;

export interface ApiError {
  /** HTTP status code, or null if the text didn't include one. */
  status: number | null;
  /** Human-readable message extracted from the JSON payload (or the raw remainder). */
  message: string;
  /** `error.details.error_code` from the payload, if present. */
  errorCode: string | null;
  /** The original text, for logging. */
  raw: string;
}

export interface ApiErrorDisplay {
  title: string;
  details: string[];
  /** Sign-in failures: the agent whose login needs renewing (drives Open terminal). */
  signIn?: 'claude-code' | 'antigravity';
  /** Sign-in failures: the troubleshooting section to link to. */
  helpUrl?: string;
}

/**
 * Claude Code wording for a missing, expired or rejected login. Only matched
 * against text the CLI itself produced (a synthetic message or an API error),
 * or anchored to the start of a reply — see claudeAuthFailure / claudeAuthReply.
 */
const CLAUDE_AUTH_TEXT = new RegExp([
  'not logged in',
  'failed to authenticate',
  'oauth (?:session|token) (?:has )?(?:expired|been revoked)',
  'token (?:has )?expired',
  'invalid api key',
  'please run /login',
  'authentication_error',
  'invalid (?:bearer token|x-api-key|authentication credentials)',
].join('|'), 'i');

/**
 * Classify text the Claude Code CLI reported as a failure (the text of a
 * synthetic assistant message). Returns the parsed API error — with errorCode
 * CLAUDE_AUTH when it's a sign-in failure — or, for non-`API Error:` text, an
 * ApiError only when it's a sign-in failure. Null means "not an error card":
 * the text is shown as an ordinary reply.
 */
export function claudeAuthFailure(text: string): ApiError | null {
  const parsed = parseApiError(text);
  if (parsed) {
    // A 401 from the API call Claude Code itself made is always the user's
    // credentials; tool calls (e.g. a fetched web page) never come through here.
    if (!parsed.errorCode && (parsed.status === 401 || CLAUDE_AUTH_TEXT.test(parsed.raw))) {
      return { ...parsed, errorCode: CLAUDE_AUTH };
    }
    return parsed;
  }
  if (!CLAUDE_AUTH_TEXT.test(text)) return null;
  const status = /API Error:\s*(\d{3})\b/.exec(text);
  return { status: status ? Number(status[1]) : null, message: text.trim(), errorCode: CLAUDE_AUTH, raw: text };
}

/**
 * A whole Claude Code reply that is really a sign-in failure, e.g. "Not logged
 * in · Please run /login" or "Failed to authenticate: OAuth session expired and
 * could not be refreshed." when it didn't arrive as a synthetic message. Only
 * short replies that start with the failure count, so a reply that merely
 * talks about logging in stays a reply.
 */
export function claudeAuthReply(text: string): ApiError | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 400) return null;
  if (!/^(?:not logged in|failed to authenticate|invalid api key|oauth (?:session|token)|please run \/login|api error:\s*401\b)/i.test(trimmed)) return null;
  return claudeAuthFailure(trimmed) ?? { status: null, message: trimmed, errorCode: CLAUDE_AUTH, raw: text };
}

/** Antigravity wording for a missing, expired or rejected sign-in. */
const AGY_AUTH_TEXT = new RegExp([
  /authentication required|not (?:signed|logged) in|unauthenticated|login required|re-?authenticat/,
  /(?:sign|log)(?:ed)?[ -]?in (?:again|required|expired)/,
  /(?:token|session|credentials?|login|sign-?in|auth\w*) (?:has |have |is |are )?expired/,
  /expired (?:token|session|credentials?|login|sign-?in)/,
  /invalid (?:credentials|auth token|access token|refresh token)/,
  /\b(?:status|code|http)\W{0,3}401\b|\b401\W{0,3}unauthori[sz]ed|unauthori[sz]ed\W{0,3}401\b/,
].map(r => r.source).join('|'), 'i');

/**
 * True when an Antigravity failure means the user must sign in again. Only
 * agy's own fatal errors reach this (its "error: …" stderr line and
 * result.error); a tool's failure — say a 401 from a fetched page — arrives as
 * a tool step error and never does. Pure — exported for tests.
 */
export function isAgyAuthFailure(message: string): boolean {
  return AGY_AUTH_TEXT.test(message);
}

/**
 * Parse a CLI `API Error: ...` text block. Returns null when the text isn't
 * an API error. Malformed JSON falls back to the raw text after the status.
 */
export function parseApiError(text: string): ApiError | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith(API_ERROR_PREFIX)) return null;

  const rest = trimmed.slice(API_ERROR_PREFIX.length).trim();
  const statusMatch = /^(\d{3})\b\s*/.exec(rest);
  const status = statusMatch ? Number(statusMatch[1]) : null;
  const body = statusMatch ? rest.slice(statusMatch[0].length).trim() : rest;

  let message = body;
  let errorCode: string | null = null;
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const err = parsed.error as Record<string, unknown> | undefined;
    if (err && typeof err.message === 'string' && err.message) message = err.message;
    const details = err?.details as Record<string, unknown> | undefined;
    if (details && typeof details.error_code === 'string') errorCode = details.error_code;
  } catch { /* not JSON — keep the raw remainder */ }

  return { status, message: message || trimmed, errorCode, raw: text };
}

/**
 * Turn a parsed API error into user-facing text. `platform` is
 * `process.platform`, passed in so the helper stays pure.
 */
export function formatApiError(err: ApiError, platform: string): ApiErrorDisplay {
  if (err.errorCode === 'claude_code_version_too_old') {
    const m = /Claude Code (\S+) does not support this model; version (\S+) or newer is required/.exec(err.message);
    const first = m
      ? `Your Claude Code CLI (${m[1]}) doesn't support this model. Version ${m[2]} or newer is required.`
      : "Your Claude Code CLI doesn't support this model. A newer version is required.";
    const update = platform === 'win32'
      ? 'Update it by running "claude update" in a terminal (or "winget upgrade Anthropic.ClaudeCode" if you installed with winget), then send your message again.'
      : 'Update it by running "claude update" in a terminal, then send your message again.';
    return {
      title: 'Claude Code needs an update',
      details: [first, update, 'To keep working in the meantime, switch to an older model.'],
    };
  }

  if (err.errorCode === CLAUDE_AUTH) {
    const expired = /expired|could not be refreshed|revoked/i.test(err.raw);
    const missing = /not logged in/i.test(err.raw);
    return {
      title: expired ? 'Your Claude Code login has expired'
        : missing ? "Claude Code isn't signed in"
          : "Claude Code couldn't verify your login",
      details: [
        'Click Open terminal below to start Claude Code. Type /login and press Enter (skip this if it already asks you to sign in), then sign in in the browser window that opens.',
        "Once you're signed in, close the terminal and send your message again.",
      ],
      signIn: 'claude-code',
      helpUrl: CLAUDE_SIGN_IN_HELP_URL,
    };
  }

  if (err.errorCode === AGY_AUTH) {
    return {
      title: /expired/i.test(err.raw) ? 'Your Antigravity CLI sign-in has expired' : "The Antigravity CLI isn't signed in",
      details: [
        'Click Open terminal below, or run "agy" in a terminal yourself. It opens a browser window where you sign in.',
        "Once you're signed in, close the terminal and send your message again.",
      ],
      signIn: 'antigravity',
      helpUrl: AGY_SIGN_IN_HELP_URL,
    };
  }

  if (err.errorCode === 'agy_invalid_model') {
    return {
      title: 'Model not available',
      details: [
        err.message.split('\n')[0].replace(/\s*\(--model[^)]*\)/, ''),
        'Pick another model from the model picker (click the model name below the message box), then send your message again.',
      ],
    };
  }

  if (err.errorCode === 'agy_agent_rejected') {
    return {
      title: "The Antigravity CLI couldn't start this mode's agent",
      details: [
        err.message.split('\n')[0],
        "Until Obsidian restarts, new Gemini sessions start without it and Chat only is unavailable. Send your message again.",
      ],
    };
  }

  if (err.errorCode === 'agy_error') {
    return { title: 'Gemini error', details: [err.message] };
  }

  return {
    title: err.status !== null ? `API error (${err.status})` : 'API error',
    details: [err.message],
  };
}

/**
 * Claude Code prints `[claude-code:unrecognized_model] {"model":"…",…}` to
 * stderr when it's older than the selected model. The request still goes
 * through, so this is a warning, not an error. Returns the model ID and the
 * stderr text with that line removed (anything else is still worth showing),
 * or null when the text isn't this warning.
 */
export function parseUnrecognizedModel(stderr: string): { model: string; rest: string } | null {
  const lines = stderr.split(/\r?\n/);
  const index = lines.findIndex(l => l.includes('[claude-code:unrecognized_model]'));
  if (index < 0) return null;
  let model = '';
  const json = /\{.*\}/.exec(lines[index]);
  if (json) {
    try {
      const parsed = JSON.parse(json[0]) as Record<string, unknown>;
      if (typeof parsed.model === 'string') model = parsed.model;
    } catch { /* keep the generic wording */ }
  }
  lines.splice(index, 1);
  return { model, rest: lines.join('\n').trim() };
}

/** Plain-language note for the unrecognized-model warning. */
export function unrecognizedModelNotice(model: string, cliVersion: string | null): string {
  const cli = cliVersion ? `Your Claude Code (${cliVersion})` : 'Your Claude Code';
  const what = model ? `doesn't know ${model} yet` : "doesn't know this model yet";
  return `${cli} ${what}. Replies still work, but token counts may be slightly off. Update Claude Code to clear this warning.`;
}

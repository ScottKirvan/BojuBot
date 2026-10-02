/**
 * Pure helpers for API errors reported by the Claude Code CLI.
 * No Obsidian API dependency — safe to import in unit tests.
 *
 * When the API rejects a request, the CLI emits a synthetic assistant message
 * (`message.model === '<synthetic>'`) whose text is `API Error: <status> <json>`,
 * followed by a `result` with `is_error: true`.
 */

export const API_ERROR_PREFIX = 'API Error:';

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

  return {
    title: err.status !== null ? `API error (${err.status})` : 'API error',
    details: [err.message],
  };
}

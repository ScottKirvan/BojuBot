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

  if (err.errorCode === 'agy_auth') {
    return {
      title: "Antigravity isn't signed in",
      details: [
        'Click Open terminal below, or run "agy" in a terminal yourself. It opens a browser window where you sign in.',
        'Once you\'re signed in, close the terminal and send your message again.',
      ],
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

  if (err.errorCode === 'agy_error') {
    return { title: 'Antigravity error', details: [err.message] };
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

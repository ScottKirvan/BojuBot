/**
 * The in-app "Report a problem" form (#382): turns what the user reviewed into a
 * GitHub issue. Everything here is pure — no Obsidian API — so it's unit-tested.
 * Send posts the report to the report relay (#381), which files the issue; the
 * fallbacks are a pre-filled GitHub "new issue" link and copying the report.
 * Nothing is sent until the user clicks Send.
 */

export type ReportType = 'bug' | 'feature' | 'feedback';

export interface ReportInput {
  type: ReportType;
  /** One-line summary; the issue title after its type prefix. */
  title: string;
  /** What went wrong, or what they'd like. Goes in the body only. */
  description: string;
  /** Version line, agent and model, error text — already reviewed and editable. */
  details: string;
  /** Recent debug log lines, only when the user ticked "include recent log". */
  log?: string;
}

/** Title prefixes the org's issue templates use. */
const TITLE_PREFIX: Record<ReportType, string> = { bug: '[BUG] ', feature: '[FEATURE] ', feedback: '[GENERAL] ' };
/** Longest title the form accepts (the field's maxlength); GitHub and the relay allow 256. */
export const TITLE_MAX = 120;
/** The org's issue templates. Blank issues are disabled org-wide, so a link
 *  without a template would land on the template picker and lose the report. */
const TEMPLATE: Record<ReportType, string> = { bug: 'bug_report.md', feature: 'feature_request.md', feedback: 'general_report.md' };
/** Browsers and GitHub cope with URLs well beyond this, but it keeps us safe everywhere. */
export const REPORT_URL_MAX = 7000;

/** "[BUG] The title", on one line and no longer than TITLE_MAX. */
export function reportTitle(type: ReportType, title: string): string {
  const first = title.trim().split(/\r?\n/)[0].replace(/\s+/g, ' ');
  const text = first.length > TITLE_MAX ? first.slice(0, TITLE_MAX - 1).trimEnd() + '…' : first;
  return TITLE_PREFIX[type] + (text || (type === 'feature' ? 'Feature request' : type === 'bug' ? 'Problem report' : 'Feedback'));
}

/**
 * Markdown body following the shape of the org's issue templates. `footer`
 * adds the "Sent from…" line; the relay adds its own, so Send leaves it off.
 */
export function reportBody(input: ReportInput, footer = true): string {
  const description = input.description.trim() || '_(no description)_';
  const details = input.details.trim();
  const parts: string[] = [];
  if (input.type === 'feature') {
    parts.push('## Problem / Motivation', description);
    if (details) parts.push('## Additional Context', details);
  } else {
    parts.push('## Description', description);
    if (details) parts.push('## Environment', details);
  }
  if (input.log?.trim()) parts.push('## Recent log', '```\n' + input.log.trim() + '\n```');
  if (footer) parts.push('---', '_Sent from BojuBot\'s Report a problem form._');
  return parts.join('\n\n');
}

/**
 * A GitHub "new issue" link with the title and body filled in. If the result
 * would be too long, the log is dropped first, then the body is cut, with a
 * note telling the reporter to paste the full text (Copy report) instead.
 */
export function reportIssueUrl(sourceRepoUrl: string, input: ReportInput, maxLength = REPORT_URL_MAX): string {
  const base = `${sourceRepoUrl.replace(/\/+$/, '')}/issues/new`;
  const make = (body: string) =>
    `${base}?template=${TEMPLATE[input.type]}&title=${encodeURIComponent(reportTitle(input.type, input.title))}&body=${encodeURIComponent(body)}`;

  let url = make(reportBody(input));
  if (url.length <= maxLength) return url;

  url = make(reportBody({ ...input, log: undefined }) + '\n\n_The recent log was too long for a link; paste it in a comment._');
  if (url.length <= maxLength) return url;

  const note = '\n\n_…cut to fit a link. Use **Copy report** in BojuBot and paste the full text here._';
  let body = reportBody({ ...input, log: undefined });
  while (body.length > 0 && make(body + note).length > maxLength) body = body.slice(0, Math.floor(body.length * 0.9));
  return make(body + note);
}

/** Longest description the agent's report-problem action may pre-fill. */
export const PREFILL_DESCRIPTION_MAX = 20000;

/** What the agent may pre-fill in the form; the user reviews it and decides whether to send. */
export interface ReportPrefill {
  type?: ReportType;
  title?: string;
  description?: string;
}

/**
 * Check the agent's `report-problem` action: an unknown type and non-string
 * fields are dropped, and the text is capped. Never sends anything; the caller
 * only opens the form with these values.
 */
export function reportPrefill(action: Record<string, unknown>): ReportPrefill {
  const prefill: ReportPrefill = {};
  if (action.type === 'bug' || action.type === 'feature' || action.type === 'feedback') prefill.type = action.type;
  if (typeof action.title === 'string' && action.title.trim()) {
    prefill.title = action.title.trim().split(/\r?\n/)[0].replace(/\s+/g, ' ').slice(0, TITLE_MAX);
  }
  if (typeof action.description === 'string' && action.description.trim()) {
    prefill.description = action.description.trim().slice(0, PREFILL_DESCRIPTION_MAX);
  }
  return prefill;
}

/** The relay's name for BojuBot; it picks the repo the issue goes to. */
export const RELAY_APP = 'bojubot';
/** The relay's limit on `body`. */
export const RELAY_BODY_MAX = 65000;

/** What Send posts to the report relay (#381): `POST /report` as JSON. */
export interface RelayRequest {
  app: string;
  type: ReportType;
  title: string;
  body: string;
}

/**
 * The relay request for a report. A body over the relay's limit drops the log
 * first, then is cut with a note, so a long log never makes Send fail.
 */
export function relayRequest(input: ReportInput, maxBody = RELAY_BODY_MAX): RelayRequest {
  const request = (body: string): RelayRequest => ({ app: RELAY_APP, type: input.type, title: reportTitle(input.type, input.title), body });
  let body = reportBody(input, false);
  if (body.length <= maxBody) return request(body);
  body = reportBody({ ...input, log: undefined }, false) + '\n\n_The recent log was too long to include._';
  if (body.length <= maxBody) return request(body);
  const note = '\n\n_…cut to fit._';
  return request(body.slice(0, Math.max(0, maxBody - note.length)) + note);
}

/** How a Send ended: the public issue's link, or a message for the form. */
export type SendResult =
  | { ok: true; url: string; number: number }
  | { ok: false; message: string };

/**
 * Read the relay's reply. Anything but a `201` with an issue link is a failure
 * with a message for the form; the form keeps Open on GitHub and Copy report,
 * so a report is never lost.
 */
export function readRelayResponse(status: number, json: unknown): SendResult {
  const data = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  if (status === 201 && typeof data.url === 'string' && /^https:\/\/github\.com\//.test(data.url)) {
    return { ok: true, url: data.url, number: typeof data.number === 'number' ? data.number : 0 };
  }
  const fallback = 'Use Open on GitHub or Copy report instead.';
  switch (data.error) {
    case 'rate_limited':
      return { ok: false, message: `Too many reports were sent from your network in the last minute. Try again shortly, or ${lower(fallback)}` };
    case 'payload_too_large':
      return { ok: false, message: `The report is too long to send. Shorten the details or the log, or ${lower(fallback)}` };
    case 'invalid_report':
      return { ok: false, message: data.field === 'title'
        ? 'The title is too long. Shorten it and try again.'
        : `The report couldn't be sent as it is. ${fallback}` };
    case 'disabled':
    case 'not_configured':
      return { ok: false, message: `Sending reports is switched off right now. ${fallback}` };
    default:
      return { ok: false, message: `The report couldn't be sent${status ? ` (error ${status})` : ''}. ${fallback}` };
  }
}

/** Message for a Send that got no reply at all (offline, blocked, timed out). */
export const RELAY_UNREACHABLE = "Couldn't reach the report service. Check your connection and try again, or use Open on GitHub or Copy report instead.";

function lower(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** The last `n` non-empty lines of a log. */
export function tailLines(text: string, n: number): string {
  if (n <= 0) return '';
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  return lines.slice(-n).join('\n');
}

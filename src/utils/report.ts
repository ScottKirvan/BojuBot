/**
 * The in-app "Report a problem" form (#382): turns what the user reviewed into a
 * GitHub issue. Everything here is pure — no Obsidian API — so it's unit-tested.
 * Until the report relay (#381) exists, reports go out as a pre-filled GitHub
 * "new issue" link or are copied to the clipboard; nothing is sent by BojuBot.
 */

export type ReportType = 'bug' | 'feature' | 'feedback';

export interface ReportInput {
  type: ReportType;
  /** What went wrong, or what they'd like. */
  description: string;
  /** Version line, agent and model, error text — already reviewed and editable. */
  details: string;
  /** Recent debug log lines, only when the user ticked "include recent log". */
  log?: string;
}

/** Title prefixes the org's issue templates use. */
const TITLE_PREFIX: Record<ReportType, string> = { bug: '[BUG] ', feature: '[FEATURE] ', feedback: '[GENERAL] ' };
const TITLE_MAX = 80;
/** The org's issue templates. Blank issues are disabled org-wide, so a link
 *  without a template would land on the template picker and lose the report. */
const TEMPLATE: Record<ReportType, string> = { bug: 'bug_report.md', feature: 'feature_request.md', feedback: 'general_report.md' };
/** Browsers and GitHub cope with URLs well beyond this, but it keeps us safe everywhere. */
export const REPORT_URL_MAX = 7000;

/** "[BUG] First line of the description", trimmed to a readable length. */
export function reportTitle(type: ReportType, description: string): string {
  const first = description.trim().split(/\r?\n/)[0].replace(/\s+/g, ' ');
  const text = first.length > TITLE_MAX ? first.slice(0, TITLE_MAX - 1).trimEnd() + '…' : first;
  return TITLE_PREFIX[type] + (text || (type === 'feature' ? 'Feature request' : type === 'bug' ? 'Problem report' : 'Feedback'));
}

/** Markdown body following the shape of the org's issue templates. */
export function reportBody(input: ReportInput): string {
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
  parts.push('---', '_Sent from BojuBot\'s Report a problem form._');
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
    `${base}?template=${TEMPLATE[input.type]}&title=${encodeURIComponent(reportTitle(input.type, input.description))}&body=${encodeURIComponent(body)}`;

  let url = make(reportBody(input));
  if (url.length <= maxLength) return url;

  url = make(reportBody({ ...input, log: undefined }) + '\n\n_The recent log was too long for a link; paste it in a comment._');
  if (url.length <= maxLength) return url;

  const note = '\n\n_…cut to fit a link. Use **Copy report** in BojuBot and paste the full text here._';
  let body = reportBody({ ...input, log: undefined });
  while (body.length > 0 && make(body + note).length > maxLength) body = body.slice(0, Math.floor(body.length * 0.9));
  return make(body + note);
}

/** The last `n` non-empty lines of a log. */
export function tailLines(text: string, n: number): string {
  if (n <= 0) return '';
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  return lines.slice(-n).join('\n');
}

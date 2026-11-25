import { neutralizeTriggers } from '../constants';

/**
 * Vault query types and the pure parts of resolving them: labels, the inject
 * message, the file-list filter and note search (#443). No Obsidian API here,
 * so all of it is unit-tested; QueryHandler.ts enumerates and reads the files.
 */

export type VaultQueryType = 'backlinks' | 'outlinks' | 'tags' | 'file-list' | 'search' | 'help';
export type VaultQueryMode = 'show' | 'inject';

export interface VaultQuery {
  id?: string;
  query: VaultQueryType;
  /** Required for backlinks, outlinks, and per-file tags. */
  path?: string;
  /** For tags query: find all files with this tag. */
  tag?: string;
  /** For file-list and search: restrict to this folder. */
  folder?: string;
  /** For file-list: return an indented tree to this depth instead of a flat list. 1–N levels, -1 = unlimited.
   *  With `name`, a limit on how deep below the folder a match may be. */
  depth?: number;
  /** For file-list: only files whose name contains this (case-insensitive). */
  name?: string;
  /** For search: the text to find inside notes and canvases (literal; case-insensitive unless matchCase). */
  text?: string;
  /** For search: match `text` only as a whole word ("move" doesn't match "removed"; "move-file" still has "move"). */
  wholeWord?: boolean;
  /** For search: match capitals exactly. */
  matchCase?: boolean;
  /** For file-list: "modified" lists the most recently changed first, with each file's time in `modified`. */
  sort?: 'name' | 'modified';
  /** For file-list: only files changed on or after this date or time (ISO, e.g. "2026-11-25"). Adds `modified`. */
  modifiedSince?: string;
  mode: VaultQueryMode;
  /** For help queries: which reference bundle to inject. */
  topic?: 'ui-bridge' | 'vault-query' | 'canvas' | 'commands';
}

export interface VaultQueryResult {
  query: VaultQuery;
  result: unknown;
  error?: string;
}

/** Most notes a search returns; the rest are counted in `more`. */
export const SEARCH_MAX_NOTES = 30;
/** Most matching lines a search returns per note. */
export const SEARCH_MAX_LINES = 3;
/** Longest a returned line gets (plus an ellipsis on each cut end). */
export const SEARCH_LINE_CHARS = 200;

export interface SearchLine {
  /** 1-based line number in the note. */
  line: number;
  text: string;
}

export interface SearchNoteMatch {
  path: string;
  /** How many times the text occurs in the note. */
  matches: number;
  /** How many lines of the note match in all. */
  matchingLines: number;
  /** The first SEARCH_MAX_LINES matching lines. In a canvas, lines of its text cards. */
  lines: SearchLine[];
}

export interface SearchOptions {
  wholeWord?: boolean;
  matchCase?: boolean;
}

export interface SearchResult {
  text: string;
  folder?: string;
  wholeWord?: boolean;
  matchCase?: boolean;
  /** Occurrences in every matching note, including the ones past SEARCH_MAX_NOTES. */
  totalMatches: number;
  /** Matching notes in all, including the ones past SEARCH_MAX_NOTES. */
  totalNotes: number;
  notes: SearchNoteMatch[];
  /** "…and N more notes …", only when there were more than SEARCH_MAX_NOTES. */
  more?: string;
}

/** A folder param as a path prefix ("Projects" → "Projects/"); '' for the whole vault. */
export function folderPrefix(folder?: string): string {
  const trimmed = (folder ?? '').trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `${trimmed}/` : '';
}

/** Whether a vault path is inside the folder (anywhere below it). No folder = the whole vault. */
export function inFolder(path: string, folder?: string): boolean {
  const prefix = folderPrefix(folder);
  return !prefix || path.startsWith(prefix);
}

/**
 * The flat file-list result: paths inside `folder` whose file name contains
 * `name` (case-insensitive; an empty name matches everything), at most `depth`
 * levels below the folder (1 = directly in it; -1, 0 or none = any depth), sorted.
 */
export function filterFileList(paths: string[], opts: { folder?: string; name?: string; depth?: number } = {}): string[] {
  const prefix = folderPrefix(opts.folder);
  const needle = (opts.name ?? '').trim().toLowerCase();
  const maxDepth = opts.depth !== undefined && opts.depth > 0 ? opts.depth : Infinity;
  return paths
    .filter(p => !prefix || p.startsWith(prefix))
    .filter(p => !needle || p.slice(p.lastIndexOf('/') + 1).toLowerCase().includes(needle))
    .filter(p => p.slice(prefix.length).split('/').length <= maxDepth)
    .sort();
}

/** The error for a search query that can't run, or undefined. */
export function searchError(query: VaultQuery): string | undefined {
  if (typeof query.text !== 'string' || !query.text.trim()) return 'text required: the words to find';
  return undefined;
}

/** A file and when it last changed (ms since the epoch). */
export interface FileTime {
  path: string;
  mtime: number;
}

/** The error for a file-list query with a date that can't be read, or undefined. */
export function fileListError(query: VaultQuery): string | undefined {
  if (query.modifiedSince !== undefined && Number.isNaN(Date.parse(String(query.modifiedSince)))) {
    return `modifiedSince must be a date or time such as "2026-11-25" (got "${String(query.modifiedSince)}")`;
  }
  return undefined;
}

/** Whether a file-list query asks for change times. */
export function wantsModified(query: VaultQuery): boolean {
  return query.sort === 'modified' || query.modifiedSince !== undefined;
}

/**
 * Files with their change times, as file-list returns them when asked:
 * changed on or after `modifiedSince` (when given), newest first for
 * `sort: "modified"` (else by path), and `modified` mapping each path to its
 * ISO time. Pure: `files` must already be filtered by folder and name.
 */
export function withModified(files: FileTime[], opts: { sort?: string; modifiedSince?: string }): { files: string[]; modified: Record<string, string> } {
  const since = opts.modifiedSince !== undefined ? Date.parse(opts.modifiedSince) : NaN;
  const kept = files.filter(f => Number.isNaN(since) || f.mtime >= since);
  kept.sort(opts.sort === 'modified'
    ? (a, b) => b.mtime - a.mtime || a.path.localeCompare(b.path)
    : (a, b) => a.path.localeCompare(b.path));
  const modified: Record<string, string> = {};
  for (const f of kept) modified[f.path] = new Date(f.mtime).toISOString();
  return { files: kept.map(f => f.path), modified };
}

/** The text a canvas shows: its text cards, one after another. '' when the file isn't canvas JSON. Pure. */
export function canvasText(json: string): string {
  try {
    const data = JSON.parse(json) as { nodes?: { type?: unknown; text?: unknown }[] };
    return (Array.isArray(data.nodes) ? data.nodes : [])
      .filter(n => n.type === 'text' && typeof n.text === 'string')
      .map(n => n.text as string)
      .join('\n');
  } catch {
    return '';
  }
}

/** A regex for every occurrence of `needle`: literal, case-insensitive unless matchCase, whole words only with wholeWord. */
export function searchPattern(needle: string, opts: SearchOptions = {}): RegExp {
  const literal = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const body = opts.wholeWord ? `(?<![\\p{L}\\p{N}_])${literal}(?![\\p{L}\\p{N}_])` : literal;
  return new RegExp(body, opts.matchCase ? 'gu' : 'giu');
}

/**
 * A matching line for display: trimmed, and when longer than `max`, cut to a
 * `max`-character window around the match with "…" on each cut end.
 */
export function clipLine(line: string, needle: string, max = SEARCH_LINE_CHARS): string {
  const text = line.trim();
  if (text.length <= max) return text;
  const at = Math.max(0, text.toLowerCase().indexOf(needle.toLowerCase()));
  const start = Math.max(0, Math.min(at - Math.floor((max - needle.length) / 2), text.length - max));
  const end = start + max;
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

/**
 * How often a note contains `needle` (literal; case-insensitive unless
 * matchCase; whole words only with wholeWord), with its first matching lines,
 * or null when it doesn't contain it.
 */
export function matchNote(content: string, needle: string, opts: SearchOptions = {}, maxLines = SEARCH_MAX_LINES): Omit<SearchNoteMatch, 'path'> | null {
  if (!needle) return null;
  const pattern = searchPattern(needle, opts);
  const lines: SearchLine[] = [];
  let matchingLines = 0;
  let matches = 0;
  content.split(/\r?\n/).forEach((line, i) => {
    const found = line.match(pattern)?.length ?? 0;
    if (!found) return;
    matches += found;
    matchingLines++;
    if (lines.length < maxLines) lines.push({ line: i + 1, text: clipLine(line, needle) });
  });
  return matches ? { matches, matchingLines, lines } : null;
}

/**
 * Search notes for `text`: the matching notes inside `folder` in path order, the
 * first `maxNotes` of them with their counts and lines, totals over every
 * matching note, and a "more notes" line for the rest so the agent can narrow
 * the search.
 */
export function searchNotes(
  notes: { path: string; content: string }[],
  text: string,
  folder?: string,
  maxNotes = SEARCH_MAX_NOTES,
  opts: SearchOptions = {},
): SearchResult {
  const matches: SearchNoteMatch[] = [];
  for (const note of [...notes].sort((a, b) => a.path.localeCompare(b.path))) {
    if (!inFolder(note.path, folder)) continue;
    const m = matchNote(note.content, text, opts);
    if (m) matches.push({ path: note.path, ...m });
  }
  const result: SearchResult = {
    text,
    totalMatches: matches.reduce((n, m) => n + m.matches, 0),
    totalNotes: matches.length,
    notes: matches.slice(0, maxNotes),
  };
  if (folderPrefix(folder)) result.folder = folder;
  if (opts.wholeWord) result.wholeWord = true;
  if (opts.matchCase) result.matchCase = true;
  const rest = matches.length - maxNotes;
  if (rest > 0) {
    result.more = `…and ${rest} more note${rest === 1 ? '' : 's'}. Narrow the search with more specific text or a folder.`;
  }
  return result;
}

/** Most follow-up turns that answer inject queries, per user message: enough for a
 *  query that leads to another, and a stop for an agent that keeps asking. */
export const MAX_QUERY_ROUNDS = 3;

/**
 * What to do with the queries a turn ended with. `round` is how many query
 * follow-ups came before this turn (0 for the turn the user's message started).
 * Show queries always get their card; inject queries get a follow-up turn until
 * MAX_QUERY_ROUNDS, then `limitHit`, and the agent is told they weren't run.
 */
export function queryFollowUp(round: number, queries: readonly VaultQuery[]): { show: VaultQuery[]; inject: VaultQuery[]; limitHit: boolean } {
  const show = queries.filter(q => q.mode === 'show');
  const asked = queries.filter(q => q.mode === 'inject');
  if (round >= MAX_QUERY_ROUNDS) return { show, inject: [], limitHit: asked.length > 0 };
  return { show, inject: asked, limitHit: false };
}

/** The note for the agent when its queries weren't run because of MAX_QUERY_ROUNDS. */
export function queryLimitNote(brand: string): string {
  return `[System: ${brand} didn't run the vault queries in your last reply: one message allows ${MAX_QUERY_ROUNDS} rounds of query follow-ups. Answer with what you already have, or ask the user whether to continue.]`;
}

/** "12 matches in 3 notes" for a search card, or null for results saved before counts existed. */
export function searchSummary(r: Partial<Pick<SearchResult, 'totalMatches' | 'totalNotes'>>): string | null {
  if (typeof r.totalMatches !== 'number' || typeof r.totalNotes !== 'number') return null;
  const m = r.totalMatches, n = r.totalNotes;
  return `${m} match${m === 1 ? '' : 'es'} in ${n} note${n === 1 ? '' : 's'}`;
}

/** Build a human-readable label for display in the UI. */
export function queryLabel(query: VaultQuery): string {
  const scope = query.folder ? ` in "${query.folder}"` : '';
  switch (query.query) {
    case 'backlinks': return `Backlinks for "${query.path}"`;
    case 'outlinks': return `Outlinks for "${query.path}"`;
    case 'tags': return query.path ? `Tags on "${query.path}"` : `Files tagged #${query.tag}`;
    case 'file-list': {
      const when = query.modifiedSince !== undefined ? `, changed since ${query.modifiedSince}` : query.sort === 'modified' ? ', newest first' : '';
      if (query.name) return `Files named "${query.name}"${scope || ' in vault'}${when}`;
      return query.depth !== undefined && !when ? `Vault tree (${query.depth} levels)${scope}` : `Files${scope || ' in vault'}${when}`;
    }
    case 'search': {
      const how = [query.wholeWord ? 'whole word' : '', query.matchCase ? 'match case' : ''].filter(Boolean).join(', ');
      return `Search for "${query.text ?? ''}"${scope}${how ? ` (${how})` : ''}`;
    }
    case 'help': return `Reference: ${query.topic ?? 'unknown'}`;
    default: return query.query;
  }
}

/** Serialize results for injection back to the agent as a structured message. */
export function buildInjectMessage(results: VaultQueryResult[]): string {
  const parts = results.map(r => {
    const label = queryLabel(r.query);
    const body = r.error
      ? `Error: ${r.error}`
      : typeof r.result === 'string'
        ? r.result
        : JSON.stringify(r.result, null, 2);
    // Every result but help is vault-derived — file and folder names, and for
    // search the text of notes — untrusted content a malicious or planted file
    // could craft to look like a live @@BOJU line. Neutralize it like every other
    // vault-content injection path. Help topics return BojuBot's own static
    // reference docs, which legitimately contain @@BOJU examples, so they're left untouched.
    const safeBody = r.query.query === 'help' ? body : neutralizeTriggers(body);
    return `Query: ${label}\nResult:\n${safeBody}`;
  });
  return `[BOJU_VAULT_RESPONSE]\n${parts.join('\n\n')}\n[/BOJU_VAULT_RESPONSE]`;
}

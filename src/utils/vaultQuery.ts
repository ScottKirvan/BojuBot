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
  /** For search: the text to find inside notes (case-insensitive, literal). */
  text?: string;
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
  /** The first SEARCH_MAX_LINES matching lines. */
  lines: SearchLine[];
  /** How many lines of the note match in all. */
  matchingLines: number;
}

export interface SearchResult {
  text: string;
  folder?: string;
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

/** The lines of a note that contain `needle` (case-insensitive, literal), or null when none do. */
export function matchNote(content: string, needle: string, maxLines = SEARCH_MAX_LINES): Omit<SearchNoteMatch, 'path'> | null {
  const lower = needle.toLowerCase();
  if (!lower) return null;
  const lines: SearchLine[] = [];
  let matchingLines = 0;
  content.split(/\r?\n/).forEach((line, i) => {
    if (!line.toLowerCase().includes(lower)) return;
    matchingLines++;
    if (lines.length < maxLines) lines.push({ line: i + 1, text: clipLine(line, needle) });
  });
  return matchingLines ? { lines, matchingLines } : null;
}

/**
 * Search notes for `text`: the matching notes inside `folder` in path order, the
 * first `maxNotes` of them with their lines, and a "more notes" line for the rest
 * so the agent can narrow the search.
 */
export function searchNotes(
  notes: { path: string; content: string }[],
  text: string,
  folder?: string,
  maxNotes = SEARCH_MAX_NOTES,
): SearchResult {
  const matches: SearchNoteMatch[] = [];
  for (const note of [...notes].sort((a, b) => a.path.localeCompare(b.path))) {
    if (!inFolder(note.path, folder)) continue;
    const m = matchNote(note.content, text);
    if (m) matches.push({ path: note.path, ...m });
  }
  const result: SearchResult = { text, notes: matches.slice(0, maxNotes) };
  if (folderPrefix(folder)) result.folder = folder;
  const rest = matches.length - maxNotes;
  if (rest > 0) {
    result.more = `…and ${rest} more note${rest === 1 ? '' : 's'}. Narrow the search with more specific text or a folder.`;
  }
  return result;
}

/** Build a human-readable label for display in the UI. */
export function queryLabel(query: VaultQuery): string {
  const scope = query.folder ? ` in "${query.folder}"` : '';
  switch (query.query) {
    case 'backlinks': return `Backlinks for "${query.path}"`;
    case 'outlinks': return `Outlinks for "${query.path}"`;
    case 'tags': return query.path ? `Tags on "${query.path}"` : `Files tagged #${query.tag}`;
    case 'file-list': {
      if (query.name) return `Files named "${query.name}"${scope || ' in vault'}`;
      return query.depth !== undefined ? `Vault tree (${query.depth} levels)${scope}` : `Files${scope || ' in vault'}`;
    }
    case 'search': return `Search for "${query.text ?? ''}"${scope}`;
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

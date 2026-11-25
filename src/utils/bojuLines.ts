import { BOJU_PREFIX } from '../constants';

export interface BojuLine {
  kind: 'action' | 'query';
  /** The full original line, prefix included. */
  line: string;
}

/**
 * Fenced code block state carried from line to line: the open fence's marker
 * (e.g. "```" or "~~~~"), or null outside a code block.
 *
 * A @@BOJU line inside a code block is something the agent is *showing*
 * (quoting a note, explaining the protocol), never a request: it's kept as
 * text and never parsed. Every place that finds protocol lines goes through
 * fencedLines() so they all agree on what's fenced.
 */
export type FenceState = string | null;

/** A mutable fence state, for text that arrives in pieces (one message's text blocks). */
export interface FenceTracker {
  open: FenceState;
}

const FENCE_LINE = /^\s*(`{3,}|~{3,})(.*)$/;

/**
 * The fence state after `line`. A fence is ``` or ~~~ (three or more) at the
 * start of a line, leading whitespace allowed. It's closed by a line of the
 * same character, at least as long, with nothing after it. A backtick fence's
 * info string can't contain a backtick ("```x```" is inline code, not a fence).
 */
export function nextFenceState(state: FenceState, line: string): FenceState {
  const m = FENCE_LINE.exec(line);
  if (!m) return state;
  const marker = m[1];
  const rest = m[2];
  if (state === null) {
    if (marker.startsWith('`') && rest.includes('`')) return null;
    return marker;
  }
  if (marker[0] === state[0] && marker.length >= state.length && !rest.trim()) return null;
  return state;
}

/**
 * Each line of `text` with whether it's inside a fenced code block (fence
 * lines themselves count as inside). An unclosed fence runs to the end.
 * Updates `tracker` to the state after the last line, so passing the same
 * tracker for the next piece of the same text continues it.
 */
export function fencedLines(text: string, tracker: FenceTracker = { open: null }): Array<{ line: string; fenced: boolean }> {
  const out: Array<{ line: string; fenced: boolean }> = [];
  for (const line of text.split('\n')) {
    const before = tracker.open;
    tracker.open = nextFenceState(before, line);
    out.push({ line, fenced: before !== null || tracker.open !== null });
  }
  return out;
}

/**
 * Parse one line as a protocol line: null when it doesn't start with the
 * prefix, 'malformed' when what follows isn't a JSON object, else the object.
 * Says nothing about fences: callers check that first (fencedLines()).
 */
export function parseBojuLine(line: string): Record<string, unknown> | 'malformed' | null {
  if (!line.startsWith(BOJU_PREFIX)) return null;
  try {
    const parsed: unknown = JSON.parse(line.slice(BOJU_PREFIX.length));
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : 'malformed';
  } catch {
    return 'malformed';
  }
}

/** The parsed protocol lines of `text` outside code blocks, in order (malformed ones skipped). */
export function liveBojuObjects(text: string): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const { line, fenced } of fencedLines(text)) {
    if (fenced) continue;
    const parsed = parseBojuLine(line);
    if (parsed && parsed !== 'malformed') out.push(parsed);
  }
  return out;
}

/**
 * Split a completed block of model text into displayable text and @@BOJU
 * protocol lines, in their original order. Shared by every backend so the
 * protocol is parsed the same way whatever CLI produced the text.
 *
 * - A prefixed line whose JSON has an `action` key is an action, a `query` key a query.
 * - A prefixed line with valid JSON but neither key is dropped.
 * - A prefixed line that isn't a JSON object stays in the text.
 * - A prefixed line inside a fenced code block stays in the text, unparsed.
 *
 * Pass the same `fence` tracker for every text block of one message, so a
 * fence opened in one block is still open in the next.
 */
export function splitBojuLines(raw: string, fence: FenceTracker = { open: null }): { clean: string; lines: BojuLine[] } {
  const textLines: string[] = [];
  const lines: BojuLine[] = [];
  for (const { line, fenced } of fencedLines(raw, fence)) {
    const parsed = fenced ? null : parseBojuLine(line);
    if (parsed === null || parsed === 'malformed') {
      textLines.push(line);
      continue;
    }
    if ('action' in parsed) lines.push({ kind: 'action', line });
    else if ('query' in parsed) lines.push({ kind: 'query', line });
  }
  return { clean: textLines.join('\n'), lines };
}

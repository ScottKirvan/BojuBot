import { BOJU_PREFIX } from '../constants';

export interface BojuLine {
  kind: 'action' | 'query';
  /** The full original line, prefix included. */
  line: string;
}

/**
 * Split a completed block of model text into displayable text and @@BOJU
 * protocol lines, in their original order. Shared by every backend so the
 * protocol is parsed the same way whatever CLI produced the text.
 *
 * - A prefixed line whose JSON has an `action` key is an action, a `query` key a query.
 * - A prefixed line with valid JSON but neither key is dropped.
 * - A prefixed line that isn't a JSON object stays in the text.
 */
export function splitBojuLines(raw: string): { clean: string; lines: BojuLine[] } {
  const textLines: string[] = [];
  const lines: BojuLine[] = [];
  for (const line of raw.split('\n')) {
    if (!line.startsWith(BOJU_PREFIX)) {
      textLines.push(line);
      continue;
    }
    try {
      const parsed = JSON.parse(line.slice(BOJU_PREFIX.length)) as Record<string, unknown>;
      if ('action' in parsed) lines.push({ kind: 'action', line });
      else if ('query' in parsed) lines.push({ kind: 'query', line });
    } catch {
      textLines.push(line);
    }
  }
  return { clean: textLines.join('\n'), lines };
}

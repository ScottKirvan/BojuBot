/**
 * Pure helper for ↑/↓ in the chat input: recall a sent message, or let the
 * browser move the cursor. No Obsidian API dependency — safe to import in unit tests.
 *
 * The rule works on character offsets, never on line breaks, so wrapped text
 * (one long line shown over several rows) navigates row by row like multi-line text:
 * - ↑ recalls only when the cursor sits at the very start with no selection
 *   (always true for an empty input) and there is history to recall.
 * - ↓ steps forward only while browsing history and with the cursor at the very
 *   end with no selection.
 * - While browsing an entry the user hasn't edited, both keys always step, like a
 *   terminal: changing direction doesn't need an extra press to reach the start/end.
 * Everywhere else the key moves the cursor. On the top row the browser moves the
 * cursor to the start, so one more ↑ then recalls; the bottom row and ↓ likewise.
 */

export type HistoryKey = 'ArrowUp' | 'ArrowDown';

export interface HistoryKeyState {
  /** Length of the input's current text. */
  length: number;
  selectionStart: number;
  selectionEnd: number;
  /** True once ↑ has recalled an entry and the draft is stashed. */
  browsing: boolean;
  /** True when at least one sent message can be recalled. */
  hasHistory: boolean;
  /** While browsing: the input still holds the recalled entry exactly as recalled. */
  unedited?: boolean;
}

/** 'step' = handle the key as history navigation; 'move' = leave it to the browser. */
export type HistoryKeyAction = 'step' | 'move';

export function historyKeyAction(key: HistoryKey, state: HistoryKeyState): HistoryKeyAction {
  const { length, selectionStart, selectionEnd, browsing, hasHistory, unedited } = state;
  if (browsing && unedited) return 'step';
  if (selectionStart !== selectionEnd) return 'move';
  if (key === 'ArrowUp') {
    return hasHistory && selectionStart === 0 ? 'step' : 'move';
  }
  return browsing && selectionEnd >= length ? 'step' : 'move';
}

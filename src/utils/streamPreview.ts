/**
 * Pure helpers for live (token-by-token) reply previews.
 * No Obsidian API dependency — safe to import in unit tests.
 *
 * With `--include-partial-messages`, the CLI streams text deltas before each
 * complete `assistant` message. The deltas are display-only: the complete
 * message stays the single source of truth for text, UI bridge actions and
 * queries. These helpers make sure protocol lines never flash on screen while
 * a block is still streaming.
 */

import { BOJU_PREFIX } from '../constants';

/**
 * The displayable part of an in-progress text block: complete lines starting
 * with the protocol prefix are dropped, and a trailing partial line that is (or
 * could still become) a protocol line is held back until it's complete.
 */
export function previewForDisplay(blockText: string, prefix: string = BOJU_PREFIX): string {
  if (!blockText) return '';
  const lines = blockText.split('\n');
  const tail = lines.pop() ?? '';
  const kept = lines.filter(line => !line.startsWith(prefix));
  const tailIsProtocol = tail.startsWith(prefix) || prefix.startsWith(tail);
  const shownTail = tailIsProtocol ? '' : tail;
  return kept.length ? `${kept.join('\n')}\n${shownTail}` : shownTail;
}

/** What the chat shows mid-turn: committed (complete-message) text plus the filtered live preview. */
export function composeStreamingText(committed: string, preview: string): string {
  return committed + previewForDisplay(preview);
}

import type { PermissionMode } from '../backends/types';

/**
 * Notes BojuBot queues for the agent when something changes mid-session (#459).
 * They go out together with the user's next message, in the order queued,
 * inside one `<bojubot-context type="system-message">` block.
 *
 * - Notes of different kinds accumulate.
 * - A note of a kind already queued replaces the queued one, which moves to
 *   the end (it's the latest change).
 * - Two mode changes become one note from the first change's "before" mode to
 *   the latest mode; back where it started, the mode note is dropped.
 * - `refresh` re-sends the full current state, so it replaces everything
 *   queued before it. Notes queued after it append as usual.
 */
export type SystemNoteKind = 'mode' | 'allowlist' | 'refresh';

export type SystemNoteInput =
  | {
    kind: 'mode';
    from: PermissionMode;
    to: PermissionMode;
    /** The note's text for a change from `from` to this note's `to`. Called
     *  with the first queued change's `from` when two mode changes combine. */
    describe: (from: PermissionMode) => string;
  }
  | { kind: 'allowlist' | 'refresh'; text: string };

export interface QueuedSystemNote {
  kind: SystemNoteKind;
  text: string;
  /** Mode notes: the mode before the first change queued. */
  from?: PermissionMode;
}

/** The queue with `note` added. Never changes `queue`. */
export function queueSystemNote(queue: readonly QueuedSystemNote[], note: SystemNoteInput): QueuedSystemNote[] {
  if (note.kind !== 'mode') {
    if (note.kind === 'refresh') return [{ kind: 'refresh', text: note.text }];
    return [...queue.filter(n => n.kind !== note.kind), { kind: note.kind, text: note.text }];
  }
  const previous = queue.find(n => n.kind === 'mode');
  const rest = queue.filter(n => n.kind !== 'mode');
  const from = previous?.from ?? note.from;
  if (from === note.to) return rest;
  return [...rest, { kind: 'mode', text: note.describe(from), from }];
}

/** The queued notes as one text, in order, or null when none are queued. */
export function joinSystemNotes(queue: readonly QueuedSystemNote[]): string | null {
  return queue.length === 0 ? null : queue.map(n => n.text).join('\n\n');
}

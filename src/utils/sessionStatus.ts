/**
 * Live status of the session in a chat panel (#399), shown as a dot in the
 * Sessions panel and on the chat tab. Pure, so the transitions are unit-tested.
 */

export type SessionStatus = 'idle' | 'running' | 'waiting' | 'finished' | 'error';

export interface StatusState {
  /** What the last turn did. */
  base: 'idle' | 'running' | 'finished' | 'error';
  /** Dialogs open that need the user (permission request, command confirmation). */
  waiting: number;
  /** A denial card is offering a choice. */
  denial: boolean;
}

export const IDLE_STATUS: StatusState = { base: 'idle', waiting: 0, denial: false };

export type StatusEvent =
  /** A turn's process started. */
  | { type: 'turn-start' }
  /** A turn ended. `visible`: the panel was on screen; `error`: it failed. */
  | { type: 'turn-end'; visible: boolean; error?: boolean }
  /** A dialog that needs the user opened / closed. */
  | { type: 'wait-start' }
  | { type: 'wait-end' }
  /** A denial card appeared / was answered or dismissed. */
  | { type: 'denial-shown' }
  | { type: 'denial-resolved' }
  /** The panel is on screen: a finished reply or error has been seen. */
  | { type: 'viewed' }
  /** The panel switched to another session. */
  | { type: 'reset' };

export function nextStatus(s: StatusState, e: StatusEvent): StatusState {
  switch (e.type) {
    case 'turn-start':
      // A new turn answers any denial card that was waiting
      return { ...s, base: 'running', denial: false };
    case 'turn-end':
      // Seen as it happened: nothing left to flag
      if (e.visible) return { ...s, base: 'idle' };
      return { ...s, base: e.error ? 'error' : 'finished' };
    case 'wait-start':
      return { ...s, waiting: s.waiting + 1 };
    case 'wait-end':
      return { ...s, waiting: Math.max(0, s.waiting - 1) };
    case 'denial-shown':
      return { ...s, denial: true };
    case 'denial-resolved':
      return { ...s, denial: false };
    case 'viewed':
      return s.base === 'finished' || s.base === 'error' ? { ...s, base: 'idle' } : s;
    case 'reset':
      return { ...s, base: s.base === 'running' ? 'running' : 'idle', denial: false };
  }
}

/** What to show: anything waiting for the user wins over the turn's own state. */
export function displayStatus(s: StatusState): SessionStatus {
  if (s.waiting > 0 || s.denial) return 'waiting';
  return s.base;
}

export const STATUS_LABELS: Record<SessionStatus, string> = {
  idle: '',
  running: 'Replying…',
  waiting: 'Waiting for you',
  finished: 'Finished',
  error: 'Stopped with an error',
};

/**
 * The notice to show when a session's status changes, or null. Only for a
 * session that isn't on screen, and only when it finishes, fails or needs the
 * user.
 */
export function statusNotice(prev: SessionStatus, next: SessionStatus, visible: boolean, title: string): string | null {
  if (visible || prev === next) return null;
  switch (next) {
    case 'waiting': return `${title} is waiting for you`;
    case 'finished': return `${title} finished`;
    case 'error': return `${title} stopped with an error`;
    default: return null;
  }
}

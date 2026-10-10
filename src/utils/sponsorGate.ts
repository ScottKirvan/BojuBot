/**
 * Decides whether the welcome screen swaps to the sponsorship message.
 * No Obsidian API dependency — safe to import in unit tests.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Eligible on every Nth new-session creation. */
export const SPONSOR_MESSAGE_INTERVAL = 10;
/** Window for the "uses the plugin regularly" check. */
export const SPONSOR_ACTIVITY_WINDOW_MS = 30 * DAY_MS;
/** Other sessions that must be active within the window. Without this, a user
 *  returning after months away qualifies again on their second session back. */
export const SPONSOR_MIN_RECENT_SESSIONS = 3;
/** Minimum gap between showings, so a heavy user creating many sessions a day
 *  doesn't see it every day. */
export const SPONSOR_COOLDOWN_MS = 30 * DAY_MS;

export interface SponsorGateInput {
  whiteLabeled: boolean;
  optedOut: boolean;
  sessionCreationCount: number;
  /** updatedAt timestamps (ms) of saved sessions, excluding the current one. */
  otherSessionUpdatedAt: number[];
  /** When the message was last shown (ms), or 0 if never. */
  lastShownAt: number;
  now: number;
}

export function shouldShowSponsorMessage(input: SponsorGateInput): boolean {
  if (input.whiteLabeled || input.optedOut) return false;
  if (input.sessionCreationCount <= 0) return false;
  if (input.sessionCreationCount % SPONSOR_MESSAGE_INTERVAL !== 0) return false;
  if (input.lastShownAt > 0 && input.now - input.lastShownAt < SPONSOR_COOLDOWN_MS) return false;
  const recent = input.otherSessionUpdatedAt
    .filter(t => input.now - t <= SPONSOR_ACTIVITY_WINDOW_MS)
    .length;
  return recent >= SPONSOR_MIN_RECENT_SESSIONS;
}

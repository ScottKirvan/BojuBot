/**
 * Decides whether the welcome screen swaps to the sponsorship message.
 * No Obsidian API dependency — safe to import in unit tests.
 *
 * The message appears at milestones of *started* sessions (ones that got at
 * least one reply from the agent), each milestone once: 10, 20, 30, 50, then
 * every 50th. Clicking + without sending anything never counts.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Milestones before the steady cadence starts. */
export const SPONSOR_EARLY_MILESTONES: readonly number[] = [10, 20, 30, 50];
/** After the early milestones, every Nth started session. */
export const SPONSOR_MILESTONE_STEP = 50;
/** Window for the "uses the plugin regularly" check. */
export const SPONSOR_ACTIVITY_WINDOW_MS = 30 * DAY_MS;
/** Other started sessions that must be active within the window. Without this,
 *  a user returning after months away qualifies on their first session back. */
export const SPONSOR_MIN_RECENT_SESSIONS = 3;
/** Minimum gap between showings, so a burst of sessions can't show it twice in a day. */
export const SPONSOR_MIN_GAP_MS = DAY_MS;

/** The first milestone above `after`. */
export function nextSponsorMilestone(after: number): number {
  const early = SPONSOR_EARLY_MILESTONES.find(m => m > after);
  if (early !== undefined) return early;
  return (Math.floor(after / SPONSOR_MILESTONE_STEP) + 1) * SPONSOR_MILESTONE_STEP;
}

/**
 * The highest milestone in (lastMilestone, count], or 0 when none was reached.
 * A count that jumped past several milestones yields only the highest, so the
 * message shows once rather than once per skipped milestone.
 */
export function reachedSponsorMilestone(count: number, lastMilestone: number): number {
  let reached = 0;
  for (let m = nextSponsorMilestone(lastMilestone); m <= count; m = nextSponsorMilestone(m)) reached = m;
  return reached;
}

/**
 * Sponsorship progress for an install that predates started-session counting:
 * the count comes from its saved sessions that have a conversation, and every
 * milestone already passed counts as shown, so upgrading never triggers an
 * immediate catch-up ask.
 */
export function seedSponsorProgress(startedSessions: number): { startedSessionCount: number; lastSponsorMilestone: number } {
  const count = Math.max(0, Math.floor(startedSessions));
  return { startedSessionCount: count, lastSponsorMilestone: reachedSponsorMilestone(count, 0) };
}

export interface SponsorGateInput {
  whiteLabeled: boolean;
  optedOut: boolean;
  /** Sessions that got at least one reply from the agent. */
  startedSessionCount: number;
  /** The milestone the message was last shown for, or 0 if never. */
  lastMilestone: number;
  /** updatedAt timestamps (ms) of other *started* sessions. */
  otherStartedSessionUpdatedAt: number[];
  /** When the message was last shown (ms), or 0 if never. */
  lastShownAt: number;
  now: number;
}

/** The milestone to show the message for (record it as shown), or 0 to show nothing. */
export function sponsorMilestoneToShow(input: SponsorGateInput): number {
  if (input.whiteLabeled || input.optedOut) return 0;
  const milestone = reachedSponsorMilestone(input.startedSessionCount, input.lastMilestone);
  if (!milestone) return 0;
  if (input.lastShownAt > 0 && input.now - input.lastShownAt < SPONSOR_MIN_GAP_MS) return 0;
  const recent = input.otherStartedSessionUpdatedAt
    .filter(t => input.now - t <= SPONSOR_ACTIVITY_WINDOW_MS)
    .length;
  return recent >= SPONSOR_MIN_RECENT_SESSIONS ? milestone : 0;
}

/** Rolling speed of the credits, in pixels per second. */
export const CREDITS_ROLL_SPEED = 30;
/** How long the credits take to fade out once the last line is in place. */
export const CREDITS_FADE_MS = 2000;
/** Where the last line stops before the fade: this far down the viewport. */
export const CREDITS_END_AT = 0.5;

export interface CreditsTimeline {
  /** translateY at the start: the list sits just below the viewport. */
  fromPx: number;
  /** translateY at the end: the last line has reached the middle of the viewport. */
  toPx: number;
  /** Total length of one loop (roll + fade), in ms. */
  totalMs: number;
  /** Fraction of the loop spent rolling; the rest is the fade. */
  rollFraction: number;
}

/**
 * One loop of the credits: roll up from below the viewport until the last line
 * reaches the middle, then fade out, then start again. The roll keeps a
 * constant speed however long the list is, and lasts at least 5 s.
 * Pure — exported for tests.
 */
export function creditsTimeline(contentHeight: number, viewportHeight: number): CreditsTimeline {
  const content = Math.max(0, contentHeight);
  const viewport = Math.max(0, viewportHeight);
  const fromPx = viewport;
  const toPx = Math.round(viewport * CREDITS_END_AT - content);
  const rollMs = Math.max(5000, Math.round(((fromPx - toPx) / CREDITS_ROLL_SPEED) * 1000));
  const totalMs = rollMs + CREDITS_FADE_MS;
  return { fromPx, toPx, totalMs, rollFraction: rollMs / totalMs };
}

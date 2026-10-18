/**
 * The thank-you card (#385): when the user thanks the agent, BojuBot shows a
 * short note in Scott's own words. The agent only detects the thank-you (the
 * `thanked` UI Bridge action); the words always come from src/thanks.json.
 * No Obsidian API dependency — safe to import in unit tests.
 */

/** Where a card's button goes. Resolved to a URL by the view. */
export type ThanksLink = 'kofi' | 'sponsors' | 'support' | 'github' | 'discord' | 'feedback';

export interface ThanksMessage {
  text: string;
  button?: { label: string; link: ThanksLink };
}

export interface ThanksMessages {
  /** Personal thank-yous: most of the time. */
  personal: ThanksMessage[];
  /** Support asks: about 1 in 4, regular users only. */
  sponsor: ThanksMessage[];
  /** Other ways to help (star, share, feedback): mixed in with the personal ones. */
  help: ThanksMessage[];
}

export type ThanksKind = 'personal' | 'sponsor' | 'help';

/** Share of cards that are a support ask, for users who qualify. */
export const THANKS_SPONSOR_SHARE = 0.25;
/** At most one card a day. */
export const THANKS_MIN_GAP_MS = 24 * 60 * 60 * 1000;

export interface ThanksCardGate {
  whiteLabeled: boolean;
  optedOut: boolean;
  /** A card was already shown in this session. */
  shownThisSession: boolean;
  /** When a card was last shown (ms), or 0 if never. */
  lastShownAt: number;
  now: number;
}

/** Whether a thank-you may show a card at all: once per session, once per day, never when opted out or white-labeled. */
export function thanksCardAllowed(g: ThanksCardGate): boolean {
  if (g.whiteLabeled || g.optedOut || g.shownThisSession) return false;
  return g.lastShownAt <= 0 || g.now - g.lastShownAt >= THANKS_MIN_GAP_MS;
}

/**
 * Pick the card's message. `rand` returns [0, 1) (Math.random in the app,
 * fixed in tests). A sponsor ask only for users who qualify; otherwise — or
 * when that list is empty — a personal thank-you or an other-ways-to-help note.
 * Returns null when there's nothing to show.
 */
export function pickThanksMessage(
  messages: ThanksMessages,
  sponsorEligible: boolean,
  rand: () => number,
): { kind: ThanksKind; message: ThanksMessage } | null {
  if (sponsorEligible && messages.sponsor.length > 0 && rand() < THANKS_SPONSOR_SHARE) {
    return { kind: 'sponsor', message: messages.sponsor[Math.floor(rand() * messages.sponsor.length)] };
  }
  const pool: Array<{ kind: ThanksKind; message: ThanksMessage }> = [
    ...messages.personal.map(message => ({ kind: 'personal' as const, message })),
    ...messages.help.map(message => ({ kind: 'help' as const, message })),
  ];
  if (pool.length === 0) return null;
  return pool[Math.floor(rand() * pool.length)];
}

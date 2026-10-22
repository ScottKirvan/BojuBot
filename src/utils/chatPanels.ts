/**
 * Pure rules for several chat panels open at once (#399): which panel a
 * command acts on, and where a session opens. Generic over the panel type so
 * they're unit-tested without Obsidian.
 */

export interface PanelInfo<T> {
  panel: T;
  /** When the panel was last active (ms); 0 = never since the plugin loaded. */
  lastActive: number;
  /** Session file open in it, if any. */
  sessionFileId?: string;
}

/**
 * The panel commands act on: the chat panel used most recently. Panels never
 * used since the plugin loaded count as oldest; ties go to the first listed
 * (Obsidian's own leaf order). Undefined when no panel is open.
 */
export function pickTargetPanel<T>(panels: PanelInfo<T>[]): T | undefined {
  let best: PanelInfo<T> | undefined;
  for (const p of panels) {
    if (!best || p.lastActive > best.lastActive) best = p;
  }
  return best?.panel;
}

/** The panel a session is open in, never counting `exclude`. */
export function panelForSession<T>(panels: PanelInfo<T>[], sessionFileId: string, exclude?: T): T | undefined {
  return panels.find(p => p.panel !== exclude && p.sessionFileId === sessionFileId)?.panel;
}

export type OpenPlan<T> =
  | { kind: 'reveal'; panel: T }
  | { kind: 'load'; panel: T }
  | { kind: 'new-tab' };

/**
 * Where to open a session. One session is never open in two panels, so a
 * session already open somewhere is revealed there. Otherwise it loads into
 * the preferred panel when that panel is free to reuse (an untouched new
 * session, nothing running, nothing typed), or opens in a new tab so the
 * preferred panel's session keeps going.
 */
export function planOpenSession<T>(opts: {
  openIn?: T;
  preferred?: T;
  preferredReusable: boolean;
  forceNewTab?: boolean;
}): OpenPlan<T> {
  if (opts.openIn !== undefined) return { kind: 'reveal', panel: opts.openIn };
  if (opts.preferred !== undefined && opts.preferredReusable && !opts.forceNewTab) return { kind: 'load', panel: opts.preferred };
  return { kind: 'new-tab' };
}

export type NewSessionPlan<T> =
  | { kind: 'reuse'; panel: T }
  | { kind: 'start'; panel: T }
  | { kind: 'new-tab' };

/**
 * Where "new session" goes. A panel with a reply still running keeps it
 * running and the new session opens in a new tab. A panel that already shows
 * an untouched new session is reused as it is (unless the new session has
 * custom settings). Otherwise the panel starts a new session.
 */
export function planNewSession<T>(opts: {
  target?: T;
  busy: boolean;
  pristine: boolean;
  forceNewTab?: boolean;
  custom?: boolean;
}): NewSessionPlan<T> {
  if (opts.target === undefined || opts.forceNewTab || opts.busy) return { kind: 'new-tab' };
  if (opts.pristine && !opts.custom) return { kind: 'reuse', panel: opts.target };
  return { kind: 'start', panel: opts.target };
}

/** Saved view state of a chat panel: which session it shows. */
export interface ChatPanelState {
  sessionFileId?: string;
  /** Open with nothing loaded (the caller starts or loads a session next). */
  blank?: boolean;
}

/** Read a chat panel's view state defensively (it comes from workspace.json). */
export function parseChatPanelState(state: unknown): ChatPanelState {
  if (!state || typeof state !== 'object') return {};
  const s = state as Record<string, unknown>;
  const out: ChatPanelState = {};
  if (typeof s.sessionFileId === 'string' && s.sessionFileId) out.sessionFileId = s.sessionFileId;
  if (s.blank === true) out.blank = true;
  return out;
}

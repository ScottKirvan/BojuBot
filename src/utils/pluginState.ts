/**
 * Runtime state BojuBot keeps as it runs, apart from the user's settings (#447).
 *
 * It lives in Obsidian's per-vault localStorage (`app.loadLocalStorage` /
 * `app.saveLocalStorage`), which stays on this computer and never syncs, so
 * `data.json` only changes when a setting does. Installs from before #447 kept
 * these fields in `data.json`; `migratePluginState()` moves them out.
 *
 * Pure: no Obsidian API here, so it's unit-testable.
 */

export interface PluginState {
  /** File ID of the session that was open when Obsidian last closed. */
  lastActiveSessionId: string;
  /** Sessions that got at least one reply from the agent. Drives the sponsorship
   *  milestones (src/utils/sponsorGate.ts). Seeded from saved sessions when missing. */
  startedSessionCount: number;
  /** The sponsorship milestone last shown (10, 20, 30, 50, then every 50th), 0 if never. */
  lastSponsorMilestone: number;
  /** When the sponsorship welcome variant was last shown (ms since epoch), 0 if never. */
  lastSponsorShownAt: number;
  /** When the thank-you card (#385) was last shown (ms since epoch), 0 if never. */
  lastThanksCardAt: number;
}

export const DEFAULT_PLUGIN_STATE: Readonly<PluginState> = Object.freeze({
  lastActiveSessionId: '',
  startedSessionCount: 0,
  lastSponsorMilestone: 0,
  lastSponsorShownAt: 0,
  lastThanksCardAt: 0,
});

export const PLUGIN_STATE_KEYS = Object.freeze(Object.keys(DEFAULT_PLUGIN_STATE)) as readonly (keyof PluginState)[];

/** The localStorage key (Obsidian scopes it to the vault). */
export const PLUGIN_STATE_STORAGE_KEY = 'bojubot-state';

/** The state fields in `value` that have the right type; everything else is dropped. */
export function readPluginState(value: unknown): Partial<PluginState> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const v = value as Record<string, unknown>;
  const out: Partial<PluginState> = {};
  if (typeof v.lastActiveSessionId === 'string') out.lastActiveSessionId = v.lastActiveSessionId;
  for (const key of ['startedSessionCount', 'lastSponsorMilestone', 'lastSponsorShownAt', 'lastThanksCardAt'] as const) {
    const n = v[key];
    if (typeof n === 'number' && Number.isFinite(n) && n >= 0) out[key] = n;
  }
  return out;
}

export interface PluginStateMigration {
  state: PluginState;
  /** `data.json` still holds state fields: remove them (`stripPluginState()`) and save it. */
  settingsHadState: boolean;
  /** No started-session count anywhere on an existing install: seed it from saved sessions. */
  needsSeed: boolean;
}

/**
 * Combine the state in localStorage (`stored`) with any left in `data.json`
 * (`savedSettings`, null on a fresh install). Per field, localStorage wins,
 * then `data.json`, then the default. A missing count needs seeding only on an
 * existing install (data.json exists) — e.g. a second computer that synced an
 * already-migrated data.json, or an install from before session counting.
 */
export function migratePluginState(stored: unknown, savedSettings: Record<string, unknown> | null): PluginStateMigration {
  const local = readPluginState(stored);
  const legacy = readPluginState(savedSettings);
  const state: PluginState = { ...DEFAULT_PLUGIN_STATE, ...legacy, ...local };
  const settingsHadState = !!savedSettings && PLUGIN_STATE_KEYS.some(k => k in savedSettings);
  const needsSeed = !!savedSettings && local.startedSessionCount === undefined && legacy.startedSessionCount === undefined;
  return { state, settingsHadState, needsSeed };
}

/** Remove every state field from a settings object (in place); true when any was there. */
export function stripPluginState(settings: object): boolean {
  const s = settings as Record<string, unknown>;
  let removed = false;
  for (const key of PLUGIN_STATE_KEYS) {
    if (key in s) {
      delete s[key];
      removed = true;
    }
  }
  return removed;
}

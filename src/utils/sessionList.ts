import { formatTokenCount } from './logger';
import type { ChatMessage, StoredSession } from './sessionStorage';
import { clipLine } from './vaultQuery';

/**
 * Pure helpers for the Sessions panel (#399): grouping, relative times,
 * filtering, reordering and the row tooltip. No Obsidian imports, so they're
 * unit-tested directly.
 */

export type SessionGroupKey = 'pinned' | 'today' | 'week' | 'older';

export interface SessionGroup<T> {
  key: SessionGroupKey;
  label: string;
  sessions: T[];
}

const GROUP_LABELS: Record<SessionGroupKey, string> = {
  pinned: 'Pinned',
  today: 'Today',
  week: 'This week',
  older: 'Older',
};

const GROUP_ORDER: SessionGroupKey[] = ['pinned', 'today', 'week', 'older'];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Which date group a session's last activity falls in: today (same local
 * calendar day as `now`), this week (the 7 days before that), or older.
 * An unparseable date counts as older.
 */
export function sessionDateGroup(updatedAt: string, now: number): Exclude<SessionGroupKey, 'pinned'> {
  const t = new Date(updatedAt).getTime();
  if (Number.isNaN(t)) return 'older';
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  if (t >= startOfToday.getTime()) return 'today';
  if (now - t < 7 * DAY_MS) return 'week';
  return 'older';
}

/**
 * Split an ordered session list into Pinned / Today / This week / Older.
 * Order inside each group is the input order (the user's drag order), and
 * empty groups are left out.
 */
export function groupSessions<T extends Pick<StoredSession, 'updatedAt' | 'pinned'>>(sessions: T[], now: number): SessionGroup<T>[] {
  const buckets: Record<SessionGroupKey, T[]> = { pinned: [], today: [], week: [], older: [] };
  for (const s of sessions) buckets[s.pinned ? 'pinned' : sessionDateGroup(s.updatedAt, now)].push(s);
  return GROUP_ORDER
    .filter(key => buckets[key].length > 0)
    .map(key => ({ key, label: GROUP_LABELS[key], sessions: buckets[key] }));
}

/** Group a single session would be listed under. */
export function sessionGroupKey(session: Pick<StoredSession, 'updatedAt' | 'pinned'>, now: number): SessionGroupKey {
  return session.pinned ? 'pinned' : sessionDateGroup(session.updatedAt, now);
}

/**
 * Short "last active" text: "just now", "5m ago", "3h ago", "yesterday",
 * "4d ago", then a short date ("Mar 4").
 */
export function relativeTime(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.floor((now - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Sessions whose title contains the query (case-insensitive). An empty query keeps all. */
export function filterSessions<T extends Pick<StoredSession, 'title'>>(sessions: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return sessions;
  return sessions.filter(s => s.title.toLowerCase().includes(q));
}

/**
 * Move `fromId` to just before (or after) `toId`. Returns a new array; the
 * input is unchanged when either ID is missing or they're the same.
 */
export function moveSession<T extends { id: string }>(sessions: T[], fromId: string, toId: string, before: boolean): T[] {
  if (fromId === toId) return sessions;
  const fromIdx = sessions.findIndex(s => s.id === fromId);
  if (fromIdx === -1 || sessions.findIndex(s => s.id === toId) === -1) return sessions;
  const reordered = [...sessions];
  const [moved] = reordered.splice(fromIdx, 1);
  const toIdx = reordered.findIndex(s => s.id === toId);
  reordered.splice(before ? toIdx : toIdx + 1, 0, moved);
  return reordered;
}

/** "Claude Code · Sonnet 4.5", or "Antigravity · default model" when the CLI picks. */
export function agentModelLabel(agent: string, model: string | undefined): string {
  return model ? `${agent} · ${model}` : `${agent} · default model`;
}

/** Whether a session's conversation can be shown here. */
export type SessionHistoryState = 'new' | 'local' | 'remote';

export interface SessionTooltipInput {
  title: string;
  /** Full date and time, already formatted for display. */
  lastActive: string;
  state: SessionHistoryState;
  /** Estimated tokens in the saved history; omitted when there's none to count. */
  tokens?: number;
  /** Estimated context a brand-new session would start with, under current settings. */
  contextTokens?: number;
}

/** The hover text for a Sessions panel row: what moved off the row to keep it short. */
export function sessionTooltip(input: SessionTooltipInput): string {
  const lines = [input.title, `Last active ${input.lastActive}`];
  if (input.state === 'new') lines.push('New: no messages yet');
  else if (input.state === 'remote') lines.push("Remote: this session's history isn't on this machine");
  if (input.tokens !== undefined) {
    const ctx = input.contextTokens && input.contextTokens > 0
      ? ` (+${formatTokenCount(input.contextTokens)} context a new session would start with)`
      : '';
    lines.push(`About ${formatTokenCount(input.tokens)} tokens of saved history${ctx}`);
  }
  return lines.join('\n');
}

/** Fields the user sets from the Sessions panel or the UI Bridge, which the
 *  session's own record (rebuilt on every turn) doesn't carry. */
const USER_FIELDS = ['sortOrder', 'pinned', 'userLabel', 'assistantLabel'] as const;

/**
 * Carry the user's own fields (drag order, pin, name labels) from the record
 * on disk into a freshly rebuilt one, so saving a finished turn doesn't drop
 * them. Fields already set on `next` win.
 */
export function preserveUserFields(next: StoredSession, existing: StoredSession | undefined): StoredSession {
  if (!existing) return next;
  const merged: StoredSession = { ...next };
  for (const key of USER_FIELDS) {
    if (merged[key] === undefined && existing[key] !== undefined) {
      (merged as unknown as Record<string, unknown>)[key] = existing[key];
    }
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Searching inside sessions (#133)
// ---------------------------------------------------------------------------

/** Shortest query that also searches inside conversations (titles match from one character). */
export const CONTENT_SEARCH_MIN_CHARS = 2;

/** A message as the content search sees it. `compacted`: it's from before the
 *  conversation's last compaction, so the agent no longer has it in context. */
export interface SearchableMessage {
  role: 'user' | 'assistant';
  text: string;
  compacted: boolean;
}

/** The messages to search, with each one before the last compaction marked. */
export function searchableMessages(messages: readonly ChatMessage[]): SearchableMessage[] {
  let lastSeparator = -1;
  messages.forEach((m, i) => { if (m.role === 'separator') lastSeparator = i; });
  const out: SearchableMessage[] = [];
  messages.forEach((m, i) => {
    if (m.role === 'separator' || !m.content.trim()) return;
    out.push({ role: m.role, text: m.content, compacted: i < lastSeparator });
  });
  return out;
}

export interface SessionContentMatch {
  /** The matching line, clipped around the match. */
  snippet: string;
  /** Who wrote the message the snippet is from. */
  role: 'user' | 'assistant';
  /** How many messages contain the query. */
  messages: number;
  /** Every match is from before the last compaction: the agent no longer has it in context. */
  compacted: boolean;
}

/**
 * Where `query` appears in a session's messages (case-insensitive, literal), or
 * null. The snippet comes from the latest match the agent still has in context,
 * else the latest compacted one.
 */
export function matchSessionContent(messages: readonly SearchableMessage[], query: string): SessionContentMatch | null {
  const q = query.trim();
  if (q.length < CONTENT_SEARCH_MIN_CHARS) return null;
  const lower = q.toLowerCase();
  const hits = messages.filter(m => m.text.toLowerCase().includes(lower));
  if (hits.length === 0) return null;
  const live = hits.filter(m => !m.compacted);
  const shown = (live.length ? live : hits)[(live.length ? live : hits).length - 1];
  const line = shown.text.split(/\r?\n/).find(l => l.toLowerCase().includes(lower)) ?? shown.text;
  return { snippet: clipLine(line, q, 120), role: shown.role, messages: hits.length, compacted: live.length === 0 };
}

export interface SessionSearchResult<T> {
  /** Sessions whose title matches, in their order. */
  byTitle: T[];
  /** Other sessions whose messages match, in their order. */
  byContent: { session: T; match: SessionContentMatch }[];
}

/** Split a search into title matches first, then sessions that only match inside their messages. */
export function searchSessions<T extends Pick<StoredSession, 'title'>>(
  sessions: T[],
  query: string,
  contentMatch: (session: T) => SessionContentMatch | null,
): SessionSearchResult<T> {
  const byTitle = filterSessions(sessions, query);
  if (query.trim().length < CONTENT_SEARCH_MIN_CHARS) return { byTitle, byContent: [] };
  const titled = new Set(byTitle);
  const byContent: { session: T; match: SessionContentMatch }[] = [];
  for (const session of sessions) {
    if (titled.has(session)) continue;
    const match = contentMatch(session);
    if (match) byContent.push({ session, match });
  }
  return { byTitle, byContent };
}

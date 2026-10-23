import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync, appendFileSync } from 'fs';
import { join, isAbsolute } from 'path';
import { homedir } from 'os';
import { estimateTokens } from './logger';
import type { BackendId, PermissionMode } from '../backends/types';
import { getBackend } from '../backends';

export interface StoredSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  /** The CLI's conversation ID (kept under this name for every backend). '' until the first turn. */
  claudeSessionId: string;
  /** Agent CLI the session is bound to. Absent = Claude Code (every session from before backends existed). */
  backend?: BackendId;
  sortOrder?: number;
  userLabel?: string;
  assistantLabel?: string;
  cwd?: string;
  suppressVaultContext?: boolean;
  /** The session's own permission mode. Every new session saves the mode it starts
   *  in; sessions from before this field existed (undefined) open as Standard, and
   *  that is saved when they're opened. Never taken from the global default. */
  permissionMode?: PermissionMode;
  /** Per-session model override, set via Custom Session. Undefined = use the global default. */
  model?: string;
  /** Per-session `--effort` level, set via Custom Session. Undefined = use the global default. */
  effort?: string;
  /** Skips all BojuBot context injection (orientation, vault tree, context file, UI Bridge)
   *  for a bare Claude Code experience — the per-session equivalent of global Minimal mode. */
  rawSession?: boolean;
}

export function sessionBackend(session: Pick<StoredSession, 'backend'>): BackendId {
  return session.backend ?? 'claude-code';
}

type HistorySession = Pick<StoredSession, 'id' | 'backend' | 'claudeSessionId'>;

/**
 * True when the session's history can be shown: the CLI's own history file is on
 * this machine (Claude Code), or BojuBot's transcript of it exists (backends
 * whose history BojuBot can't read).
 */
export function hasReadableHistory(session: HistorySession, sessionsDir: string): boolean {
  if (!session.claudeSessionId) return false;
  if (getBackend(sessionBackend(session)).readableHistory) return canResumeLocally(session.claudeSessionId);
  return existsSync(transcriptPath(sessionsDir, session.id));
}

/** The session's messages for display, from whichever source hasReadableHistory() checks. */
export function loadHistory(session: HistorySession, sessionsDir: string): ChatMessage[] {
  if (!session.claudeSessionId) return [];
  if (getBackend(sessionBackend(session)).readableHistory) return loadSessionMessages(session.claudeSessionId);
  return loadTranscript(sessionsDir, session.id);
}

/** BojuBot's own transcript of a session, next to its JSON (`<id>.transcript.jsonl`). */
export function transcriptPath(sessionsDir: string, sessionFileId: string): string {
  return join(sessionsDir, `${sessionFileId}.transcript.jsonl`);
}

/**
 * One completed turn as transcript entries: the user message cleaned the same
 * way Claude Code history is on replay (injected vault context and
 * <bojubot-context> tags removed, contexts kept for badges), then the reply.
 * Empty sides are left out. Pure — exported for tests.
 */
export function transcriptEntries(prompt: string, reply: string, timestamp: string): ChatMessage[] {
  const entries: ChatMessage[] = [];
  const user = cleanUserContent(prompt);
  if (user) entries.push({ role: 'user', content: user.clean, timestamp, ...(user.contexts.length && { contexts: user.contexts }) });
  if (reply.trim()) entries.push({ role: 'assistant', content: reply.trim(), timestamp });
  return entries;
}

/** Append entries to a session's transcript, one JSON object per line. */
export function appendTranscript(sessionsDir: string, sessionFileId: string, entries: ChatMessage[]): void {
  if (!entries.length) return;
  if (!existsSync(sessionsDir)) mkdirSync(sessionsDir, { recursive: true });
  appendFileSync(transcriptPath(sessionsDir, sessionFileId), entries.map(e => JSON.stringify(e)).join('\n') + '\n');
}

/** Read a transcript written by appendTranscript. Malformed lines are skipped; a missing file yields []. */
export function loadTranscript(sessionsDir: string, sessionFileId: string): ChatMessage[] {
  const path = transcriptPath(sessionsDir, sessionFileId);
  if (!existsSync(path)) return [];
  const messages: ChatMessage[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const m = JSON.parse(line) as Partial<ChatMessage>;
      if ((m.role === 'user' || m.role === 'assistant' || m.role === 'separator') && typeof m.content === 'string') {
        messages.push({
          role: m.role,
          content: m.content,
          timestamp: typeof m.timestamp === 'string' ? m.timestamp : '',
          ...(Array.isArray(m.contexts) && m.contexts.length && { contexts: m.contexts }),
        });
      }
    } catch { /* skip malformed line */ }
  }
  return messages;
}

export function getSessionsDir(vaultRoot: string, configDir: string): string {
  // Stored outside the plugin directory so symlinked dev installs don't
  // cause multiple vaults to share the same physical sessions folder.
  return join(vaultRoot, configDir, 'bojubot', 'sessions');
}

/**
 * Resolve the sessions directory from a user-configured path.
 * - Empty / whitespace → default location (<configDir>/bojubot/sessions)
 * - Absolute path → used as-is
 * - Relative path → resolved against vault root
 */
export function resolveSessionsDir(vaultRoot: string, customPath: string | undefined, configDir: string): string {
  const p = customPath?.trim();
  if (!p) return getSessionsDir(vaultRoot, configDir);
  if (isAbsolute(p)) return p;
  return join(vaultRoot, p);
}

/** Legacy paths from previous project names (Cortex → ObsidiBot → BojuBot). */
export function getLegacySessionsDirs(vaultRoot: string, configDir: string): string[] {
  return [
    join(vaultRoot, configDir, 'obsidibot', 'sessions'),
    join(vaultRoot, configDir, 'cortex', 'sessions'),
  ];
}

export function saveSession(vaultRoot: string, session: StoredSession, sessionsDir: string): void {
  if (!existsSync(sessionsDir)) mkdirSync(sessionsDir, { recursive: true });
  // If this session came from the legacy dir, migrate it: delete the old file
  // after saving to the new location. Strip _legacyDir before persisting.
  const legacyDir = (session as StoredSession & { _legacyDir?: string })._legacyDir;
  const { _legacyDir, ...toSave } = session as StoredSession & { _legacyDir?: string };
  void _legacyDir; // destructured only to omit from toSave
  writeFileSync(join(sessionsDir, `${toSave.id}.json`), JSON.stringify(toSave, null, 2));
  if (legacyDir) {
    const oldPath = join(legacyDir, `${toSave.id}.json`);
    if (existsSync(oldPath)) unlinkSync(oldPath);
    // Clear the marker so subsequent saves don't look for the old file again
    delete (session as StoredSession & { _legacyDir?: string })._legacyDir;
  }
}

/**
 * Merge `patch` into a session file in `sessionsDir`, keeping every other field
 * (labels, sort order, …). Returns false, writing nothing, when the file isn't
 * there or can't be read.
 */
export function updateStoredSession(sessionsDir: string, id: string, patch: Partial<StoredSession>): boolean {
  const path = join(sessionsDir, `${id}.json`);
  if (!existsSync(path)) return false;
  let current: StoredSession;
  try {
    current = JSON.parse(readFileSync(path, 'utf8')) as StoredSession;
  } catch {
    return false;
  }
  writeFileSync(path, JSON.stringify({ ...current, ...patch, id }, null, 2));
  return true;
}

export function loadAllSessions(vaultRoot: string, sessionsDir: string, configDir: string): StoredSession[] {
  const loadDir = (dir: string, legacy: boolean): StoredSession[] => {
    if (!existsSync(dir)) return [];
    try {
      return readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => {
          const s = JSON.parse(readFileSync(join(dir, f), 'utf8')) as StoredSession;
          if (legacy) (s as StoredSession & { _legacyDir?: string })._legacyDir = dir;
          return s;
        });
    } catch {
      return [];
    }
  };

  const currentSessions = loadDir(sessionsDir, false);

  // Merge legacy dirs in order (obsidibot first, then cortex).
  // seen grows as we go so the first occurrence of any id wins.
  const seen = new Set(currentSessions.map(s => s.id));
  const allLegacy: StoredSession[] = [];
  for (const legacyDir of getLegacySessionsDirs(vaultRoot, configDir)) {
    for (const s of loadDir(legacyDir, true)) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        allLegacy.push(s);
      }
    }
  }
  const merged = [...currentSessions, ...allLegacy];

  return merged.sort((a, b) => {
    const aHas = a.sortOrder !== undefined;
    const bHas = b.sortOrder !== undefined;
    if (aHas && bHas) return a.sortOrder - b.sortOrder;
    if (aHas || bHas) return aHas ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

/**
 * Save a new session at the top of the ordered list.
 * If any existing sessions have a sortOrder, the new session gets sortOrder = min - 1
 * so it sorts first without rewriting any other session files.
 */
export function saveSessionAtTop(vaultRoot: string, session: StoredSession, sessionsDir: string, configDir: string): void {
  const existing = loadAllSessions(vaultRoot, sessionsDir, configDir);
  const ordered = existing.filter(s => s.sortOrder !== undefined);
  if (ordered.length > 0) {
    const minOrder = Math.min(...ordered.map(s => s.sortOrder));
    session.sortOrder = minOrder - 1;
  }
  saveSession(vaultRoot, session, sessionsDir);
}

export function deleteSession(vaultRoot: string, sessionId: string, fromDir: string | undefined, sessionsDir: string): void {
  const dir = fromDir ?? sessionsDir;
  for (const filePath of [join(dir, `${sessionId}.json`), transcriptPath(dir, sessionId)]) {
    if (existsSync(filePath)) unlinkSync(filePath);
  }
}

export function titleFromPrompt(prompt: string): string {
  const first = prompt.trim().replace(/\s+/g, ' ');
  return first.length > 60 ? first.substring(0, 60) + '…' : first;
}

export type InjectedContextType =
  | 'active-note'
  | 'split-view'
  | 'stacked-tabs'
  | 'attachment'
  | 'url'
  | 'image'
  | 'pdf'
  | 'system-message';

export interface InjectedContext {
  type: InjectedContextType;
  path?: string;     // active-note
  paths?: string;    // split-view, stacked-tabs (pipe-separated)
  source?: string;   // attachment, image, pdf
  url?: string;      // url
  content?: string;  // attachment body text
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'separator';
  content: string;
  timestamp: string;
  contexts?: InjectedContext[];
}

/** Sum of estimated tokens across a session's messages — used for the session size display. */
export function estimateSessionTokens(messages: ChatMessage[]): number {
  return messages.reduce((total, msg) => total + estimateTokens(msg.content), 0);
}

/** Reverse of ClaudeView's escapeAttr — decode HTML entities in context tag attribute values. */
function decodeAttr(value: string): string {
  return value.replace(/&(?:amp|quot|lt|gt);/g, (entity) => {
    if (entity === '&amp;') return '&';
    if (entity === '&quot;') return '"';
    if (entity === '&lt;') return '<';
    if (entity === '&gt;') return '>';
    return entity;
  });
}

/**
 * Strip all <bojubot-context> tags from content and return the clean text
 * plus a structured list of the injected contexts for badge rendering on replay.
 */
function extractBojuBotContexts(content: string): { clean: string; contexts: InjectedContext[] } {
  const contexts: InjectedContext[] = [];
  // Matches both self-closing-style and body-carrying tags
  const TAG_RE = /<bojubot-context\s([^>]*)>([\s\S]*?)<\/bojubot-context>/g;

  const clean = content.replace(TAG_RE, (_match, attrStr: string, body: string) => {
    const ctx: Record<string, string> = {};
    for (const m of attrStr.matchAll(/(\w[\w-]*)="([^"]*)"/g)) {
      ctx[m[1]] = decodeAttr(m[2]);
    }
    if (body.trim()) ctx['content'] = body.trim();
    if (ctx['type']) contexts.push(ctx as unknown as InjectedContext);
    return '';
  });

  return { clean: clean.trim(), contexts };
}

/**
 * A user message as shown on replay: injected vault context removed (it only
 * ever leads the first message), <bojubot-context> tags stripped and kept as
 * badge metadata. Null when nothing is left to show.
 */
function cleanUserContent(content: string, stripVaultContext = true): { clean: string; contexts: InjectedContext[] } | null {
  const text = stripVaultContext ? content.replace(/<vault_context>[\s\S]*?<\/vault_context>\s*/g, '').trim() : content;
  const { clean, contexts } = extractBojuBotContexts(text);
  return clean || contexts.length > 0 ? { clean, contexts } : null;
}

const COMPACTION_SUMMARY_PREFIX = 'This session is being continued from a previous conversation';
// All <local-command-*> variants (caveat, stdout, stderr, etc.) are internal noise
const INTERNAL_USER_PREFIXES = ['<local-command-', '<command-name>'];

function findJsonlPath(claudeSessionId: string): string | undefined {
  const projectsDir = join(homedir(), '.claude', 'projects');
  if (!existsSync(projectsDir)) return undefined;
  try {
    for (const project of readdirSync(projectsDir)) {
      const candidate = join(projectsDir, project, `${claudeSessionId}.jsonl`);
      if (existsSync(candidate)) return candidate;
    }
  } catch { /* ignore */ }
  return undefined;
}

/**
 * Check if a claude session can be resumed on this machine by looking for
 * its .jsonl file in any ~/.claude/projects/ subdirectory.
 */
export function canResumeLocally(claudeSessionId: string): boolean {
  return findJsonlPath(claudeSessionId) !== undefined;
}

/**
 * Parse the .jsonl session file and return user/assistant turns.
 * Strips vault_context injection from the first user message.
 */
export function loadSessionMessages(claudeSessionId: string): ChatMessage[] {
  const jsonlPath = findJsonlPath(claudeSessionId);
  if (!jsonlPath) return [];

  try {
    const lines = readFileSync(jsonlPath, 'utf8').split('\n').filter(l => l.trim());
    const messages: ChatMessage[] = [];
    let isFirstUser = true;
    let skipNextUser = false;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as Record<string, unknown>;

        // Compaction boundary — insert a divider and skip the summary that follows
        if (entry.type === 'system' && (entry).subtype === 'compact_boundary') {
          skipNextUser = true;
          messages.push({ role: 'separator', content: '─── conversation compacted ───', timestamp: entry.timestamp as string });
          continue;
        }

        if (entry.type === 'user') {
          // Drop the compaction summary that immediately follows a compact_boundary
          if (skipNextUser) {
            skipNextUser = false;
            continue;
          }

          const msg = entry.message as Record<string, unknown> | undefined;
          let content: string;
          if (typeof msg?.content === 'string') {
            content = msg.content;
          } else if (Array.isArray(msg?.content)) {
            content = (msg.content as Array<Record<string, unknown>>)
              .filter(b => b.type === 'text')
              .map(b => b.text as string)
              .join('');
          } else {
            content = '';
          }

          // Filter internal command noise
          if (INTERNAL_USER_PREFIXES.some(p => content.startsWith(p))) continue;
          // Belt-and-suspenders: catch any compaction summary not preceded by compact_boundary
          if (content.startsWith(COMPACTION_SUMMARY_PREFIX)) continue;

          const user = cleanUserContent(content, isFirstUser);
          isFirstUser = false;
          if (user) {
            messages.push({
              role: 'user',
              content: user.clean,
              timestamp: entry.timestamp as string,
              contexts: user.contexts.length > 0 ? user.contexts : undefined,
            });
          }

        } else if (entry.type === 'assistant') {
          const msg = entry.message as Record<string, unknown> | undefined;
          const blocks = (msg?.content as Array<Record<string, unknown>> | undefined) ?? [];
          const text = blocks
            .filter(b => b.type === 'text')
            .map(b => b.text as string)
            .join('');
          if (text.trim()) messages.push({ role: 'assistant', content: text.trim(), timestamp: entry.timestamp as string });
        }
      } catch { /* skip malformed lines */ }
    }

    return messages;
  } catch {
    return [];
  }
}

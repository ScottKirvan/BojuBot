import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync } from 'fs';
import { join, isAbsolute } from 'path';
import { homedir } from 'os';

export interface StoredSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  claudeSessionId: string;
  sortOrder?: number;
  userLabel?: string;
  assistantLabel?: string;
}

export function getSessionsDir(vaultRoot: string, configDir: string): string {
  // Stored outside the plugin directory so symlinked dev installs don't
  // cause multiple vaults to share the same physical sessions folder.
  return join(vaultRoot, configDir, 'obsidibot', 'sessions');
}

/**
 * Resolve the sessions directory from a user-configured path.
 * - Empty / whitespace → default location (<configDir>/obsidibot/sessions)
 * - Absolute path → used as-is
 * - Relative path → resolved against vault root
 */
export function resolveSessionsDir(vaultRoot: string, customPath: string | undefined, configDir: string): string {
  const p = customPath?.trim();
  if (!p) return getSessionsDir(vaultRoot, configDir);
  if (isAbsolute(p)) return p;
  return join(vaultRoot, p);
}

/** Legacy path used before the project was renamed from Cortex to ObsidiBot. */
export function getLegacySessionsDir(vaultRoot: string, configDir: string): string {
  return join(vaultRoot, configDir, 'cortex', 'sessions');
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
  const legacySessions = loadDir(getLegacySessionsDir(vaultRoot, configDir), true);

  // Merge: deduplicate by id (current takes precedence if same id exists in both)
  const seen = new Set(currentSessions.map(s => s.id));
  const merged = [...currentSessions, ...legacySessions.filter(s => !seen.has(s.id))];

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
 * If any existing sessions have a sortOrder, the new session gets sortOrder=0
 * and all others are shifted down by 1. Otherwise just saves normally.
 */
export function saveSessionAtTop(vaultRoot: string, session: StoredSession, sessionsDir: string, configDir: string): void {
  const existing = loadAllSessions(vaultRoot, sessionsDir, configDir);
  const anyOrdered = existing.some(s => s.sortOrder !== undefined);
  if (anyOrdered) {
    existing.forEach(s => {
      s.sortOrder = (s.sortOrder ?? 0) + 1;
      writeFileSync(join(sessionsDir, `${s.id}.json`), JSON.stringify(s, null, 2));
    });
    session.sortOrder = 0;
  }
  saveSession(vaultRoot, session, sessionsDir);
}

export function deleteSession(vaultRoot: string, sessionId: string, fromDir: string | undefined, sessionsDir: string): void {
  const dir = fromDir ?? sessionsDir;
  const filePath = join(dir, `${sessionId}.json`);
  if (existsSync(filePath)) unlinkSync(filePath);
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

/** Reverse of ClaudeView's escapeAttr — decode HTML entities in context tag attribute values. */
function decodeAttr(value: string): string {
  return value.replace(/&(?:amp|quot|lt|gt);/g, (entity) => {
    if (entity === '&amp;')  return '&';
    if (entity === '&quot;') return '"';
    if (entity === '&lt;')   return '<';
    if (entity === '&gt;')   return '>';
    return entity;
  });
}

/**
 * Strip all <obsidibot-context> tags from content and return the clean text
 * plus a structured list of the injected contexts for badge rendering on replay.
 */
function extractObsidiBotContexts(content: string): { clean: string; contexts: InjectedContext[] } {
  const contexts: InjectedContext[] = [];
  // Matches both self-closing-style and body-carrying tags
  const TAG_RE = /<obsidibot-context\s([^>]*)>([\s\S]*?)<\/obsidibot-context>/g;
  const ATTR_RE = /(\w[\w-]*)="([^"]*)"/g;

  const clean = content.replace(TAG_RE, (_match, attrStr: string, body: string) => {
    const ctx: Record<string, string> = {};
    let m: RegExpExecArray | null;
    ATTR_RE.lastIndex = 0;
    while ((m = ATTR_RE.exec(attrStr)) !== null) {
      ctx[m[1]] = decodeAttr(m[2]);
    }
    if (body.trim()) ctx['content'] = body.trim();
    if (ctx['type']) contexts.push(ctx as unknown as InjectedContext);
    return '';
  });

  return { clean: clean.trim(), contexts };
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

          if (isFirstUser) {
            // Strip injected vault context from display
            content = content.replace(/<vault_context>[\s\S]*?<\/vault_context>\s*/g, '').trim();
            isFirstUser = false;
          }

          // Strip <obsidibot-context> tags and collect metadata for badge rendering
          const { clean, contexts } = extractObsidiBotContexts(content);
          if (clean || contexts.length > 0) {
            messages.push({
              role: 'user',
              content: clean,
              timestamp: entry.timestamp as string,
              contexts: contexts.length > 0 ? contexts : undefined,
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

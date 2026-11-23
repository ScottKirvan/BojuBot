/**
 * Payload checks for UI Bridge actions (#172): even an action the agent was
 * tricked into emitting can only do a bounded amount. Pure — no Obsidian API,
 * so it's unit-testable; UIBridge.executeAction() applies them.
 */

/** Longest show-notice message shown; longer text is cut with an ellipsis. */
export const NOTICE_MAX_CHARS = 500;
/** show-notice duration bounds (ms). 0 (stays until clicked) isn't allowed. */
export const NOTICE_MIN_MS = 1000;
export const NOTICE_MAX_MS = 15000;
export const NOTICE_DEFAULT_MS = 4000;

/** The text and duration a show-notice action may use. */
export function noticePayload(message: unknown, duration: unknown): { message: string; duration: number } {
  const text = typeof message === 'string' ? message : '';
  const clipped = text.length > NOTICE_MAX_CHARS ? `${text.slice(0, NOTICE_MAX_CHARS - 1)}…` : text;
  const ms = typeof duration === 'number' && Number.isFinite(duration) ? duration : NOTICE_DEFAULT_MS;
  return { message: clipped, duration: Math.min(NOTICE_MAX_MS, Math.max(NOTICE_MIN_MS, Math.round(ms))) };
}

/**
 * Why `path` can't be the destination of a rename or move, or null when it's
 * fine. A destination must be a vault-relative path with `/` separators, no
 * `.`/`..` or empty segments, and outside Obsidian's config folder (where a
 * renamed note could replace a plugin's files).
 */
export function destinationProblem(path: unknown, configDir: string): string | null {
  if (typeof path !== 'string' || !path.trim()) return 'missing path';
  if (path.length > 1000) return 'path too long';
  if (path.includes('\\')) return 'backslash in path';
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path)) return 'absolute path';
  const segments = path.split('/');
  if (segments.some(s => s === '' || s === '.' || s === '..')) return 'empty, "." or ".." segment';
  if (segments[0].toLowerCase() === configDir.toLowerCase()) return 'inside the config folder';
  return null;
}

/** Why `newName` can't be a rename-file name (a name only, no folders), or null. */
export function newNameProblem(newName: unknown): string | null {
  if (typeof newName !== 'string' || !newName.trim()) return 'missing newName';
  if (/[\\/]/.test(newName)) return 'newName contains a folder separator (use move-file)';
  if (newName === '.' || newName === '..') return 'invalid name';
  if (newName.length > 255) return 'name too long';
  return null;
}

/** The tab open-settings may open: a known tab ID, else null (settings open on their own). */
export function knownSettingsTab(tab: unknown, knownIds: readonly string[]): string | null {
  return typeof tab === 'string' && knownIds.includes(tab) ? tab : null;
}

/**
 * Vault exclusions (#125): folders and files BojuBot leaves out of the vault
 * tree it sends at session start and out of vault query results (file lists,
 * searches, tag lookups). The agent's own file tools are unaffected: this
 * keeps clutter and private folders out of what BojuBot volunteers, it isn't
 * access control.
 *
 * Pure, apart from the module-level list the plugin keeps current
 * (`setVaultExclusions()`), which the tree builder and query handler read.
 */

/** One folder or file pattern per line; blank lines and `#` comments are ignored. */
export function parseExclusions(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => l.replace(/\\/g, '/').replace(/^\.?\/+/, ''))
    .filter(Boolean);
}

function escapeRegex(s: string): string {
  return s.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

/**
 * A pattern as a matcher for vault-relative paths.
 * - No wildcard: that file, or that folder and everything in it (`Archive`, `Archive/`).
 * - `*` matches within one name, `**` across folders, `?` one character.
 * - A pattern without `/` matches at any depth (`*.png`, `node_modules`).
 * Case-insensitive, like Windows and macOS file names.
 */
export function exclusionMatcher(pattern: string): (path: string) => boolean {
  const p = pattern.replace(/\/+$/, '');
  if (!p) return () => false;
  const anyDepth = !p.includes('/');
  let body = '';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '*' && p[i + 1] === '*') {
      body += '.*';
      i++;
      if (p[i + 1] === '/') i++;
    } else if (c === '*') {
      body += '[^/]*';
    } else if (c === '?') {
      body += '[^/]';
    } else {
      body += escapeRegex(c);
    }
  }
  const re = new RegExp(`^${anyDepth ? '(?:.*/)?' : ''}${body}(?:/.*)?$`, 'i');
  return (path: string) => re.test(path);
}

/** True when `path` (vault-relative, `/` separators) is excluded by any pattern. */
export function isExcludedPath(path: string, patterns: readonly string[]): boolean {
  return patterns.some(p => exclusionMatcher(p)(path));
}

let ACTIVE: string[] = [];
let MATCHERS: ((path: string) => boolean)[] = [];

/** Set the exclusions in effect: the user's patterns plus folders BojuBot always leaves out. */
export function setVaultExclusions(patterns: readonly string[]): void {
  ACTIVE = [...patterns];
  MATCHERS = ACTIVE.map(exclusionMatcher);
}

export function vaultExclusions(): readonly string[] {
  return ACTIVE;
}

/** True when `path` is excluded by the exclusions in effect. */
export function isExcluded(path: string): boolean {
  return MATCHERS.some(m => m(path));
}

/**
 * Folders of many similar files (#125 comment): when a folder holds more than
 * `threshold` files with the same extension, list them as one summary line
 * instead, e.g. `[214 .png files: IMG_0001.png … IMG_0214.png]`. Names are
 * sorted; other files are listed as they are.
 */
export const TREE_COLLAPSE_THRESHOLD = 30;

export function summarizeFileNames(names: readonly string[], threshold = TREE_COLLAPSE_THRESHOLD): string[] {
  const byExt = new Map<string, string[]>();
  for (const name of names) {
    const dot = name.lastIndexOf('.');
    const ext = dot > 0 ? name.slice(dot).toLowerCase() : '';
    const list = byExt.get(ext);
    if (list) list.push(name);
    else byExt.set(ext, [name]);
  }
  const out: string[] = [];
  for (const name of names) {
    const dot = name.lastIndexOf('.');
    const ext = dot > 0 ? name.slice(dot).toLowerCase() : '';
    const group = byExt.get(ext) ?? [];
    if (group.length <= threshold || !ext) {
      out.push(name);
      continue;
    }
    if (group[0] !== name) continue;
    const sorted = [...group].sort((a, b) => a.localeCompare(b));
    out.push(`[${group.length} ${ext} files: ${sorted[0]} … ${sorted[sorted.length - 1]}]`);
  }
  return out;
}

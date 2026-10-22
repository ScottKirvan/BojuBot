/**
 * Link-repair guard (#400).
 *
 * Agents sometimes write note links Obsidian can't follow: wikilinks wrapped
 * in backticks (rendered as code), `file://` URIs (ignored by Obsidian) and
 * backticks around a Markdown link's text. `repairLinks()` fixes only what is
 * certainly broken, just before a reply is rendered, and leaves everything
 * else exactly as written. Fenced code blocks and other inline code are never
 * changed.
 *
 * Pure: the vault root and a "does this note exist" lookup are passed in.
 */

export interface LinkRepairContext {
  /** Absolute vault root, either slash style (e.g. `E:\vault` or `/home/u/vault`). */
  vaultRoot: string;
  /** True when a wikilink path (no `#heading`, no `|alias`) resolves to a file in the vault. */
  noteExists: (linkpath: string) => boolean;
}

// Private-use sentinels that mark masked inline code spans.
const OPEN = '\uE000';
const CLOSE = '\uE001';

export function repairLinks(markdown: string, ctx: LinkRepairContext): string {
  if (!markdown || (!markdown.includes('`') && !/file:\/\//i.test(markdown))) return markdown;
  return splitFences(markdown)
    .map(seg => (seg.code ? seg.text : repairProse(seg.text, ctx)))
    .join('');
}

interface Segment { text: string; code: boolean }

/** Split into prose and fenced-code segments (an unclosed fence runs to the end). */
function splitFences(markdown: string): Segment[] {
  const lines = markdown.split(/(?<=\n)/); // keep line endings
  const segments: Segment[] = [];
  let buf = '';
  let fence: { char: string; len: number } | null = null;
  const flush = (code: boolean) => {
    if (buf) segments.push({ text: buf, code });
    buf = '';
  };
  for (const line of lines) {
    const body = line.replace(/\r?\n$/, '');
    if (!fence) {
      const open = /^\s*(`{3,}|~{3,})(.*)$/.exec(body);
      // A backtick fence's info string can't contain backticks (CommonMark)
      if (open && !(open[1][0] === '`' && open[2].includes('`'))) {
        flush(false);
        fence = { char: open[1][0], len: open[1].length };
      }
      buf += line;
    } else {
      buf += line;
      const close = /^\s*(`{3,}|~{3,})\s*$/.exec(body);
      if (close && close[1][0] === fence.char && close[1].length >= fence.len) {
        flush(true);
        fence = null;
      }
    }
  }
  flush(fence !== null);
  return segments;
}

interface CodeSpan { raw: string; content: string }

/** Replace inline code spans with sentinel placeholders (CommonMark backtick-run matching). */
function maskCodeSpans(text: string): { masked: string; spans: CodeSpan[] } {
  const spans: CodeSpan[] = [];
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\' && text[i + 1] === '`') { out += '\\`'; i += 2; continue; }
    if (ch !== '`') { out += ch; i++; continue; }
    let n = 0;
    while (text[i + n] === '`') n++;
    // Find the next backtick run of exactly the same length
    let j = i + n;
    let closeAt = -1;
    while (j < text.length) {
      if (text[j] !== '`') { j++; continue; }
      let m = 0;
      while (text[j + m] === '`') m++;
      if (m === n) { closeAt = j; break; }
      j += m;
    }
    if (closeAt < 0) { out += text.slice(i, i + n); i += n; continue; }
    const raw = text.slice(i, closeAt + n);
    spans.push({ raw, content: text.slice(i + n, closeAt) });
    out += `${OPEN}${spans.length - 1}${CLOSE}`;
    i = closeAt + n;
  }
  return { masked: out, spans };
}

function repairProse(text: string, ctx: LinkRepairContext): string {
  if (text.includes(OPEN) || text.includes(CLOSE)) return text; // can't mask safely
  const { masked, spans } = maskCodeSpans(text);
  let s = masked;

  // Backticks around a Markdown link's whole text: [`Label`](dest) → [Label](dest)
  s = s.replace(new RegExp(`(?<!\\[)\\[${OPEN}(\\d+)${CLOSE}\\]\\(`, 'g'), (whole, idx: string) => {
    const label = spans[Number(idx)].content.trim();
    if (!label || /[[\]`\n]/.test(label)) return whole;
    return `[${label}](`;
  });

  // Markdown links to file:// URIs inside the vault → wikilinks (label kept as alias)
  s = s.replace(
    /(?<![![])\[([^[\]\n]*)\]\(((?:[^()\n]|\([^()\n]*\))*)\)/g,
    (whole, label: string, inner: string) => {
      const dest = linkDestination(inner.trim());
      if (!dest || !/^file:\/\//i.test(dest)) return whole;
      const target = vaultTarget(dest, ctx.vaultRoot);
      if (!target) return whole;
      return wikilink(target, restore(label, spans).trim());
    },
  );

  // Bare file:// URLs (and <file://…> autolinks) inside the vault → wikilinks
  s = s.replace(
    /(?<![(<\w])(<)?(file:\/\/[^\s<>()[\]"'`\uE000\uE001]+)(>)?/gi,
    (whole, lt: string | undefined, url: string, gt: string | undefined) => {
      if (lt && !gt) return whole;
      let trail = '';
      if (!lt) {
        const m = /[.,;:!?]+$/.exec(url);
        if (m) { trail = m[0]; url = url.slice(0, -trail.length); }
      }
      const target = vaultTarget(url, ctx.vaultRoot);
      if (!target) return whole;
      return wikilink(target, '') + (lt ? '' : (gt ?? '')) + trail;
    },
  );

  // Restore code spans; a backticked wikilink to an existing note is unwrapped
  return s.replace(new RegExp(`${OPEN}(\\d+)${CLOSE}`, 'g'), (_m, idx: string) => {
    const span = spans[Number(idx)];
    const link = span.content.trim();
    const m = /^\[\[([^[\]|#^\n]+)(?:[#^][^[\]|\n]*)?(?:\|[^[\]\n]*)?\]\]$/.exec(link);
    if (m && ctx.noteExists(m[1].trim())) return link;
    return span.raw;
  });
}

function restore(text: string, spans: CodeSpan[]): string {
  return text.replace(new RegExp(`${OPEN}(\\d+)${CLOSE}`, 'g'), (_m, idx: string) => spans[Number(idx)].raw);
}

/** The destination part of a Markdown link's `(…)`: `<dest>`, `dest "title"`, or the whole thing. */
function linkDestination(inner: string): string | null {
  if (inner.startsWith('<')) {
    const end = inner.indexOf('>');
    return end > 0 ? inner.slice(1, end) : null;
  }
  const titled = /^(\S+)\s+(?:"[^"]*"|'[^']*'|\([^()]*\))$/.exec(inner);
  return titled ? titled[1] : inner;
}

interface VaultTarget { path: string; subpath: string }

/**
 * Map a file:// URI to a vault-relative wikilink target, or null when it
 * isn't inside the vault (or can't be written as a wikilink).
 */
export function vaultTarget(uri: string, vaultRoot: string): VaultTarget | null {
  const m = /^file:\/\/(.*)$/i.exec(uri.trim());
  if (!m || !vaultRoot) return null;
  let rest = m[1];
  const hashAt = rest.indexOf('#');
  let fragment = '';
  if (hashAt >= 0) { fragment = rest.slice(hashAt + 1); rest = rest.slice(0, hashAt); }

  let path: string;
  let frag: string;
  try {
    path = decodeURIComponent(rest);
    frag = decodeURIComponent(fragment);
  } catch {
    return null;
  }
  path = path.replace(/\\/g, '/');
  if (/^localhost\//i.test(path)) path = path.slice('localhost'.length);
  if (/^\/[a-zA-Z]:(\/|$)/.test(path)) path = path.slice(1);        // /E:/x → E:/x
  else if (!/^[a-zA-Z]:(\/|$)/.test(path) && !path.startsWith('/')) return null; // file://host/… (UNC)

  const root = vaultRoot.replace(/\\/g, '/').replace(/\/+$/, '');
  const windows = /^[a-zA-Z]:/.test(root) || /^[a-zA-Z]:/.test(path);
  const prefix = root + '/';
  const inside = windows
    ? path.toLowerCase().startsWith(prefix.toLowerCase())
    : path.startsWith(prefix);
  if (!inside) return null;

  let rel = path.slice(prefix.length).replace(/\/+$/, '');
  if (!rel || /[[\]|#^\n]/.test(rel)) return null;
  if (/\.md$/i.test(rel)) rel = rel.slice(0, -3);

  // Editor line anchors (#L12, #L12-L20) mean nothing in Obsidian
  const subpath = !frag || /^L\d+(-L?\d+)?$/i.test(frag) || /[[\]|\n]/.test(frag) ? '' : frag;
  return { path: rel, subpath };
}

function wikilink(target: VaultTarget, label: string): string {
  const link = target.subpath ? `${target.path}#${target.subpath}` : target.path;
  const basename = target.path.slice(target.path.lastIndexOf('/') + 1);
  const plain = [link, target.path, basename, `${target.path}.md`, `${basename}.md`];
  if (!label || label.includes('|') || label.includes(']]') || plain.includes(label)) return `[[${link}]]`;
  return `[[${link}|${label}]]`;
}

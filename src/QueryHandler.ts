import { App, TFolder } from 'obsidian';
import { log, warn } from './utils/logger';
import { buildVaultTree } from './utils/fileTree';
import { neutralizeTriggers } from './constants';
import { activeBrand, applyIdentityName } from './brand';
import uiBridgeRef from './references/ui-bridge.md';
import vaultQueryRef from './references/vault-query.md';
import canvasRef from './references/canvas.md';

export type VaultQueryType = 'backlinks' | 'outlinks' | 'tags' | 'file-list' | 'help';
export type VaultQueryMode = 'show' | 'inject';

export interface VaultQuery {
  id?: string;
  query: VaultQueryType;
  /** Required for backlinks, outlinks, and per-file tags. */
  path?: string;
  /** For tags query: find all files with this tag. */
  tag?: string;
  /** For file-list: restrict to this folder prefix. */
  folder?: string;
  /** For file-list: return an indented tree to this depth instead of a flat list. 1–N levels, -1 = unlimited. */
  depth?: number;
  mode: VaultQueryMode;
  /** For help queries: which reference bundle to inject. */
  topic?: 'ui-bridge' | 'vault-query' | 'canvas';
}

export interface VaultQueryResult {
  query: VaultQuery;
  result: unknown;
  error?: string;
}

export function resolveQuery(app: App, query: VaultQuery): VaultQueryResult {
  log('QueryHandler: resolving', query.query, query.path ?? query.tag ?? query.folder ?? '');
  try {
    switch (query.query) {

      case 'backlinks': {
        if (!query.path) return { query, result: null, error: 'path required' };
        const file = app.vault.getFileByPath(query.path);
        if (!file) return { query, result: null, error: `file not found: ${query.path}` };
        // Use public resolvedLinks (source → {target → count}) and invert for backlinks
        const backlinks = Object.entries(app.metadataCache.resolvedLinks)
          .filter(([, targets]) => file.path in targets)
          .map(([sourcePath]) => sourcePath);
        log('QueryHandler: backlinks result —', backlinks.length, 'links');
        return { query, result: { backlinks } };
      }

      case 'outlinks': {
        if (!query.path) return { query, result: null, error: 'path required' };
        const file = app.vault.getFileByPath(query.path);
        if (!file) return { query, result: null, error: `file not found: ${query.path}` };
        const cache = app.metadataCache.getFileCache(file);
        const outlinks = (cache?.links ?? []).map(l => l.link);
        log('QueryHandler: outlinks result —', outlinks.length, 'links');
        return { query, result: { outlinks } };
      }

      case 'tags': {
        if (query.path) {
          // Tags on a specific file
          const file = app.vault.getFileByPath(query.path);
          if (!file) return { query, result: null, error: `file not found: ${query.path}` };
          const cache = app.metadataCache.getFileCache(file);
          const inlineTags = (cache?.tags ?? []).map(t => t.tag);
          const fmTags: string[] = Array.isArray(cache?.frontmatter?.tags)
            ? (cache.frontmatter.tags as string[])
            : [];
          const tags = [...new Set([...inlineTags, ...fmTags])];
          log('QueryHandler: tags on file —', tags.length, 'tags');
          return { query, result: { tags } };
        } else if (query.tag) {
          // Files with a specific tag
          const needle = query.tag.startsWith('#') ? query.tag : `#${query.tag}`;
          const files: string[] = [];
          for (const f of app.vault.getMarkdownFiles()) {
            const cache = app.metadataCache.getFileCache(f);
            const fileTags = [
              ...(cache?.tags ?? []).map(t => t.tag),
              ...(Array.isArray(cache?.frontmatter?.tags) ? cache.frontmatter.tags.map((t: string) => t.startsWith('#') ? t : `#${t}`) : []),
            ];
            if (fileTags.includes(needle)) files.push(f.path);
          }
          log('QueryHandler: files with tag', needle, '—', files.length, 'files');
          return { query, result: { tag: query.tag, files } };
        }
        return { query, result: null, error: 'provide path (tags on a file) or tag (files with a tag)' };
      }

      case 'file-list': {
        if (query.depth !== undefined && query.depth !== 0) {
          let startFolder: TFolder | undefined;
          if (query.folder) {
            const abstract = app.vault.getAbstractFileByPath(query.folder);
            if (!(abstract instanceof TFolder)) {
              return { query, result: null, error: `folder not found: ${query.folder}` };
            }
            startFolder = abstract;
          }
          const tree = buildVaultTree(app.vault, query.depth, startFolder);
          log('QueryHandler: file-list (tree) — depth', query.depth);
          return { query, result: { tree } };
        }
        const prefix = query.folder ? query.folder.replace(/\/?$/, '/') : '';
        const files = app.vault.getMarkdownFiles()
          .filter(f => prefix ? f.path.startsWith(prefix) : true)
          .map(f => f.path)
          .sort();
        log('QueryHandler: file-list —', files.length, 'files');
        return { query, result: { files } };
      }

      case 'help': {
        const refs: Record<string, string> = {
          'ui-bridge': uiBridgeRef,
          'vault-query': vaultQueryRef,
          'canvas': canvasRef,
        };
        const ref = query.topic ? refs[query.topic] : null;
        if (!ref) return { query, result: null, error: `unknown help topic: ${query.topic ?? '(none)'}` };
        log('QueryHandler: help — injecting reference for topic:', query.topic);
        // ui-bridge.md hardcodes the stock name a few times ("intercepted by
        // BojuBot", the set-label example) — keep it consistent with the
        // orientation Claude already received when identity rebranding is on.
        return { query, result: applyIdentityName(ref, activeBrand()) };
      }

      default:
        warn('QueryHandler: unknown query type:', (query).query);
        return { query, result: null, error: `unknown query type: ${String(query.query)}` };
    }
  } catch (err) {
    warn('QueryHandler: error resolving query:', err);
    return { query, result: null, error: String(err) };
  }
}

/** Build a human-readable label for display in the UI. */
export function queryLabel(query: VaultQuery): string {
  switch (query.query) {
    case 'backlinks': return `Backlinks for "${query.path}"`;
    case 'outlinks': return `Outlinks for "${query.path}"`;
    case 'tags': return query.path ? `Tags on "${query.path}"` : `Files tagged #${query.tag}`;
    case 'file-list': {
      const scope = query.folder ? ` in "${query.folder}"` : '';
      return query.depth !== undefined ? `Vault tree (${query.depth} levels)${scope}` : `Files${scope || ' in vault'}`;
    }
    case 'help': return `Reference: ${query.topic ?? 'unknown'}`;
    default: return query.query;
  }
}

/** Serialize results for injection back to Claude as a structured message. */
export function buildInjectMessage(results: VaultQueryResult[]): string {
  const parts = results.map(r => {
    const label = queryLabel(r.query);
    const body = r.error
      ? `Error: ${r.error}`
      : typeof r.result === 'string'
        ? r.result
        : JSON.stringify(r.result, null, 2);
    // backlinks/outlinks/tags/file-list results are vault-derived file and folder
    // names — untrusted content a malicious or planted file could craft to look
    // like a live @@BOJU line. Neutralize them like every other vault-content
    // injection path. Help topics return BojuBot's own static reference docs,
    // which legitimately contain @@BOJU examples, so they're left untouched.
    const safeBody = r.query.query === 'help' ? body : neutralizeTriggers(body);
    return `Query: ${label}\nResult:\n${safeBody}`;
  });
  return `[BOJU_VAULT_RESPONSE]\n${parts.join('\n\n')}\n[/BOJU_VAULT_RESPONSE]`;
}

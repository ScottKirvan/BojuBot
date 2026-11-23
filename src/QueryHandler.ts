import { App, TFolder } from 'obsidian';
import { log, warn } from './utils/logger';
import { buildVaultTree } from './utils/fileTree';
import { activeBrand, applyIdentityName } from './brand';
import uiBridgeRef from './references/ui-bridge.md';
import vaultQueryRef from './references/vault-query.md';
import canvasRef from './references/canvas.md';
import { VaultQuery, VaultQueryResult, filterFileList, inFolder, searchError, searchNotes } from './utils/vaultQuery';

export type { VaultQueryType, VaultQueryMode, VaultQuery, VaultQueryResult } from './utils/vaultQuery';
export { queryLabel, buildInjectMessage } from './utils/vaultQuery';

/**
 * Resolve a vault query against the live vault. Async because search reads note
 * contents (`cachedRead`); every other type resolves straight from the vault's
 * metadata. Callers apply the mode gate (`refuseQuery`) first.
 */
export async function resolveQuery(app: App, query: VaultQuery): Promise<VaultQueryResult> {
  log('QueryHandler: resolving', query.query, query.path ?? query.tag ?? query.text ?? query.name ?? query.folder ?? '');
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
        if (query.name) {
          // Find files by name: every file type (attachments, canvases), not just notes
          const files = filterFileList(app.vault.getFiles().map(f => f.path), query);
          log('QueryHandler: file-list (name) —', files.length, 'files');
          return { query, result: { files } };
        }
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

      case 'search': {
        const error = searchError(query);
        if (error) return { query, result: null, error };
        const files = app.vault.getMarkdownFiles().filter(f => inFolder(f.path, query.folder));
        const notes = await Promise.all(files.map(async f => ({ path: f.path, content: await app.vault.cachedRead(f) })));
        const result = searchNotes(notes, query.text ?? '', query.folder);
        log('QueryHandler: search —', result.notes.length, 'notes shown of', files.length, 'searched');
        return { query, result };
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

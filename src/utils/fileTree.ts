import { TFolder, TFile, Vault } from 'obsidian';

/**
 * Build a text representation of the vault folder/file tree.
 *
 * @param vault     Obsidian vault
 * @param depth     Number of levels to include.
 *                    0  = disabled (returns empty string)
 *                    1  = root level only
 *                    2  = root + one sublevel
 *                    N  = N levels deep
 *                   -1  = unlimited depth
 *
 * Only names are listed — file/folder names only, no file contents.
 * Hidden entries (names starting with '.') are skipped at every level.
 */
export function buildVaultTree(vault: Vault, depth: number, startFolder?: TFolder): string {
  if (depth === 0) return '';

  const root = startFolder ?? vault.getRoot();
  const limit = depth < 0 ? Infinity : depth;
  const lines: string[] = [];

  function walk(folder: TFolder, currentDepth: number) {
    if (currentDepth >= limit) return;
    const indent = '  '.repeat(currentDepth);

    for (const child of folder.children) {
      if (child instanceof TFolder && !child.name.startsWith('.')) {
        lines.push(`${indent}${child.name}/`);
        walk(child, currentDepth + 1);
      }
    }
    for (const child of folder.children) {
      if (child instanceof TFile && !child.name.startsWith('.')) {
        lines.push(`${indent}${child.name}`);
      }
    }
  }

  walk(root, 0);
  return lines.join('\n');
}

import { TFolder, TFile, Vault } from 'obsidian';
import { isExcluded, summarizeFileNames } from './vaultExclusions';

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
 * Hidden entries (names starting with '.') are skipped at every level, and so
 * are the user's vault exclusions (#125). A folder with many files of one type
 * lists them as a single summary line (summarizeFileNames()).
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
      if (child instanceof TFolder && !child.name.startsWith('.') && !isExcluded(child.path)) {
        lines.push(`${indent}${child.name}/`);
        walk(child, currentDepth + 1);
      }
    }
    const names = folder.children
      .filter((child): child is TFile => child instanceof TFile && !child.name.startsWith('.') && !isExcluded(child.path))
      .map(child => child.name);
    for (const name of summarizeFileNames(names)) lines.push(`${indent}${name}`);
  }

  walk(root, 0);
  return lines.join('\n');
}

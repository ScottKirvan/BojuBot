import type { App } from 'obsidian';

/** Create the folder a vault-relative file path lives in, if it's missing (vault.create() needs it). */
export async function ensureParentFolder(app: App, filePath: string): Promise<void> {
  const slash = filePath.lastIndexOf('/');
  if (slash <= 0) return;
  const folder = filePath.slice(0, slash);
  if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
}

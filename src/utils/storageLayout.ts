/**
 * Where BojuBot keeps its files in the vault.
 *
 * New vaults: one folder at the vault root, `_<brand name>/` (`_BojuBot/` for
 * stock builds), for the context file, skills and exports. Session files stay
 * in Obsidian's config folder (`<configDir>/bojubot/sessions`) in every vault:
 * they hold machine-specific conversation IDs and paths. Vaults that already used BojuBot before this layout keep the old
 * locations: `pinnedLegacyPaths()` writes them into the settings once, and
 * nothing is moved. A user who changes a location moves the files themselves.
 *
 * Pure — no Obsidian API — so it's unit-tested.
 */

/** `storageLayout` in settings once the check below has run. */
export const STORAGE_LAYOUT_VERSION = 2;

export interface StoragePaths {
  /** The folder itself, vault-relative. */
  folder: string;
  contextFile: string;
  skills: string;
  exports: string;
}

/** The brand name made safe as a folder or file name. */
function safeName(brandName: string): string {
  const name = brandName.replace(/[\\/:*?"<>|#^[\]]/g, '').trim();
  return name || 'BojuBot';
}

/** New-vault defaults, vault-relative: `_BojuBot/_bojubot-context.md`, `_BojuBot/Skills`, … */
export function defaultStoragePaths(brandName: string): StoragePaths {
  const name = safeName(brandName);
  const folder = `_${name}`;
  return {
    folder,
    contextFile: `${folder}/_${name.toLowerCase().replace(/\s+/g, '-')}-context.md`,
    skills: `${folder}/Skills`,
    exports: `${folder}/Exports`,
  };
}

/** Where older versions kept each kind of file, vault-relative. */
export function legacyStoragePaths(brandName: string): Omit<StoragePaths, 'folder'> {
  return {
    contextFile: '_claude-context.md',
    skills: '_BojuBot Skills',
    exports: `${brandName} Exports`,
  };
}

/** The location settings this layout manages. Empty = the default location. */
export interface StorageSettings {
  contextFilePath: string;
  commandsFolder: string;
  exportFolder: string;
}

/**
 * The settings that keep an existing vault's files where they are: each one
 * still on its default (empty, or for the context file unset) gets the old
 * default written in. Locations the user set are left alone. `savedContextFile`
 * is the context file path in data.json (undefined when it was never saved).
 */
export function pinnedLegacyPaths(
  current: StorageSettings,
  savedContextFile: string | undefined,
  legacy: Omit<StoragePaths, 'folder'>,
): Partial<StorageSettings> {
  const out: Partial<StorageSettings> = {};
  if (!savedContextFile?.trim()) out.contextFilePath = legacy.contextFile;
  if (!current.commandsFolder.trim()) out.commandsFolder = legacy.skills;
  if (!current.exportFolder.trim()) out.exportFolder = legacy.exports;
  return out;
}

/**
 * Whether this vault used BojuBot before the _BojuBot folder: it has saved
 * settings, or a file or folder at one of the old default places (`exists`
 * takes a vault-relative path). Session files are checked by the caller.
 */
export function isExistingVault(
  hasSavedSettings: boolean,
  exists: (vaultRelativePath: string) => boolean,
  legacy: Omit<StoragePaths, 'folder'>,
): boolean {
  return hasSavedSettings || [legacy.contextFile, legacy.skills, legacy.exports].some(exists);
}

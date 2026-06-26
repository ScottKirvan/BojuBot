// Electron APIs are not available as static ES imports in the Obsidian plugin
// build environment — runtime require() is the only supported access pattern.

/* eslint-disable @typescript-eslint/no-require-imports -- Electron runtime access */

interface ElectronDialogResult {
  canceled: boolean;
  filePaths: string[];
}

export interface ElectronDialog {
  showOpenDialog(opts: {
    properties: string[];
    defaultPath?: string;
  }): Promise<ElectronDialogResult>;
}

interface ElectronClipboard {
  readFilePaths(): string[];
}

/** Returns the Electron dialog API, or null if unavailable (non-desktop context). */
export function getElectronDialog(): ElectronDialog | null {
  try {
    const electron = require('electron') as {
      remote?: { dialog: ElectronDialog };
      dialog?: ElectronDialog;
    };
    if (electron.dialog) return electron.dialog;
    if (electron.remote?.dialog) return electron.remote.dialog;
    const remote = require('@electron/remote') as { dialog: ElectronDialog };
    return remote.dialog ?? null;
  } catch {
    return null;
  }
}

/** Returns the Electron clipboard API, or null if unavailable. */
export function getElectronClipboard(): ElectronClipboard | null {
  try {
    const { clipboard } = require('electron') as { clipboard: ElectronClipboard };
    return clipboard ?? null;
  } catch {
    return null;
  }
}

/* eslint-enable @typescript-eslint/no-require-imports */

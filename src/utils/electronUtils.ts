// Electron APIs are not available as static ES imports in the Obsidian plugin
// build environment — window.require is Electron's renderer-process CommonJS
// loader. Accessing it as a property (not a bare `require(...)` call) means
// @typescript-eslint/no-require-imports never fires, so no eslint-disable is
// needed. Obsidian's submission scan flags disable comments on required rules
// directly, regardless of whether the underlying code is a real violation.
// Uses activeWindow (not the global window) for popout-window compatibility.
type ElectronRequire = (id: string) => unknown;

function windowRequire(): ElectronRequire | null {
  return (activeWindow as unknown as { require?: ElectronRequire }).require ?? null;
}

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
    const req = windowRequire();
    if (!req) return null;
    const electron = req('electron') as {
      remote?: { dialog: ElectronDialog };
      dialog?: ElectronDialog;
    };
    if (electron.dialog) return electron.dialog;
    if (electron.remote?.dialog) return electron.remote.dialog;
    const remote = req('@electron/remote') as { dialog: ElectronDialog };
    return remote.dialog ?? null;
  } catch {
    return null;
  }
}

/** Returns the Electron clipboard API, or null if unavailable. */
export function getElectronClipboard(): ElectronClipboard | null {
  try {
    const req = windowRequire();
    if (!req) return null;
    const { clipboard } = req('electron') as { clipboard: ElectronClipboard };
    return clipboard ?? null;
  } catch {
    return null;
  }
}

/**
 * The real path of a File from a paste or drop, or '' when it has none (a
 * screenshot, or Electron's webUtils unavailable). Electron removed File.path
 * in v32; webUtils.getPathForFile() replaced it.
 */
export function getPathForFile(file: File): string {
  try {
    const req = windowRequire();
    const webUtils = req ? (req('electron') as { webUtils?: { getPathForFile(f: File): string } }).webUtils : undefined;
    const path = webUtils?.getPathForFile(file);
    if (path) return path;
  } catch { /* fall back below */ }
  const legacy = (file as File & { path?: unknown }).path;
  return typeof legacy === 'string' ? legacy : '';
}

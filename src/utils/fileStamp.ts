import { statSync } from 'fs';

type Stat = (path: string) => { mtimeMs: number; size: number };

/**
 * A cheap fingerprint of a file: modified time and size, or null when it can't
 * be read. An agent CLI that was updated or reinstalled gets a new stamp, which
 * tells the plugin to probe it again without an Obsidian restart.
 */
export function fileStamp(path: string, stat: Stat = statSync): string | null {
  try {
    const s = stat(path);
    return `${s.mtimeMs}:${s.size}`;
  } catch {
    return null;
  }
}

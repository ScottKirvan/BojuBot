import * as os from 'os';
import type { PermissionMode } from './types';

/**
 * Chat only (restricted) mode has no file-system tools at all, but the CLI
 * still spawns with — and is aware of — its OS working directory regardless of
 * tool access. Spawning it there instead of the vault root keeps the vault's
 * file-system path from leaking through that awareness (e.g. via error text or
 * the model's own environment context, independent of anything BojuBot injects).
 * Called fresh on every spawn (never cached) so a mid-session permission
 * upgrade takes effect on the very next turn without needing a re-spawn.
 */
export function resolveSpawnCwd(mode: PermissionMode, sessionCwd: string | undefined, vaultRoot: string): string {
  if (mode === 'restricted') return os.tmpdir();
  return sessionCwd ?? vaultRoot;
}

/**
 * True when the effective permission mode allows vault writes (Standard or Full).
 * Used to gate UI Bridge file-mutating actions (rename-file, move-file,
 * delete-file), which run through that side-channel rather than the CLI's
 * own tool permissions and so aren't otherwise subject to Read only / Chat
 * only's "no writes" guarantee.
 */
export function canWrite(permissionMode?: PermissionMode): boolean {
  return permissionMode === 'standard' || permissionMode === 'full';
}

/**
 * Version and build details for the Help & resources dialog (#377).
 * No Obsidian API dependency — safe to import in unit tests.
 * The build facts themselves are collected at build time by scripts/buildInfo.mjs.
 */

export interface BuildInfo {
  commit: string;
  branch: string;
  builtAt: string;
  dirty: boolean;
}

/** An installed agent CLI. Agents that aren't installed are left out entirely. */
export interface AgentVersion {
  name: string;
  version: string;
}

/** Branches not worth showing: releases and automatic betas are built from `main`. */
const UNREMARKABLE_BRANCHES = new Set(['main', 'unknown']);

/**
 * The small "branch · built time" line under the version, as separate parts so
 * it wraps between them. The branch only appears for builds from another
 * branch (a manual beta or a local build); a `main` build shows just its build time.
 */
export function buildLineParts(info: BuildInfo): string[] {
  return UNREMARKABLE_BRANCHES.has(info.branch) ? [info.builtAt] : [info.branch, info.builtAt];
}

/** "Windows 10.0.28120", "macOS 24.1.0", "Linux 6.8.0". */
export function osLabel(platform: string, release: string): string {
  const name = platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : platform === 'linux' ? 'Linux' : platform;
  return release ? `${name} ${release}` : name;
}

/**
 * The line copied to the clipboard for bug reports, e.g.
 * "BojuBot 3.8.0 (branch main, built 2026-10-17 06:12 UTC) · Claude Code 2.1.72 · Antigravity 1.4.2 · Windows 10.0.28120".
 * Like QuKi-Notes, it leaves out the commit hash and the uncommitted-changes flag.
 */
export function formatVersionInfo(appName: string, version: string, info: BuildInfo, agents: AgentVersion[], os: string): string {
  return [
    `${appName} ${version} (branch ${info.branch}, built ${info.builtAt})`,
    ...agents.map(a => `${a.name} ${a.version}`),
    os,
  ].filter(Boolean).join(' · ');
}

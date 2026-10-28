/**
 * Version and build details for the Help & resources dialog (#377).
 * No Obsidian API dependency — safe to import in unit tests.
 * The build facts themselves are collected at build time by scripts/buildInfo.mjs.
 */

/**
 * Reproducible by design (scripts/buildInfo.mjs): no commit hash or clock time,
 * so rebuilding a release's commit gives the same main.js.
 */
export interface BuildInfo {
  /** '' for builds from main (releases, automatic betas) or with no branch. */
  branch: string;
  /** The commit's time, or the build's when it had uncommitted changes. */
  builtAt: string;
}

/** An installed agent CLI. Agents that aren't installed are left out entirely. */
export interface AgentVersion {
  name: string;
  version: string;
}

/**
 * The small "branch · built time" line under the version, as separate parts so
 * it wraps between them. Only builds from another branch (a manual beta or a
 * local build) have a branch; a `main` build shows just its time.
 */
export function buildLineParts(info: BuildInfo): string[] {
  return info.branch ? [info.branch, info.builtAt] : [info.builtAt];
}

/** "Windows 10.0.28120", "macOS 24.1.0", "Linux 6.8.0". */
export function osLabel(platform: string, release: string): string {
  const name = platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : platform === 'linux' ? 'Linux' : platform;
  return release ? `${name} ${release}` : name;
}

/**
 * The line copied to the clipboard for bug reports, e.g.
 * "BojuBot 3.8.0 (built 2026-10-17 06:12 UTC) · Claude Code 2.1.72 · Antigravity 1.4.2 · Windows 10.0.28120",
 * with "branch dev, " before "built" for a build from another branch.
 */
export function formatVersionInfo(appName: string, version: string, info: BuildInfo, agents: AgentVersion[], os: string): string {
  const build = info.branch ? `branch ${info.branch}, built ${info.builtAt}` : `built ${info.builtAt}`;
  return [
    `${appName} ${version} (${build})`,
    ...agents.map(a => `${a.name} ${a.version}`),
    os,
  ].filter(Boolean).join(' · ');
}

/** Parsed major.minor.patch — non-numeric or missing segments default to 0. */
export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

/** Parses a version string, tolerating a leading "v" (e.g. release tag names). */
export function parseVersion(version: string): SemVer {
  const clean = version.replace(/^v/i, '');
  const [major, minor, patch] = clean.split('.').map(n => parseInt(n, 10) || 0);
  return { major: major || 0, minor: minor || 0, patch: patch || 0 };
}

/** -1 / 0 / 1, comparing a to b. */
export function compareVersions(a: string, b: string): number {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  if (va.major !== vb.major) return va.major - vb.major;
  if (va.minor !== vb.minor) return va.minor - vb.minor;
  return va.patch - vb.patch;
}

export function isNewerThan(a: string, b: string): boolean {
  return compareVersions(a, b) > 0;
}

/** True when going from `from` to `to` changed the major or minor version (not just the patch). */
export function isMinorOrMajorBump(from: string, to: string): boolean {
  const vf = parseVersion(from);
  const vt = parseVersion(to);
  return vf.major !== vt.major || vf.minor !== vt.minor;
}

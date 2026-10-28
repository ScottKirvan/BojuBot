import type { BuildInfo } from '../src/utils/buildInfo';

export interface GitFacts {
  branch: string | null;
  /** `git log -1 --format=%ct`: the commit's time in seconds since the epoch. */
  commitTime: string | null;
  dirty: boolean | null;
}

export interface BuildEnv {
  GITHUB_HEAD_REF?: string;
  GITHUB_REF?: string;
  GITHUB_REF_NAME?: string;
  SOURCE_DATE_EPOCH?: string;
}

export function resolveBuildInfo(inputs: { git: GitFacts; env: BuildEnv; now: Date }): BuildInfo;
export function readGitFacts(run: (args: string[]) => string): GitFacts;
export function collectBuildInfo(options: { cwd: string; env?: BuildEnv; now?: Date }): BuildInfo;

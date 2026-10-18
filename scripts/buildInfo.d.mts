import type { BuildInfo } from '../src/utils/buildInfo';

export interface GitFacts {
  commit: string | null;
  branch: string | null;
  dirty: boolean | null;
}

export interface BuildEnv {
  GITHUB_SHA?: string;
  GITHUB_HEAD_REF?: string;
  GITHUB_REF_NAME?: string;
}

export function resolveBuildInfo(inputs: { git: GitFacts; env: BuildEnv; now: Date }): BuildInfo;
export function readGitFacts(run: (args: string[]) => string): GitFacts;
export function collectBuildInfo(options: { cwd: string; env?: BuildEnv; now?: Date }): BuildInfo;

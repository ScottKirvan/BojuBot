// Build facts baked into the bundle as __BUILD_INFO__ (see esbuild.config.mjs),
// shown in the Help & resources dialog. Ported from QuKi-Notes
// (project/src/buildInfo.ts + buildInfoGit.ts) so the About dialogs match.
import { execFileSync } from 'node:child_process';

const UNKNOWN = 'unknown';
const SHORT_COMMIT_LENGTH = 7;
const HEX_HASH = /^[0-9a-f]{7,64}$/i;
const GIT_TIMEOUT_MS = 10_000;

function shortCommit(candidate) {
  const trimmed = candidate?.trim() ?? '';
  return HEX_HASH.test(trimmed) ? trimmed.slice(0, SHORT_COMMIT_LENGTH).toLowerCase() : null;
}

function branchName(candidate) {
  const name = (candidate?.trim() ?? '').replace(/^refs\/heads\//, '');
  return name === '' || name === 'HEAD' ? null : name;
}

function formatUtc(date) {
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/**
 * Git first, then CI: a pull request's source branch (GITHUB_HEAD_REF), then the
 * branch or tag that triggered the run (GITHUB_REF_NAME). A detached HEAD — what
 * CI checks out — counts as no branch. Pure: exported for tests.
 */
export function resolveBuildInfo({ git, env, now }) {
  return {
    commit: shortCommit(git.commit) ?? shortCommit(env.GITHUB_SHA) ?? UNKNOWN,
    branch: branchName(git.branch) ?? branchName(env.GITHUB_HEAD_REF) ?? branchName(env.GITHUB_REF_NAME) ?? UNKNOWN,
    builtAt: formatUtc(now),
    dirty: git.dirty === true,
  };
}

function attempt(run, args) {
  try {
    return run(args).trim();
  } catch {
    return null;
  }
}

export function readGitFacts(run) {
  const status = attempt(run, ['status', '--porcelain', '--untracked-files=no']);
  return {
    commit: attempt(run, ['rev-parse', 'HEAD']),
    branch: attempt(run, ['branch', '--show-current']),
    dirty: status === null ? null : status !== '',
  };
}

export function collectBuildInfo({ cwd, env = process.env, now = new Date() }) {
  const run = (args) => execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: GIT_TIMEOUT_MS });
  return resolveBuildInfo({ git: readGitFacts(run), env, now });
}

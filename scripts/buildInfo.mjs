// Build facts baked into the bundle as __BUILD_INFO__ (see esbuild.config.mjs),
// shown in the Help & resources dialog. Ported from QuKi-Notes
// (project/src/buildInfo.ts + buildInfoGit.ts) so the About dialogs match.
//
// Reproducible: building the same commit again (Obsidian's release check
// rebuilds from source and compares main.js) must give the same bytes. So the
// time is the commit's, not the clock's, and a main or unknown branch is left
// out, since a rebuild from a release tag has no branch.
import { execFileSync } from 'node:child_process';

const GIT_TIMEOUT_MS = 10_000;
/** Branches not worth recording: releases and automatic betas are built from main. */
const UNRECORDED_BRANCHES = new Set(['', 'HEAD', 'main']);

function branchName(candidate) {
  const name = (candidate?.trim() ?? '').replace(/^refs\/heads\//, '');
  return name === '' || name === 'HEAD' ? null : name;
}

/** GITHUB_REF only when it names a branch: a tag build ("refs/tags/3.8.1") has none. */
function refBranch(ref) {
  return ref?.startsWith('refs/heads/') ? branchName(ref) : null;
}

function formatUtc(date) {
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** Seconds since the epoch, or null. */
function epochSeconds(candidate) {
  const n = Number(candidate?.toString().trim());
  return candidate != null && candidate !== '' && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Branch: git first, then CI — a pull request's source branch (GITHUB_HEAD_REF),
 * then the branch that triggered the run (GITHUB_REF, branches only). A detached
 * HEAD (what a rebuild from a tag checks out) counts as no branch, and so does
 * main: neither is recorded.
 *
 * Time: SOURCE_DATE_EPOCH when set (the reproducible-builds convention), else the
 * commit's time, else now. Uncommitted changes always use now, since the commit
 * doesn't describe that build. Pure: exported for tests.
 */
export function resolveBuildInfo({ git, env, now }) {
  const branch = branchName(git.branch) ?? branchName(env.GITHUB_HEAD_REF) ?? refBranch(env.GITHUB_REF) ?? '';
  const sourceEpoch = epochSeconds(env.SOURCE_DATE_EPOCH);
  const commitEpoch = git.dirty === true ? null : epochSeconds(git.commitTime);
  const seconds = sourceEpoch ?? commitEpoch;
  return {
    branch: UNRECORDED_BRANCHES.has(branch) ? '' : branch,
    builtAt: formatUtc(seconds !== null ? new Date(seconds * 1000) : now),
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
    branch: attempt(run, ['branch', '--show-current']),
    commitTime: attempt(run, ['log', '-1', '--format=%ct']),
    dirty: status === null ? null : status !== '',
  };
}

export function collectBuildInfo({ cwd, env = process.env, now = new Date() }) {
  const run = (args) => execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], timeout: GIT_TIMEOUT_MS });
  return resolveBuildInfo({ git: readGitFacts(run), env, now });
}

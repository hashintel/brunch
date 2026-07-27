import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, realpathSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve } from 'node:path';

import { brunchRef } from './run-refs.js';

export type PromoteResult = { target: string; branch: string; commit: string };

export type LandResult =
  | { kind: 'landed'; mode: 'fast-forward' | 'merge'; branch: string; commit: string }
  | { kind: 'refused'; reason: 'dirty' | 'detached' }
  | { kind: 'conflict'; branch: string };

export type LandOptions = {
  /** The user's repo root whose active branch should receive the cook commit. */
  sourceDir: string;
  runId: string;
};

export type PromoteOptions = {
  sandboxDir: string;
  target: string;
  runId: string;
  force: boolean;
};

function git(args: string[], cwd: string, env?: NodeJS.ProcessEnv): string {
  return execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function gitOk(args: string[], cwd: string): boolean {
  try {
    git(args, cwd);
    return true;
  } catch {
    return false;
  }
}

// Deterministic committer so promotion never depends on (or mutates) global git config.
const COMMIT_IDENTITY = ['-c', 'user.name=brunch', '-c', 'user.email=cook@brunch'];

/** Never copy git/brunch metadata from the promotion source (matches slice-merge walks). */
const PROMOTION_COPY_SKIP = new Set(['.git', '.brunch']);

function isPromotionAllowedWithoutForce(dir: string): boolean {
  if (!existsSync(dir)) return true;
  const entries = readdirSync(dir);
  if (entries.length === 0) return true;
  // Freshly `git init` target: only `.git`, no tracked files yet (D166-K).
  if (entries.length === 1 && entries[0] === '.git' && isGitRepoRoot(dir)) return true;
  return false;
}

// True only when `dir` is itself a repo root — not merely nested inside one
// (`--show-toplevel` walks up, so we compare it to `dir`). Both sides go through
// realpathSync because git canonicalizes symlinks (e.g. macOS /var → /private/var)
// and we don't. Keeps promotion from committing into an enclosing repo.
function isGitRepoRoot(dir: string): boolean {
  try {
    return realpathSync(git(['rev-parse', '--show-toplevel'], dir)) === realpathSync(dir);
  } catch {
    return false;
  }
}

function isPathInside(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

/** Refuse targets that alias or sit inside the promotion source — git init/copy would mutate the run artifact. */
function assertDistinctPromotionPaths(target: string, sandboxDir: string): void {
  const canonicalTarget = realpathSync(target);
  const canonicalSource = realpathSync(sandboxDir);
  if (canonicalTarget === canonicalSource) {
    throw new Error(`Refusing to promote into the promotion source: ${target}`);
  }
  if (isPathInside(canonicalTarget, canonicalSource)) {
    throw new Error(`Refusing to promote into a path inside the promotion source: ${target}`);
  }
  // An ancestor target (e.g. project root with --out=.) is allowed: the run
  // worktree normally lives under <cwd>/.brunch/cook/... and D166-K lands on
  // brunch/run/<runId> there. cpSync skips .brunch/.git from the source tree.
}

function checkoutCookBranch(target: string, runId: string): void {
  const branch = brunchRef.run(runId);
  try {
    git(['rev-parse', '--verify', `refs/heads/${branch}`], target);
    git(['checkout', '-q', branch], target);
  } catch {
    git(['checkout', '-q', '-b', branch], target);
  }
}

/**
 * Land a completed greenfield run's single tree into `target` as a reviewable
 * git commit (commit-on-branch). Never a silent overwrite: an empty target is
 * git-init'd and committed on `main`; an existing repo lands on a `brunch/run/<runId>`
 * branch (the user's branch is untouched); a non-empty target is refused unless
 * `force`.
 */
export function promoteGreenfieldRun(opts: PromoteOptions): PromoteResult {
  const target = resolve(opts.target);
  const sandboxDir = resolve(opts.sandboxDir);
  mkdirSync(target, { recursive: true });
  assertDistinctPromotionPaths(target, sandboxDir);

  if (!isPromotionAllowedWithoutForce(target) && !opts.force) {
    throw new Error(
      `Refusing to promote into a non-empty target: ${target}. Pass --force to land on a ${brunchRef.run(opts.runId)} branch.`,
    );
  }

  let branch: string;
  if (isGitRepoRoot(target)) {
    branch = brunchRef.run(opts.runId);
    checkoutCookBranch(target, opts.runId);
  } else {
    branch = 'main';
    git(['init', '-q', '-b', branch], target);
  }

  cpSync(sandboxDir, target, {
    recursive: true,
    filter: (src) => !PROMOTION_COPY_SKIP.has(basename(src)),
  });
  git(['add', '-A'], target);
  git([...COMMIT_IDENTITY, 'commit', '-q', '-m', `cook: ${opts.runId}`], target);

  const commit = git(['rev-parse', 'HEAD'], target);
  return { target, branch, commit };
}

/**
 * Merge a promoted `brunch/run/<runId>` branch into the repo's checked-out branch — the
 * opt-in counterpart to brownfield promotion's hands-off default. Promotion
 * deliberately never touches the working branch; this is the only path that does,
 * and only when the caller (`serve --land`) explicitly asks. It refuses rather
 * than freelance: a dirty tree or detached HEAD is left untouched, and a real
 * merge that conflicts is aborted back to a clean state. On every non-landed
 * outcome the `brunch/run/<runId>` branch stays intact for manual merge/review.
 */
export function landCookBranch(opts: LandOptions): LandResult {
  const sourceDir = resolve(opts.sourceDir);
  const ref = brunchRef.run(opts.runId);
  const cookCommit = git(['rev-parse', '--verify', ref], sourceDir);

  // Refuse on a detached HEAD (no branch to advance) or a dirty tree (don't bury
  // uncommitted work under a merge) — leave the repo exactly as found.
  let branch: string;
  try {
    branch = git(['symbolic-ref', '--quiet', '--short', 'HEAD'], sourceDir);
  } catch {
    return { kind: 'refused', reason: 'detached' };
  }
  if (git(['status', '--porcelain'], sourceDir) !== '') {
    return { kind: 'refused', reason: 'dirty' };
  }

  // HEAD unmoved since the run branched → brunch/run/<runId> is strictly ahead, so a
  // fast-forward lands the commit verbatim. Otherwise a real merge is required.
  if (gitOk(['merge-base', '--is-ancestor', 'HEAD', ref], sourceDir)) {
    git(['merge', '--ff-only', ref], sourceDir);
    return { kind: 'landed', mode: 'fast-forward', branch, commit: cookCommit };
  }
  try {
    git([...COMMIT_IDENTITY, 'merge', '--no-edit', ref], sourceDir);
  } catch {
    git(['merge', '--abort'], sourceDir);
    return { kind: 'conflict', branch };
  }
  return { kind: 'landed', mode: 'merge', branch, commit: git(['rev-parse', 'HEAD'], sourceDir) };
}

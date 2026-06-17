import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';

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

export type BrownfieldPromoteOptions = {
  /** The user's repo root the brownfield cook ran against (a worktree of it). */
  sourceDir: string;
  /** The composed final tree to land (from `promotionSourceDir`). */
  sourceTreeDir: string;
  runId: string;
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
  // cook/<runId> there. cpSync skips .brunch/.git from the source tree.
}

function checkoutCookBranch(target: string, runId: string): void {
  const branch = `cook/${runId}`;
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
 * git-init'd and committed on `main`; an existing repo lands on a `cook/<runId>`
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
      `Refusing to promote into a non-empty target: ${target}. Pass --force to land on a cook/${opts.runId} branch.`,
    );
  }

  let branch: string;
  if (isGitRepoRoot(target)) {
    branch = `cook/${opts.runId}`;
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
 * Land a completed *brownfield* run's composed tree onto the `cook/<runId>`
 * branch of the user's repo as one reviewable commit — the brownfield analogue
 * of `promoteGreenfieldRun`. The brownfield sandbox was created with
 * `git worktree add -b cook/<runId> … HEAD`, so the branch already exists at the
 * base the run started from; this commits the result on top of it via plumbing
 * (`commit-tree` + compare-and-swap `update-ref`) using a throwaway index and an
 * external work-tree, so the user's real working tree, index, and active branch
 * are never touched. Merging `cook/<runId>` into the working branch stays the
 * user's call — promotion never freelances into it.
 */
export function promoteBrownfieldRun(opts: BrownfieldPromoteOptions): PromoteResult {
  const sourceDir = resolve(opts.sourceDir);
  const sourceTreeDir = resolve(opts.sourceTreeDir);
  const branch = `cook/${opts.runId}`;
  const ref = `refs/heads/${branch}`;

  // The branch must already exist (the sandbox branched it from HEAD); its tip is
  // the parent we commit on top of and the CAS expected-value for update-ref.
  let parent: string;
  try {
    parent = git(['rev-parse', '--verify', ref], sourceDir);
  } catch {
    throw new Error(
      `Brownfield promotion expects an existing ${branch} branch in ${sourceDir} (created by the cook worktree).`,
    );
  }

  // Absolute git dir so a throwaway index + external work-tree can target the
  // user's object store without depending on cwd.
  const gitDir = resolve(sourceDir, git(['rev-parse', '--git-dir'], sourceDir));
  const tmp = mkdtempSync(join(tmpdir(), 'brunch-promote-'));
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_INDEX_FILE: join(tmp, 'index') };
  const plumb = ['--git-dir', gitDir, '--work-tree', sourceTreeDir];
  try {
    // Seed the index from the base, then stage the composed tree as the delta —
    // adds, modifications, and deletions, all relative to the base commit.
    git([...plumb, 'read-tree', parent], sourceDir, env);
    git([...plumb, 'add', '-A'], sourceDir, env);
    const tree = git(['--git-dir', gitDir, 'write-tree'], sourceDir, env);
    const commit = git(
      [
        ...COMMIT_IDENTITY,
        '--git-dir',
        gitDir,
        'commit-tree',
        tree,
        '-p',
        parent,
        '-m',
        `cook: ${opts.runId}`,
      ],
      sourceDir,
      env,
    );
    git(['--git-dir', gitDir, 'update-ref', ref, commit, parent], sourceDir, env);
    return { target: sourceDir, branch, commit };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

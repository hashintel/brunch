import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, realpathSync } from 'node:fs';
import { basename, resolve } from 'node:path';

export type PromoteResult = { target: string; branch: string; commit: string };

export type PromoteOptions = {
  sandboxDir: string;
  target: string;
  runId: string;
  force: boolean;
};

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
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

/**
 * Land a completed greenfield run's single tree into `target` as a reviewable
 * git commit (commit-on-branch). Never a silent overwrite: an empty target is
 * git-init'd and committed on `main`; an existing repo lands on a `cook/<runId>`
 * branch (the user's branch is untouched); a non-empty target is refused unless
 * `force`.
 */
export function promoteGreenfieldRun(opts: PromoteOptions): PromoteResult {
  const target = resolve(opts.target);
  mkdirSync(target, { recursive: true });

  if (!isPromotionAllowedWithoutForce(target) && !opts.force) {
    throw new Error(
      `Refusing to promote into a non-empty target: ${target}. Pass --force to land on a cook/${opts.runId} branch.`,
    );
  }

  let branch: string;
  if (isGitRepoRoot(target)) {
    branch = `cook/${opts.runId}`;
    git(['checkout', '-q', '-b', branch], target);
  } else {
    branch = 'main';
    git(['init', '-q', '-b', branch], target);
  }

  cpSync(opts.sandboxDir, target, {
    recursive: true,
    filter: (src) => !PROMOTION_COPY_SKIP.has(basename(src)),
  });
  git(['add', '-A'], target);
  git([...COMMIT_IDENTITY, 'commit', '-q', '-m', `cook: ${opts.runId}`], target);

  const commit = git(['rev-parse', 'HEAD'], target);
  return { target, branch, commit };
}

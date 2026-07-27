import { execFileSync } from 'node:child_process';
import { realpathSync, rmSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

/**
 * Single source of truth for the git ref namespace a cook run owns. Sibling
 * `run/` and `slice/` segments dodge git's leaf-or-directory clash: a
 * `brunch/run/<id>` leaf never blocks `brunch/slice/<id>/<sliceId>`, and the
 * whole family is one `git branch --list 'brunch/*'` / `git worktree list`
 * glob to clean up. Replaces the historical, stringly-duplicated `cook/<id>`
 * (run) and `cook-slice/<id>/<sliceId>` (slice) refs.
 *
 * The on-disk run directory stays `.brunch/cook/runs/<id>/` (FE-743 artifact
 * compatibility) — only git refs move to the `brunch/*` namespace.
 */
export const brunchRef = {
  run: (runId: string): string => `brunch/run/${runId}`,
  slice: (runId: string, sliceId: string): string => `brunch/slice/${runId}/${sliceId}`,
};

/**
 * Drop stale `.git/worktrees/<name>` registrations whose directory was removed
 * out-of-band (a crash, a manual `rm`). Without this a later `git worktree add`
 * to the same path fails with "already registered / exists". Idempotent and
 * safe — `git worktree prune` only reaps administrative leftovers, never a live
 * worktree whose directory still exists.
 */
export function pruneWorktrees(repoDir: string): void {
  execFileSync('git', ['worktree', 'prune'], { cwd: repoDir, stdio: ['ignore', 'pipe', 'pipe'] });
}

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function gitOk(args: string[], cwd: string): void {
  try {
    git(args, cwd);
  } catch {
    /* best-effort cleanup — a missing worktree/branch is already the desired state */
  }
}

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith(sep) && rel !== '..');
}

/**
 * Reclaim a finished run's transient state: remove every worktree registered under
 * `runDir` (the run worktree + its nested slice / `__epic__` worktrees), delete the
 * intermediate `brunch/slice/<runId>/*` branches (their work is folded into the run
 * branch), and remove the on-disk `runDir`. The `brunch/run/<runId>` branch — the
 * promoted artifact the user reviews/merges — is deliberately kept, as is every
 * other run's state. Best-effort and idempotent: an already-gone worktree or branch
 * is the desired end state, not an error.
 */
export function gcCookRun(opts: { sourceDir: string; runId: string; runDir: string }): void {
  const sourceDir = resolve(opts.sourceDir);
  // Canonicalize: `git worktree list` reports realpath-resolved paths (e.g. macOS
  // /var → /private/var), so compare against a realpath'd runDir or nothing matches.
  const runDir = realpathSync(resolve(opts.runDir));

  // Worktrees nested under runDir, deepest first so a parent never blocks a child.
  const worktreePaths = git(['worktree', 'list', '--porcelain'], sourceDir)
    .split('\n')
    .filter((l) => l.startsWith('worktree '))
    .map((l) => resolve(l.slice('worktree '.length)))
    .filter((p) => isInside(runDir, p))
    .sort((a, b) => b.length - a.length);
  for (const wt of worktreePaths) gitOk(['worktree', 'remove', '--force', wt], sourceDir);
  pruneWorktrees(sourceDir);

  // Intermediate slice branches (folded into the run branch); keep brunch/run/<runId>.
  // No trailing slash: for-each-ref matches a prefix at the /-boundary, so
  // `refs/heads/brunch/slice/<runId>` covers every slice branch of this run.
  const sliceBranchPrefix = `refs/heads/${brunchRef.slice(opts.runId, '').replace(/\/$/, '')}`;
  const sliceBranches = git(['for-each-ref', '--format=%(refname:short)', sliceBranchPrefix], sourceDir)
    .split('\n')
    .filter(Boolean);
  for (const branch of sliceBranches) gitOk(['branch', '-D', branch], sourceDir);

  rmSync(runDir, { recursive: true, force: true });
}

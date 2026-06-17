import { execFileSync } from 'node:child_process';

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

import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { copyMissingTopLevelEntries } from './cow-copy.js';
import { brunchRef, pruneWorktrees } from './run-refs.js';

export type SandboxInfo = {
  runId: string;
  runDir: string;
  sandboxDir: string;
};

export type SandboxMode = 'fixture' | 'codebase';

export type CreateSandboxOptions =
  | { mode: Extract<SandboxMode, 'fixture'> }
  | { mode: Extract<SandboxMode, 'codebase'>; sourceDir: string };

/**
 * Create an isolated run directory under `baseDir/.brunch/cook/runs/<runId>/`.
 * `baseDir` should be cwd (not the fixture directory) so fixtures stay pristine.
 *
 * The public API says "sandbox" because callers should treat this as an
 * isolated execution root. The on-disk child remains named `worktree` for FE-743
 * compatibility with existing cook artifacts; rename the artifact only when the
 * run-directory lifecycle is revisited.
 *
 * - **fixture mode (default):** the sandbox worktree is an empty directory.
 * - **codebase mode:** the sandbox worktree is a `git worktree add` of
 *   `opts.sourceDir` on a fresh branch `brunch/run/<runId>`. The source branch in
 *   `sourceDir` is left untouched; agent commits land on the run branch.
 *   Branch/worktree cleanup is intentionally operator-owned for now:
 *   `git worktree remove <sandboxDir>` and `git branch -D brunch/run/<runId>`.
 */
export function createSandbox(
  baseDir: string,
  runId?: string,
  opts: CreateSandboxOptions = { mode: 'fixture' },
): SandboxInfo {
  const id = runId ?? randomUUID();
  const runDir = join(baseDir, '.brunch', 'cook', 'runs', id);
  const sandboxDir = join(runDir, 'worktree');

  if (opts.mode === 'codebase') {
    // git worktree add requires the target path NOT to exist; ensure parent
    // exists, then let git create the worktree dir itself.
    mkdirSync(dirname(sandboxDir), { recursive: true });
    if (existsSync(sandboxDir)) {
      rmSync(sandboxDir, { recursive: true, force: true });
    }
    // Reap any stale registration for this path before re-adding (a prior run
    // whose dir was removed out-of-band would otherwise block `worktree add`).
    pruneWorktrees(opts.sourceDir);
    const branch = brunchRef.run(id);
    execFileSync('git', ['worktree', 'add', '-b', branch, sandboxDir, 'HEAD'], {
      cwd: opts.sourceDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    // `git worktree add` only materializes tracked files; CoW-copy untracked /
    // gitignored top-level dirs (e.g. `node_modules/`) from the source cwd so
    // slice seeding and pi-actions see the same runtime deps as the developer tree.
    // If reflinks/clonefile are unavailable, cowCopy falls back to a normal copy:
    // slower and larger on disk, but semantically equivalent.
    copyMissingTopLevelEntries(opts.sourceDir, sandboxDir);
  } else {
    mkdirSync(sandboxDir, { recursive: true });
  }

  return { runId: id, runDir, sandboxDir };
}

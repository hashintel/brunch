import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export type WorktreeInfo = {
  runId: string;
  runDir: string;
  worktreeDir: string;
};

/**
 * Create an isolated run directory under `baseDir/.cook/runs/<runId>/`.
 * `baseDir` should be cwd (not the fixture directory) so fixtures stay pristine.
 */
export function createWorktree(baseDir: string, runId?: string): WorktreeInfo {
  const id = runId ?? randomUUID();
  const runDir = join(baseDir, '.cook', 'runs', id);
  const worktreeDir = join(runDir, 'worktree');
  mkdirSync(worktreeDir, { recursive: true });
  return { runId: id, runDir, worktreeDir };
}

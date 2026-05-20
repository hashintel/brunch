import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export type WorktreeInfo = {
  runId: string;
  worktreeDir: string;
};

export function createWorktree(fixtureDir: string, runId?: string): WorktreeInfo {
  const id = runId ?? randomUUID();
  const worktreeDir = join(fixtureDir, '.cook', 'runs', id, 'worktree');
  mkdirSync(worktreeDir, { recursive: true });
  return { runId: id, worktreeDir };
}

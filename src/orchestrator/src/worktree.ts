import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export type SandboxInfo = {
  runId: string;
  runDir: string;
  sandboxDir: string;
};

/**
 * Create an isolated run directory under `baseDir/.cook/runs/<runId>/`.
 * `baseDir` should be cwd (not the fixture directory) so fixtures stay pristine.
 *
 * The public API says "sandbox" because callers should treat this as an
 * isolated execution root. The on-disk child remains named `worktree` for FE-743
 * compatibility with existing cook artifacts; rename the artifact only when the
 * run-directory lifecycle is revisited.
 */
export function createSandbox(baseDir: string, runId?: string): SandboxInfo {
  const id = runId ?? randomUUID();
  const runDir = join(baseDir, '.cook', 'runs', id);
  const sandboxDir = join(runDir, 'worktree');
  mkdirSync(sandboxDir, { recursive: true });
  return { runId: id, runDir, sandboxDir };
}

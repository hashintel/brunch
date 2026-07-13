import { join } from 'node:path';

import { assertSafeSliceId, runDirPath } from './run.js';

export function sliceWorkspacePath(cwd: string, runId: string, sliceId: string): string {
  assertSafeSliceId(sliceId);
  return join(runDirPath(cwd, runId), 'slice-workspaces', sliceId, 'worktree');
}

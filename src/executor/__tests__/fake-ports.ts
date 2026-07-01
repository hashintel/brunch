import { mkdir } from 'node:fs/promises';

import type { GitWorktreePort } from '../execution-ports.js';

export function createFakeGitWorktreePort(): GitWorktreePort {
  return {
    async create({ worktreeDir, ref }) {
      await mkdir(worktreeDir, { recursive: true });
      return {
        status: 'created',
        worktreeDir,
        sideEffects: [{ kind: 'git_worktree_add', path: worktreeDir, ref }],
      };
    },
  };
}

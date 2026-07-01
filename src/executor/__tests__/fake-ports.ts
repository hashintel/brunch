import { mkdir } from 'node:fs/promises';

import type { GitWorktreePort, TestRunnerPort, TestRunResult } from '../execution-ports.js';

export function createFakeGitWorktreePort(
  create: GitWorktreePort['create'] = async ({ worktreeDir, ref }) => {
    await mkdir(worktreeDir, { recursive: true });
    return {
      status: 'created',
      worktreeDir,
      sideEffects: [{ kind: 'git_worktree_add', path: worktreeDir, ref }],
    };
  },
): GitWorktreePort {
  return { create };
}

export function createFakeTestRunnerPort(
  result: TestRunResult = { status: 'completed', verdict: 'passed', exitCode: 0, target: 'npm run verify' },
): TestRunnerPort {
  return {
    async run() {
      return result;
    },
  };
}

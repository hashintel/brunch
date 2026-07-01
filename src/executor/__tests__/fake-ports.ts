import { mkdir } from 'node:fs/promises';

import type { GitWorktreePort, TestRunnerPort, TestRunResult } from '../execution-ports.js';

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

export function createFakeTestRunnerPort(
  result: TestRunResult = { status: 'completed', verdict: 'passed', exitCode: 0, target: 'npm run verify' },
): TestRunnerPort {
  return {
    async run() {
      return result;
    },
  };
}

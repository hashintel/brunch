import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  GitLandPort,
  GitLandResult,
  GitWorktreePort,
  TestRunnerPort,
  TestRunResult,
} from '../execution-ports.js';

export function createFakeGitWorktreePort(
  create: GitWorktreePort['create'] = async ({ worktreeDir, ref }) => {
    await mkdir(worktreeDir, { recursive: true });
    await writeFile(join(worktreeDir, '.git'), 'gitdir: /tmp/brunch-fake-worktree\n', 'utf8');
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

export function createFakeGitLandPort(
  result: GitLandResult = {
    status: 'promoted',
    commitSha: 'abc123',
    sideEffects: [{ kind: 'git_commit', path: '/worktree', sha: 'abc123' }],
  },
  currentHeadSha = 'base123',
): GitLandPort {
  return {
    async currentHead() {
      return { status: 'ok', commitSha: currentHeadSha };
    },
    async promote() {
      return result;
    },
  };
}

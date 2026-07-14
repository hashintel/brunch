import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  GitHostLandPort,
  GitHostPromotionPort,
  GitLandPort,
  GitLandResult,
  GitSliceIntegrationPort,
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
      createdFromSha: 'workbase123',
      sideEffects: [{ kind: 'git_worktree_add', path: worktreeDir, ref }],
    };
  },
): GitWorktreePort {
  return { create };
}

export function createFakeGitSliceIntegrationPort(
  options: Partial<GitSliceIntegrationPort> = {},
): GitSliceIntegrationPort {
  return {
    prepare:
      options.prepare ??
      (async ({ sliceWorktreeDir }) => {
        await mkdir(sliceWorktreeDir, { recursive: true });
        await writeFile(join(sliceWorktreeDir, '.git'), 'gitdir: /tmp/brunch-fake-slice-worktree\n', 'utf8');
        return {
          status: 'prepared',
          baseSha: 'base123',
          sideEffects: [{ kind: 'git_worktree_add', path: sliceWorktreeDir, ref: 'base123' }],
        };
      }),
    integrate:
      options.integrate ??
      (async ({ runWorktreeDir, sliceWorktreeDir }) => ({
        status: 'integrated',
        sliceCommitSha: 'slice123',
        integrationCommitSha: 'integrated123',
        sideEffects: [
          { kind: 'git_commit', path: sliceWorktreeDir, sha: 'slice123' },
          { kind: 'git_integrate', path: runWorktreeDir, sha: 'integrated123' },
        ],
      })),
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

export function createFakeGitLandPort(
  result: GitLandResult = {
    status: 'promoted',
    commitSha: 'abc123',
    reviewBranch: 'brunch/review/run-1',
    sideEffects: [
      { kind: 'git_commit', path: '/worktree', sha: 'abc123' },
      {
        kind: 'git_ref_create',
        path: '/worktree',
        ref: 'refs/heads/brunch/review/run-1',
        sha: 'abc123',
      },
    ],
  },
  currentHeadSha = 'base123',
  resolvedRefSha = result.status === 'promoted' ? result.commitSha : undefined,
): GitLandPort {
  return {
    async currentHead() {
      return { status: 'ok', commitSha: currentHeadSha };
    },
    async resolveRef() {
      return resolvedRefSha ? { status: 'ok', commitSha: resolvedRefSha } : { status: 'missing' };
    },
    async promote() {
      return result;
    },
  };
}

export function createFakeGitHostLandPort(options: Partial<GitHostLandPort> = {}): GitHostLandPort {
  return {
    async integrate(args) {
      return (
        (await options.integrate?.(args)) ?? {
          status: 'landed',
          via: 'fast_forward',
          branch: 'main',
          landedSha: args.expectedTipSha,
          sideEffects: [
            { kind: 'host_branch_advance', path: args.hostDir, branch: 'main', sha: args.expectedTipSha },
          ],
        }
      );
    },
    async materialize(args) {
      return (
        (await options.materialize?.(args)) ?? {
          status: 'landed',
          branch: args.branch,
          landedSha: 'materialized123',
          targetDir: args.targetDir,
          sideEffects: [
            { kind: 'git_materialize', path: args.targetDir, branch: args.branch, sha: 'materialized123' },
          ],
        }
      );
    },
  };
}

export function createFakeGitHostPromotionPort(options: {
  readonly preflight?: GitHostPromotionPort['preflight'];
  readonly apply?: GitHostPromotionPort['apply'];
}): GitHostPromotionPort {
  return {
    async preflight(args) {
      return (
        (await options.preflight?.(args)) ?? {
          status: 'ok',
          baseSha: 'base123',
          commitSha: args.commitSha,
          changedFiles: ['host-proof.txt'],
          patchSummary: 'host-proof.txt | 1 +',
        }
      );
    },
    async apply(args) {
      return (await options.apply?.(args)) ?? { status: 'applied', changedFiles: args.changedFiles };
    },
  };
}

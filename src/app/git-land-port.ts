import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { GitLandPort } from '../executor/execution-ports.js';
import { runCommand, type CommandRunner } from './command-runner.js';

export function createGitLandPort(options: { readonly run?: CommandRunner } = {}): GitLandPort {
  const run = options.run ?? runCommand;
  return {
    async currentHead(args) {
      const root = await assertExactGitRoot(run, args.worktreeDir);
      if (root) return root;
      const revParse = await run('git', ['rev-parse', 'HEAD'], { cwd: args.worktreeDir });
      if (revParse.exitCode !== 0) return failedHead(revParse, `git rev-parse exited ${revParse.exitCode}`);
      return { status: 'ok', commitSha: revParse.stdout.trim() };
    },
    async resolveRef(args) {
      const root = await assertExactGitRoot(run, args.worktreeDir);
      if (root) return root;
      const result = await run('git', ['rev-parse', '--verify', '--quiet', branchRef(args.ref)], {
        cwd: args.worktreeDir,
      });
      if (result.exitCode === 1) return { status: 'missing' };
      if (result.exitCode !== 0) return failedHead(result, `git rev-parse exited ${result.exitCode}`);
      return { status: 'ok', commitSha: result.stdout.trim() };
    },
    async promote(args) {
      const root = await assertExactGitRoot(run, args.worktreeDir);
      if (root) return { ...root, sideEffects: [] };
      const validBranch = await run('git', ['check-ref-format', '--branch', args.reviewBranch], {
        cwd: args.worktreeDir,
      });
      if (validBranch.exitCode !== 0)
        return failed(validBranch, `invalid review branch ${args.reviewBranch}`);
      const status = await run('git', ['status', '--porcelain'], { cwd: args.worktreeDir });
      if (status.exitCode !== 0) return failed(status, `git status exited ${status.exitCode}`);
      const sideEffects: Array<
        | { readonly kind: 'git_commit'; readonly path: string; readonly sha: string }
        | {
            readonly kind: 'git_ref_create';
            readonly path: string;
            readonly ref: string;
            readonly sha: string;
          }
      > = [];

      if (status.stdout.trim().length > 0) {
        const add = await run('git', ['add', '-A'], { cwd: args.worktreeDir });
        if (add.exitCode !== 0) return failed(add, `git add exited ${add.exitCode}`, sideEffects);

        const commit = await run(
          'git',
          ['-c', 'user.name=brunch', '-c', 'user.email=cook@brunch', 'commit', '-m', args.message],
          { cwd: args.worktreeDir },
        );
        if (commit.exitCode !== 0) return failed(commit, `git commit exited ${commit.exitCode}`, sideEffects);
      }

      const revParse = await run('git', ['rev-parse', 'HEAD'], { cwd: args.worktreeDir });
      if (revParse.exitCode !== 0)
        return failed(revParse, `git rev-parse exited ${revParse.exitCode}`, sideEffects);

      const commitSha = revParse.stdout.trim();
      if (status.stdout.trim().length > 0) {
        sideEffects.push({ kind: 'git_commit', path: args.worktreeDir, sha: commitSha });
      } else if (commitSha === args.baseSha) {
        return {
          status: 'no_changes',
          message: 'no worktree changes to promote',
          commitSha,
          sideEffects: [],
        };
      }

      const ref = branchRef(args.reviewBranch);
      const existing = await run('git', ['rev-parse', '--verify', '--quiet', ref], {
        cwd: args.worktreeDir,
      });
      if (existing.exitCode === 0) {
        if (existing.stdout.trim() !== commitSha) {
          return {
            status: 'failed',
            message: `review branch ${args.reviewBranch} already points at a different commit`,
            sideEffects,
          };
        }
      } else if (existing.exitCode === 1) {
        const create = await run(
          'git',
          ['update-ref', ref, commitSha, '0000000000000000000000000000000000000000'],
          {
            cwd: args.worktreeDir,
          },
        );
        if (create.exitCode !== 0)
          return failed(create, `git update-ref exited ${create.exitCode}`, sideEffects);
        sideEffects.push({ kind: 'git_ref_create', path: args.worktreeDir, ref, sha: commitSha });
      } else {
        return failed(existing, `git rev-parse exited ${existing.exitCode}`, sideEffects);
      }

      return {
        status: 'promoted',
        commitSha,
        reviewBranch: args.reviewBranch,
        sideEffects,
      };
    },
  };
}

async function assertExactGitRoot(run: CommandRunner, worktreeDir: string) {
  const root = await run('git', ['rev-parse', '--show-toplevel'], { cwd: worktreeDir });
  if (root.exitCode !== 0) return failedHead(root, `git rev-parse --show-toplevel exited ${root.exitCode}`);
  const [actualRoot, expectedRoot] = await Promise.all([
    canonicalPath(root.stdout.trim()),
    canonicalPath(worktreeDir),
  ]);
  if (actualRoot !== expectedRoot) {
    return {
      status: 'failed' as const,
      message: `refusing to promote from non-isolated worktree: git root is ${root.stdout.trim()}`,
    };
  }
  return undefined;
}

async function canonicalPath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    return resolve(path);
  }
}

function failedHead(
  result: { readonly stderr: string; readonly stdout: string; readonly spawnError?: string },
  fallback: string,
) {
  return {
    status: 'failed' as const,
    message: result.stderr.trim() || result.stdout.trim() || result.spawnError || fallback,
  };
}

function failed(
  result: { readonly stderr: string; readonly stdout: string; readonly spawnError?: string },
  fallback: string,
  sideEffects: readonly (
    | { readonly kind: 'git_commit'; readonly path: string; readonly sha: string }
    | { readonly kind: 'git_ref_create'; readonly path: string; readonly ref: string; readonly sha: string }
  )[] = [],
) {
  return {
    status: 'failed' as const,
    message: result.stderr.trim() || result.stdout.trim() || result.spawnError || fallback,
    sideEffects,
  };
}

function branchRef(branch: string): string {
  return `refs/heads/${branch}`;
}

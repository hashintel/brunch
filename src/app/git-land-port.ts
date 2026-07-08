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
    async promote(args) {
      const root = await assertExactGitRoot(run, args.worktreeDir);
      if (root) return { ...root, sideEffects: [] };
      const status = await run('git', ['status', '--porcelain'], { cwd: args.worktreeDir });
      if (status.exitCode !== 0) return failed(status, `git status exited ${status.exitCode}`);
      if (status.stdout.trim().length === 0) {
        const revParse = await run('git', ['rev-parse', 'HEAD'], { cwd: args.worktreeDir });
        if (revParse.exitCode !== 0) return failed(revParse, `git rev-parse exited ${revParse.exitCode}`);
        return {
          status: 'no_changes',
          message: 'no worktree changes to promote',
          commitSha: revParse.stdout.trim(),
          sideEffects: [],
        };
      }

      const add = await run('git', ['add', '-A'], { cwd: args.worktreeDir });
      if (add.exitCode !== 0) return failed(add, `git add exited ${add.exitCode}`);

      const commit = await run(
        'git',
        ['-c', 'user.name=brunch', '-c', 'user.email=cook@brunch', 'commit', '-m', args.message],
        { cwd: args.worktreeDir },
      );
      if (commit.exitCode !== 0) return failed(commit, `git commit exited ${commit.exitCode}`);

      const revParse = await run('git', ['rev-parse', 'HEAD'], { cwd: args.worktreeDir });
      if (revParse.exitCode !== 0) return failed(revParse, `git rev-parse exited ${revParse.exitCode}`);

      const commitSha = revParse.stdout.trim();
      return {
        status: 'promoted',
        commitSha,
        sideEffects: [{ kind: 'git_commit', path: args.worktreeDir, sha: commitSha }],
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
) {
  return {
    status: 'failed' as const,
    message: result.stderr.trim() || result.stdout.trim() || result.spawnError || fallback,
    sideEffects: [] as const,
  };
}

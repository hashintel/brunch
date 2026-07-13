import { access, mkdir, realpath } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import type { GitSliceIntegrateEffect, GitSliceIntegrationPort } from '../executor/execution-ports.js';
import { runCommand, type CommandResult, type CommandRunner } from './command-runner.js';

const GIT_TIMEOUT_MS = 30_000;
const GIT_MAX_OUTPUT_BYTES = 32 * 1024;
const GIT_AUTHOR = ['-c', 'user.name=brunch', '-c', 'user.email=cook@brunch'] as const;

export function createGitSliceIntegrationPort(
  options: {
    readonly run?: CommandRunner;
  } = {},
): GitSliceIntegrationPort {
  const run = options.run ?? runCommand;
  const command = (cwd: string, args: readonly string[]) =>
    run('git', args, { cwd, timeoutMs: GIT_TIMEOUT_MS, maxOutputBytes: GIT_MAX_OUTPUT_BYTES });

  return {
    async prepare(args) {
      const rootFailure = await exactRootFailure(command, args.runWorktreeDir);
      if (rootFailure) return { status: 'failed', message: rootFailure, sideEffects: [] };
      if (await pathExists(args.sliceWorktreeDir)) {
        const sliceRootFailure = await exactRootFailure(command, args.sliceWorktreeDir);
        if (sliceRootFailure) return { status: 'failed', message: sliceRootFailure, sideEffects: [] };
        const existingHead = await command(args.sliceWorktreeDir, ['rev-parse', 'HEAD']);
        return existingHead.exitCode === 0
          ? { status: 'prepared', baseSha: existingHead.stdout.trim(), sideEffects: [] }
          : {
              status: 'failed',
              message: message(existingHead, 'cannot resolve slice workspace HEAD'),
              sideEffects: [],
            };
      }
      const head = await command(args.runWorktreeDir, ['rev-parse', 'HEAD']);
      if (head.exitCode !== 0) {
        return {
          status: 'failed',
          message: message(head, 'cannot resolve run workspace HEAD'),
          sideEffects: [],
        };
      }
      const baseSha = head.stdout.trim();
      await mkdir(dirname(args.sliceWorktreeDir), { recursive: true });
      const added = await command(args.runWorktreeDir, [
        'worktree',
        'add',
        '--detach',
        args.sliceWorktreeDir,
        baseSha,
      ]);
      if (added.exitCode !== 0) {
        return { status: 'failed', message: message(added, 'cannot create slice worktree'), sideEffects: [] };
      }
      return {
        status: 'prepared',
        baseSha,
        sideEffects: [{ kind: 'git_worktree_add', path: args.sliceWorktreeDir, ref: baseSha }],
      };
    },

    async integrate(args) {
      const effects: GitSliceIntegrateEffect[] = [];
      const runRootFailure = await exactRootFailure(command, args.runWorktreeDir);
      if (runRootFailure) return { status: 'failed', message: runRootFailure, sideEffects: effects };
      const sliceRootFailure = await exactRootFailure(command, args.sliceWorktreeDir);
      if (sliceRootFailure) return { status: 'failed', message: sliceRootFailure, sideEffects: effects };

      const status = await command(args.sliceWorktreeDir, ['status', '--porcelain']);
      if (status.exitCode !== 0) return failed(status, 'cannot inspect slice worktree', effects);
      if (status.stdout.trim()) {
        const added = await command(args.sliceWorktreeDir, ['add', '-A']);
        if (added.exitCode !== 0) return failed(added, 'cannot stage slice output', effects);
        const committed = await command(args.sliceWorktreeDir, [
          ...GIT_AUTHOR,
          'commit',
          '-m',
          `brunch: slice ${args.sliceId}`,
        ]);
        if (committed.exitCode !== 0) return failed(committed, 'cannot commit slice output', effects);
      }

      const sliceHead = await command(args.sliceWorktreeDir, ['rev-parse', 'HEAD']);
      if (sliceHead.exitCode !== 0) return failed(sliceHead, 'cannot resolve slice commit', effects);
      const sliceCommitSha = sliceHead.stdout.trim();
      if (sliceCommitSha !== args.baseSha) {
        effects.push({ kind: 'git_commit', path: args.sliceWorktreeDir, sha: sliceCommitSha });
      }
      const ancestry = await command(args.sliceWorktreeDir, [
        'merge-base',
        '--is-ancestor',
        args.baseSha,
        sliceCommitSha,
      ]);
      if (ancestry.exitCode !== 0) {
        return {
          status: 'failed',
          message: 'slice workspace no longer descends from its recorded base',
          sideEffects: effects,
        };
      }

      const runHead = await command(args.runWorktreeDir, ['rev-parse', 'HEAD']);
      if (runHead.exitCode !== 0) return failed(runHead, 'cannot resolve run workspace HEAD', effects);
      const merged = await command(args.runWorktreeDir, [
        'merge-tree',
        '--write-tree',
        runHead.stdout.trim(),
        sliceCommitSha,
      ]);
      if (merged.exitCode !== 0) {
        return {
          status: 'conflict',
          message:
            merged.stderr.trim() || merged.stdout.trim() || 'slice output conflicts with run workspace',
          sideEffects: effects,
        };
      }
      const treeSha = merged.stdout.trim().split('\n')[0];
      if (!treeSha)
        return { status: 'failed', message: 'git merge-tree returned no tree', sideEffects: effects };

      const integration = await command(args.runWorktreeDir, [
        ...GIT_AUTHOR,
        'commit-tree',
        treeSha,
        '-p',
        runHead.stdout.trim(),
        '-m',
        `brunch: integrate slice ${args.sliceId}`,
      ]);
      if (integration.exitCode !== 0) return failed(integration, 'cannot create integration commit', effects);
      const integrationCommitSha = integration.stdout.trim();
      const applied = await command(args.runWorktreeDir, ['merge', '--ff-only', integrationCommitSha]);
      if (applied.exitCode !== 0) return failed(applied, 'cannot apply preflighted integration', effects);
      effects.push({ kind: 'git_integrate', path: args.runWorktreeDir, sha: integrationCommitSha });
      return { status: 'integrated', sliceCommitSha, integrationCommitSha, sideEffects: effects };
    },
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function exactRootFailure(
  command: (cwd: string, args: readonly string[]) => Promise<CommandResult>,
  worktreeDir: string,
): Promise<string | undefined> {
  const root = await command(worktreeDir, ['rev-parse', '--show-toplevel']);
  if (root.exitCode !== 0) return message(root, 'cannot resolve git worktree root');
  const [actual, expected] = await Promise.all([
    canonicalPath(root.stdout.trim()),
    canonicalPath(worktreeDir),
  ]);
  return actual === expected
    ? undefined
    : `refusing non-isolated git workspace: git root is ${root.stdout.trim()}`;
}

async function canonicalPath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    return resolve(path);
  }
}

function message(result: CommandResult, fallback: string): string {
  return result.stderr.trim() || result.stdout.trim() || result.spawnError || fallback;
}

function failed(result: CommandResult, fallback: string, sideEffects: readonly GitSliceIntegrateEffect[]) {
  return { status: 'failed' as const, message: message(result, fallback), sideEffects };
}

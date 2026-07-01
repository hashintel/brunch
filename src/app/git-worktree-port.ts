import type { GitWorktreePort } from '../executor/execution-ports.js';
import { runCommand, type CommandRunner } from './command-runner.js';

const GIT_WORKTREE_TIMEOUT_MS = 30_000;
const GIT_WORKTREE_MAX_OUTPUT_BYTES = 16 * 1024;

export function createGitWorktreePort(options: { readonly run?: CommandRunner } = {}): GitWorktreePort {
  const run = options.run ?? runCommand;
  return {
    async create(args) {
      const result = await run('git', ['worktree', 'add', '--detach', args.worktreeDir, args.ref], {
        cwd: args.cwd,
        signal: args.signal,
        timeoutMs: GIT_WORKTREE_TIMEOUT_MS,
        maxOutputBytes: GIT_WORKTREE_MAX_OUTPUT_BYTES,
      });
      if (result.aborted) {
        return {
          status: 'failed',
          worktreeDir: args.worktreeDir,
          message: 'git worktree add aborted',
          sideEffects: [],
        };
      }
      if (result.timedOut) {
        return {
          status: 'failed',
          worktreeDir: args.worktreeDir,
          message: `git worktree add timed out after ${GIT_WORKTREE_TIMEOUT_MS}ms`,
          sideEffects: [],
        };
      }
      if (result.exitCode !== 0) {
        return {
          status: 'failed',
          worktreeDir: args.worktreeDir,
          message:
            result.stderr.trim() ||
            result.stdout.trim() ||
            result.spawnError ||
            `git worktree add exited ${result.exitCode}`,
          sideEffects: [],
        };
      }

      return {
        status: 'created',
        worktreeDir: args.worktreeDir,
        sideEffects: [{ kind: 'git_worktree_add', path: args.worktreeDir, ref: args.ref }],
      };
    },
  };
}

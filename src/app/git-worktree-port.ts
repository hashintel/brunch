import type { GitWorktreePort } from '../executor/execution-ports.js';
import { runCommand, type CommandRunner } from './command-runner.js';

export function createGitWorktreePort(options: { readonly run?: CommandRunner } = {}): GitWorktreePort {
  const run = options.run ?? runCommand;
  return {
    async create(args) {
      const result = await run('git', ['worktree', 'add', '--detach', args.worktreeDir, args.ref], {
        cwd: args.cwd,
      });
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

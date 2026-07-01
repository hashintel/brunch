import type { GitLandPort } from '../executor/execution-ports.js';
import { runCommand, type CommandRunner } from './command-runner.js';

export function createGitLandPort(options: { readonly run?: CommandRunner } = {}): GitLandPort {
  const run = options.run ?? runCommand;
  return {
    async promote(args) {
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

      const commit = await run('git', ['commit', '-m', args.message], { cwd: args.worktreeDir });
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

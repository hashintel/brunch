import type { GitHostPromotionPort } from '../executor/execution-ports.js';
import { runCommand, type CommandRunner } from './command-runner.js';

export function createGitHostPromotionPort(
  options: { readonly run?: CommandRunner } = {},
): GitHostPromotionPort {
  const run = options.run ?? runCommand;
  return {
    async preflight(args) {
      const exists = await run('git', ['cat-file', '-e', `${args.commitSha}^{commit}`], {
        cwd: args.worktreeDir,
      });
      if (exists.exitCode !== 0) return failed(exists, `git cat-file exited ${exists.exitCode}`);

      const base = await run('git', ['rev-parse', `${args.commitSha}^`], { cwd: args.worktreeDir });
      if (base.exitCode !== 0) return failed(base, `git rev-parse exited ${base.exitCode}`);
      const baseSha = base.stdout.trim();

      const names = await run('git', ['diff', '--name-only', baseSha, args.commitSha], {
        cwd: args.worktreeDir,
      });
      if (names.exitCode !== 0) return failed(names, `git diff --name-only exited ${names.exitCode}`);

      const stat = await run('git', ['diff', '--stat', '--summary', baseSha, args.commitSha], {
        cwd: args.worktreeDir,
      });
      if (stat.exitCode !== 0) return failed(stat, `git diff --stat exited ${stat.exitCode}`);

      return {
        status: 'ok',
        baseSha,
        commitSha: args.commitSha,
        changedFiles: names.stdout
          .split('\n')
          .map((file) => file.trim())
          .filter(Boolean),
        patchSummary: stat.stdout
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .join('\n'),
      };
    },
    async apply(args) {
      // --no-ext-diff: the output must be an applyable patch, so bypass any
      // user-configured external differ (e.g. a semantic diff wrapper), which
      // would otherwise replace the patch body with human-oriented output.
      const patch = await run('git', ['diff', '--no-ext-diff', '--binary', args.baseSha, args.commitSha], {
        cwd: args.worktreeDir,
      });
      if (patch.exitCode !== 0) return failed(patch, `git diff --binary exited ${patch.exitCode}`);

      const check = await run('git', ['apply', '--check', '-'], { cwd: args.cwd, stdin: patch.stdout });
      if (check.exitCode !== 0) return failed(check, `git apply --check exited ${check.exitCode}`);

      const apply = await run('git', ['apply', '-'], { cwd: args.cwd, stdin: patch.stdout });
      if (apply.exitCode !== 0) return failed(apply, `git apply exited ${apply.exitCode}`);

      return { status: 'applied', changedFiles: args.changedFiles };
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
  };
}

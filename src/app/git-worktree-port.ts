import { spawn } from 'node:child_process';

import type { GitWorktreePort } from '../executor/execution-ports.js';

interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

interface CommandRunnerOptions {
  readonly cwd: string;
}

type CommandRunner = (
  command: string,
  args: readonly string[],
  options: CommandRunnerOptions,
) => Promise<CommandResult>;

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
            result.stderr.trim() || result.stdout.trim() || `git worktree add exited ${result.exitCode}`,
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

async function runCommand(
  command: string,
  args: readonly string[],
  options: CommandRunnerOptions,
): Promise<CommandResult> {
  return await new Promise((resolve) => {
    const child = spawn(command, [...args], { cwd: options.cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      resolve({ exitCode: 1, stdout, stderr: error.message });
    });
    child.on('close', (code) => {
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}

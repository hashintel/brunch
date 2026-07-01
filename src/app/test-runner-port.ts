import { spawn } from 'node:child_process';

import type { TestRunnerPort } from '../executor/execution-ports.js';

interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly spawnError?: string;
}

interface CommandRunnerOptions {
  readonly cwd: string;
}

type CommandRunner = (
  command: string,
  args: readonly string[],
  options: CommandRunnerOptions,
) => Promise<CommandResult>;

export function createTestRunnerPort(
  options: {
    readonly run?: CommandRunner;
    readonly command?: string;
    readonly args?: readonly string[];
  } = {},
): TestRunnerPort {
  const run = options.run ?? runCommand;
  const command = options.command ?? 'npm';
  const args = options.args ?? ['run', 'verify'];
  const target = [command, ...args].join(' ');
  return {
    async run({ worktreeDir }) {
      const result = await run(command, args, { cwd: worktreeDir });
      if (result.spawnError !== undefined) {
        return { status: 'failed', message: result.spawnError };
      }
      return {
        status: 'completed',
        verdict: result.exitCode === 0 ? 'passed' : 'failed',
        exitCode: result.exitCode,
        target,
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
      resolve({ exitCode: 1, stdout, stderr, spawnError: error.message });
    });
    child.on('close', (code) => {
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}

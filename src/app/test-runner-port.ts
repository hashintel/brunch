import type { TestRunnerPort } from '../executor/execution-ports.js';
import { runCommand, type CommandRunner } from './command-runner.js';

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

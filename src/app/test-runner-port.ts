import type { TestRunnerPort } from '../executor/execution-ports.js';
import { runCommand, type CommandRunner } from './command-runner.js';

const TEST_RUNNER_TIMEOUT_MS = 10 * 60_000;
const TEST_RUNNER_MAX_OUTPUT_BYTES = 128 * 1024;

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
    async run({ worktreeDir, signal }) {
      const result = await run(command, args, {
        cwd: worktreeDir,
        signal,
        timeoutMs: TEST_RUNNER_TIMEOUT_MS,
        maxOutputBytes: TEST_RUNNER_MAX_OUTPUT_BYTES,
      });
      if (result.aborted) {
        return { status: 'failed', message: `${target} aborted` };
      }
      if (result.timedOut) {
        return { status: 'failed', message: `${target} timed out after ${TEST_RUNNER_TIMEOUT_MS}ms` };
      }
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

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
  return {
    async run({ worktreeDir, verifyTarget, signal, onUpdate }) {
      const command = verifyTarget?.command ?? options.command ?? 'npm';
      const args = verifyTarget?.args ?? options.args ?? ['run', 'verify'];
      const target = [command, ...args].join(' ');
      const execArgs = command === 'npm' ? ['--prefix', worktreeDir, ...args] : args;
      await onUpdate?.({ kind: 'status', message: `${target} started` });
      let outputUpdateChain: Promise<void> = Promise.resolve();
      const queueOutputUpdate = (chunk: { readonly stream: 'stdout' | 'stderr'; readonly text: string }) => {
        outputUpdateChain = outputUpdateChain.then(async () => {
          await onUpdate?.({ kind: chunk.stream, message: chunk.text });
        });
      };
      const result = await run(command, execArgs, {
        cwd: worktreeDir,
        signal,
        timeoutMs: TEST_RUNNER_TIMEOUT_MS,
        maxOutputBytes: TEST_RUNNER_MAX_OUTPUT_BYTES,
        onOutput: queueOutputUpdate,
      });
      await outputUpdateChain;
      if (result.aborted) {
        await onUpdate?.({ kind: 'status', message: `${target} aborted` });
        return { status: 'failed', message: `${target} aborted` };
      }
      if (result.timedOut) {
        await onUpdate?.({ kind: 'status', message: `${target} timed out` });
        return { status: 'failed', message: `${target} timed out after ${TEST_RUNNER_TIMEOUT_MS}ms` };
      }
      if (result.spawnError !== undefined) {
        await onUpdate?.({ kind: 'status', message: `${target} failed to start` });
        return { status: 'failed', message: result.spawnError };
      }
      await onUpdate?.({ kind: 'status', message: `${target} exited ${result.exitCode}` });
      return {
        status: 'completed',
        verdict: result.exitCode === 0 ? 'passed' : 'failed',
        exitCode: result.exitCode,
        target,
      };
    },
  };
}

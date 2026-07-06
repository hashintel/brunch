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
  return {
    async run({ worktreeDir, signal, verifyCommand, onUpdate }) {
      const commandParts = commandPartsForRun({ command, args }, verifyCommand);
      const target = commandParts.join(' ');
      await onUpdate?.({ kind: 'status', message: `${target} started` });
      const result = await run(commandParts[0], commandParts.slice(1), {
        cwd: worktreeDir,
        signal,
        timeoutMs: TEST_RUNNER_TIMEOUT_MS,
        maxOutputBytes: TEST_RUNNER_MAX_OUTPUT_BYTES,
        onOutput: (chunk) => {
          void onUpdate?.({ kind: chunk.stream, message: chunk.text });
        },
      });
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

function commandPartsForRun(
  fallback: { readonly command: string; readonly args: readonly string[] },
  verifyCommand: readonly string[] | undefined,
): readonly [string, ...string[]] {
  if (verifyCommand && verifyCommand.length > 0) return [verifyCommand[0]!, ...verifyCommand.slice(1)];
  return [fallback.command, ...fallback.args];
}

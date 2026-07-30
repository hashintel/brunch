import type { ResolvedExecutionActions } from '../executor/execution-contract.js';
import type { ExecutionActionResult, TestRunnerPort, VerifyTarget } from '../executor/execution-ports.js';
import { runCommand, type CommandRunner } from './command-runner.js';

const TEST_RUNNER_TIMEOUT_MS = 10 * 60_000;
const TEST_RUNNER_MAX_OUTPUT_BYTES = 128 * 1024;

export function createTestRunnerPort(
  options: {
    readonly run?: CommandRunner;
  } = {},
): TestRunnerPort {
  const run = options.run ?? runCommand;
  return {
    async run({ worktreeDir, executionActions, verifyTarget, signal, onUpdate }) {
      // The admitted execution contract is the only command source. The
      // verifyTarget fallback keeps older direct core fixtures focused on one
      // verification command; product run creation always supplies the full gate.
      const actions = executionActions
        ? flattenExecutionActions(executionActions)
        : verifyTarget
          ? [{ phase: 'verify' as const, action: verifyTarget }]
          : [];
      if (actions.length === 0) {
        const message = 'no verify target configured for this run';
        await onUpdate?.({ kind: 'status', message });
        return { status: 'failed', message };
      }
      const target = actions.map(({ action }) => formatTarget(action)).join(' && ');
      const actionResults: ExecutionActionResult[] = [];
      let outputUpdateChain: Promise<void> = Promise.resolve();
      const queueOutputUpdate = (chunk: { readonly stream: 'stdout' | 'stderr'; readonly text: string }) => {
        outputUpdateChain = outputUpdateChain.then(async () => {
          await onUpdate?.({ kind: chunk.stream, message: chunk.text });
        });
      };
      for (const { phase, action } of actions) {
        const actionTarget = formatTarget(action);
        await onUpdate?.({ kind: 'status', message: `${actionTarget} started` });
        const result = await run(action.command, action.args, {
          cwd: worktreeDir,
          signal,
          timeoutMs: TEST_RUNNER_TIMEOUT_MS,
          maxOutputBytes: TEST_RUNNER_MAX_OUTPUT_BYTES,
          onOutput: queueOutputUpdate,
        });
        await outputUpdateChain;
        if (result.aborted) {
          await onUpdate?.({ kind: 'status', message: `${actionTarget} aborted` });
          return { status: 'failed', message: `${actionTarget} aborted` };
        }
        if (result.timedOut) {
          await onUpdate?.({ kind: 'status', message: `${actionTarget} timed out` });
          return {
            status: 'failed',
            message: `${actionTarget} timed out after ${TEST_RUNNER_TIMEOUT_MS}ms`,
          };
        }
        if (result.spawnError !== undefined) {
          await onUpdate?.({ kind: 'status', message: `${actionTarget} failed to start` });
          return { status: 'failed', message: result.spawnError };
        }
        const verdict = result.exitCode === 0 ? 'passed' : 'failed';
        actionResults.push({
          phase,
          command: action.command,
          args: action.args,
          exitCode: result.exitCode,
          verdict,
        });
        await onUpdate?.({ kind: 'status', message: `${actionTarget} exited ${result.exitCode}` });
        if (verdict === 'failed') {
          return {
            status: 'completed',
            verdict,
            exitCode: result.exitCode,
            target,
            ...(executionActions ? { actions: actionResults } : {}),
          };
        }
      }
      return {
        status: 'completed',
        verdict: 'passed',
        exitCode: 0,
        target,
        ...(executionActions ? { actions: actionResults } : {}),
      };
    },
  };
}

function flattenExecutionActions(
  actions: ResolvedExecutionActions,
): readonly { readonly phase: keyof ResolvedExecutionActions; readonly action: VerifyTarget }[] {
  return (['setup', 'build', 'verify'] as const).flatMap((phase) =>
    actions[phase].map((action) => ({
      phase,
      action: { command: action.command, args: action.args },
    })),
  );
}

function formatTarget(action: VerifyTarget): string {
  return [action.command, ...action.args].join(' ');
}

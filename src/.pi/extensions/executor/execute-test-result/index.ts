import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import type { TestRunnerPort } from '../../../../executor/execution-ports.js';
import { ingestTestResult, type TestResultIngestResult } from '../../../../executor/test-result.js';
import { BRUNCH_EXECUTE_TEST_RESULT_TOOL } from '../../../../session/schema/tool-names.js';
import { toolParameters } from '../../shared/tool-schema.js';

export { BRUNCH_EXECUTE_TEST_RESULT_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteTestResultParams = Type.Object({
  runId: Type.String({ description: 'Run id whose active slice has an ingested agent result.' }),
});

type ExecuteTestResultParams = Static<typeof ExecuteTestResultParams>;

interface ExecuteTestResultDetails {
  readonly result: TestResultIngestResult;
  readonly sideEffects: TestResultIngestResult['sideEffects'];
}

export function createExecuteTestResultTool(
  testRunner: TestRunnerPort,
): ToolDefinition<typeof ExecuteTestResultParams, ExecuteTestResultDetails> {
  return {
    name: BRUNCH_EXECUTE_TEST_RESULT_TOOL,
    label: 'execute_test_result',
    description:
      'Run the verify subprocess for the active slice in its worktree and ingest the true result. Does not create Petri artifacts.',
    parameters: toolParameters(ExecuteTestResultParams),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_test_result requires an active cwd');
      }
      const result = await ingestTestResult({ cwd, runId: params.runId, testRunner, signal });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_test_result: ${result.status}`,
              `run status: ${result.runStatus}`,
              `run id: ${result.runId}`,
              `side effects: ${result.sideEffects.map((effect) => effect.kind).join(', ') || 'none'}`,
            ].join('\n'),
          },
        ],
        details: { result, sideEffects: result.sideEffects },
      };
    },
  };
}

export function registerBrunchExecuteTestResult(pi: ExtensionAPI, testRunner: TestRunnerPort): void {
  pi.registerTool(createExecuteTestResultTool(testRunner) as never);
}

export default registerBrunchExecuteTestResult;

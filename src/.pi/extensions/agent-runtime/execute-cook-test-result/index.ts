import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { ingestCookTestResult, type CookTestResultIngestResult } from '../../../../executor/test-result.js';
import { BRUNCH_EXECUTE_COOK_TEST_RESULT_TOOL } from '../../../../session/schema/tool-names.js';

export { BRUNCH_EXECUTE_COOK_TEST_RESULT_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteCookTestResultParams = Type.Object({
  runId: Type.String({ description: 'Cook run id whose active slice has an ingested agent result.' }),
});

type ExecuteCookTestResultParams = Static<typeof ExecuteCookTestResultParams>;

interface ExecuteCookTestResultDetails {
  readonly result: CookTestResultIngestResult;
  readonly sideEffects: CookTestResultIngestResult['sideEffects'];
}

export function createExecuteCookTestResultTool(): ToolDefinition<
  typeof ExecuteCookTestResultParams,
  ExecuteCookTestResultDetails
> {
  return {
    name: BRUNCH_EXECUTE_COOK_TEST_RESULT_TOOL,
    label: 'execute_cook_test_result',
    description:
      'Ingest a prewritten test result for the active slice. Does not run tests or create Petri artifacts.',
    parameters: ExecuteCookTestResultParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_cook_test_result requires an active cwd');
      }
      const result = await ingestCookTestResult({ cwd, runId: params.runId });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_cook_test_result: ${result.status}`,
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

export function registerBrunchExecuteCookTestResult(pi: ExtensionAPI): void {
  pi.registerTool(createExecuteCookTestResultTool() as never);
}

export default registerBrunchExecuteCookTestResult;

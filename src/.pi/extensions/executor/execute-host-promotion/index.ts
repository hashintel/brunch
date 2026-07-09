import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import type { GitHostPromotionPort } from '../../../../executor/execution-ports.js';
import {
  applyHostPromotion,
  preflightHostPromotion,
  type HostPromotionApplyResult,
  type HostPromotionPreflightResult,
} from '../../../../executor/host-promotion.js';
import {
  BRUNCH_EXECUTE_HOST_PROMOTION_APPLY_TOOL,
  BRUNCH_EXECUTE_HOST_PROMOTION_PREFLIGHT_TOOL,
} from '../../../../session/schema/tool-names.js';
import { toolParameters } from '../../shared/tool-schema.js';

export {
  BRUNCH_EXECUTE_HOST_PROMOTION_APPLY_TOOL,
  BRUNCH_EXECUTE_HOST_PROMOTION_PREFLIGHT_TOOL,
} from '../../../../session/schema/tool-names.js';

const ExecuteHostPromotionPreflightParams = Type.Object({ runId: Type.String() });
type ExecuteHostPromotionPreflightParams = Static<typeof ExecuteHostPromotionPreflightParams>;

const ExecuteHostPromotionApplyParams = Type.Object({
  runId: Type.String(),
  acceptedCommitSha: Type.Optional(Type.String()),
});
type ExecuteHostPromotionApplyParams = Static<typeof ExecuteHostPromotionApplyParams>;

interface ExecuteHostPromotionPreflightDetails {
  readonly result: HostPromotionPreflightResult;
  readonly sideEffects: HostPromotionPreflightResult['sideEffects'];
}

interface ExecuteHostPromotionApplyDetails {
  readonly result: HostPromotionApplyResult;
  readonly sideEffects: HostPromotionApplyResult['sideEffects'];
}

export function createExecuteHostPromotionPreflightTool(
  gitHostPromotion: GitHostPromotionPort,
): ToolDefinition<typeof ExecuteHostPromotionPreflightParams, ExecuteHostPromotionPreflightDetails> {
  return {
    name: BRUNCH_EXECUTE_HOST_PROMOTION_PREFLIGHT_TOOL,
    label: 'execute_host_promotion_preflight',
    description:
      'Inspect a run-local promotion and report the host diff that can be applied. Does not mutate host files, refs, branches, or index state.',
    parameters: toolParameters(ExecuteHostPromotionPreflightParams),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0)
        throw new Error('execute_host_promotion_preflight requires an active cwd');
      const result = await preflightHostPromotion({ cwd, runId: params.runId, gitHostPromotion });
      return {
        content: [{ type: 'text' as const, text: renderResult('execute_host_promotion_preflight', result) }],
        details: { result, sideEffects: result.sideEffects },
      };
    },
  };
}

export function createExecuteHostPromotionApplyTool(
  gitHostPromotion: GitHostPromotionPort,
): ToolDefinition<typeof ExecuteHostPromotionApplyParams, ExecuteHostPromotionApplyDetails> {
  return {
    name: BRUNCH_EXECUTE_HOST_PROMOTION_APPLY_TOOL,
    label: 'execute_host_promotion_apply',
    description:
      'Apply an accepted run-local promotion patch to host files. Requires acceptedCommitSha; does not commit, create refs, switch branches, or stage the host index.',
    parameters: toolParameters(ExecuteHostPromotionApplyParams),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0)
        throw new Error('execute_host_promotion_apply requires an active cwd');
      const result = await applyHostPromotion({
        cwd,
        runId: params.runId,
        ...(params.acceptedCommitSha === undefined ? {} : { acceptedCommitSha: params.acceptedCommitSha }),
        gitHostPromotion,
      });
      return {
        content: [{ type: 'text' as const, text: renderResult('execute_host_promotion_apply', result) }],
        details: { result, sideEffects: result.sideEffects },
      };
    },
  };
}

export function registerBrunchExecuteHostPromotion(
  pi: ExtensionAPI,
  gitHostPromotion: GitHostPromotionPort,
): void {
  pi.registerTool(createExecuteHostPromotionPreflightTool(gitHostPromotion) as never);
  pi.registerTool(createExecuteHostPromotionApplyTool(gitHostPromotion) as never);
}

function renderResult(
  label: string,
  result: HostPromotionPreflightResult | HostPromotionApplyResult,
): string {
  const changedFiles = 'changedFiles' in result ? result.changedFiles.join(', ') || 'none' : 'n/a';
  return [
    `${label}: ${result.status}`,
    'runStatus' in result ? `run status: ${result.runStatus}` : undefined,
    `run id: ${result.runId}`,
    `changed files: ${changedFiles}`,
    `side effects: ${result.sideEffects.map((effect) => effect.kind).join(', ') || 'none'}`,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

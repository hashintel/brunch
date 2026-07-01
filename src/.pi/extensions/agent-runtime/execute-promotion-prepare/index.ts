import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { prepareCookPromotion, type CookPromotionPrepareResult } from '../../../../executor/promotion.js';
import { BRUNCH_EXECUTE_PROMOTION_PREPARE_TOOL } from '../../../../session/schema/tool-names.js';

export { BRUNCH_EXECUTE_PROMOTION_PREPARE_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteCookPromotionPrepareParams = Type.Object({ runId: Type.String() });
type ExecuteCookPromotionPrepareParams = Static<typeof ExecuteCookPromotionPrepareParams>;
interface ExecuteCookPromotionPrepareDetails {
  readonly result: CookPromotionPrepareResult;
  readonly sideEffects: CookPromotionPrepareResult['sideEffects'];
}

export function createExecuteCookPromotionPrepareTool(): ToolDefinition<
  typeof ExecuteCookPromotionPrepareParams,
  ExecuteCookPromotionPrepareDetails
> {
  return {
    name: BRUNCH_EXECUTE_PROMOTION_PREPARE_TOOL,
    label: 'execute_promotion_prepare',
    description:
      'Prepare a descriptive promotion report for a Petri-exported cook run. Does not create a git branch, promotion ref, or worktree mutation; does not land.',
    parameters: ExecuteCookPromotionPrepareParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0)
        throw new Error('execute_promotion_prepare requires an active cwd');
      const result = await prepareCookPromotion({ cwd, runId: params.runId });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_promotion_prepare: ${result.status}`,
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

export function registerBrunchExecuteCookPromotionPrepare(pi: ExtensionAPI): void {
  pi.registerTool(createExecuteCookPromotionPrepareTool() as never);
}
export default registerBrunchExecuteCookPromotionPrepare;

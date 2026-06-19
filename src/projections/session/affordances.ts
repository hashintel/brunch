import type { ElicitationGap } from '../../graph/schema/elicitation-gaps.js';
import type {
  AgentLensId,
  AgentLensSelection,
  AgentStrategyId,
  AgentStrategySelection,
} from '../../session/schema/kinds.js';
import {
  axisOptionsForRuntimeState,
  defaultLensForRuntimeState,
  defaultStrategyForRuntimeState,
  type ResolvedBrunchAgentState,
} from './runtime-policy.js';

interface AxisAffordance<TId extends string, TSelection extends 'auto' | TId> {
  readonly selection: TSelection;
  readonly legalOptions: readonly TId[];
  readonly defaultOnSwitch: TSelection;
}

export interface RuntimeAffordances {
  readonly strategy: AxisAffordance<AgentStrategyId, AgentStrategySelection>;
  readonly lens: AxisAffordance<AgentLensId, AgentLensSelection>;
}

export function affordances(
  state: ResolvedBrunchAgentState,
  gaps: readonly ElicitationGap[],
): RuntimeAffordances {
  return {
    strategy: {
      selection: state.agentStrategy,
      legalOptions: axisOptionsForRuntimeState('strategy', state, gaps),
      defaultOnSwitch: defaultStrategyForRuntimeState(state),
    },
    lens: {
      selection: state.agentLens,
      legalOptions: axisOptionsForRuntimeState('lens', state, gaps),
      defaultOnSwitch: defaultLensForRuntimeState(state),
    },
  };
}

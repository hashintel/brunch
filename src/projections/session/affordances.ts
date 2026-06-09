import type { ReadinessGrade } from '../../graph/index.js';
import type {
  AgentGoalId,
  AgentGoalSelection,
  AgentLensId,
  AgentLensSelection,
  AgentStrategyId,
  AgentStrategySelection,
} from '../../session/runtime-state.js';
import {
  axisOptionsForRuntimeState,
  defaultGoalForRuntimeState,
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
  readonly goal: AxisAffordance<AgentGoalId, AgentGoalSelection>;
  readonly strategy: AxisAffordance<AgentStrategyId, AgentStrategySelection>;
  readonly lens: AxisAffordance<AgentLensId, AgentLensSelection>;
}

export function affordances(
  state: ResolvedBrunchAgentState,
  readinessGrade: ReadinessGrade,
): RuntimeAffordances {
  return {
    goal: {
      selection: state.agentGoal,
      legalOptions: axisOptionsForRuntimeState('goal', state, readinessGrade),
      defaultOnSwitch: defaultGoalForRuntimeState(state),
    },
    strategy: {
      selection: state.agentStrategy,
      legalOptions: axisOptionsForRuntimeState('strategy', state, readinessGrade),
      defaultOnSwitch: defaultStrategyForRuntimeState(state),
    },
    lens: {
      selection: state.agentLens,
      legalOptions: axisOptionsForRuntimeState('lens', state, readinessGrade),
      defaultOnSwitch: defaultLensForRuntimeState(state),
    },
  };
}

import type { ResolvedBrunchAgentState } from '../../projections/session/runtime-state.js';
import type { ElicitationStyle } from '../../session/elicitation-style.js';
import type { AgentPromptSpecContext, AgentPromptWorkspaceContext } from '../contexts/seeds/turn-context.js';
import { activeToolNamesForLiveElicitor, type LiveElicitorToolPolicyInput } from './elicitor/active-tools.js';
import { composeLiveElicitorPrompt } from './elicitor/compose-live-prompt.js';
import type { LiveElicitorPushedContext } from './elicitor/context.js';
import { activeToolNamesForExecutor } from './executor/active-tools.js';
import { composeExecutorPrompt } from './executor/compose-prompt.js';

export interface ForegroundRuntimePromptInput {
  readonly sessionState: ResolvedBrunchAgentState & { readonly elicitationStyle?: ElicitationStyle };
  readonly spec: AgentPromptSpecContext;
  readonly workspace: AgentPromptWorkspaceContext;
  readonly context?: LiveElicitorPushedContext;
  readonly activeTools?: readonly string[];
  readonly agentBody?: string;
  readonly directiveAblation?: 'warrant-before-commit';
}

export interface ForegroundRuntimePromptResult {
  readonly prompt: string;
}

export interface ForegroundRuntimeToolPolicyInput extends LiveElicitorToolPolicyInput {
  readonly sessionState: ResolvedBrunchAgentState;
}

export function composeForegroundRuntimePrompt(
  input: ForegroundRuntimePromptInput,
): ForegroundRuntimePromptResult {
  switch (input.sessionState.agentRole) {
    case 'elicitor':
      return composeLiveElicitorPrompt(input);
    case 'executor':
      return composeExecutorPrompt(input);
    default: {
      const exhaustive: never = input.sessionState.agentRole;
      return exhaustive;
    }
  }
}

export function activeToolNamesForForegroundState({
  sessionState,
  registeredToolNames,
}: ForegroundRuntimeToolPolicyInput): string[] {
  switch (sessionState.agentRole) {
    case 'elicitor':
      return activeToolNamesForLiveElicitor({ registeredToolNames });
    case 'executor':
      return activeToolNamesForExecutor({ registeredToolNames });
    default: {
      const exhaustive: never = sessionState.agentRole;
      return exhaustive;
    }
  }
}

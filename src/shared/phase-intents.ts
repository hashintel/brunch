import type { WorkflowPhase } from './api-types.js';

export type PhaseIntentKind = 'phase-entry' | 'phase-continue';

export const phaseEntryMessages: Record<WorkflowPhase, string> = {
  scope: 'Begin the grounding phase.',
  design: 'Begin the elicitation phase.',
  requirements: 'Begin the requirements phase.',
  criteria: 'Begin the acceptance criteria phase.',
};

export const phaseContinueMessages: Record<WorkflowPhase, string> = {
  scope: 'Continue the grounding phase.',
  design: 'Continue the elicitation phase.',
  requirements: 'Continue the requirements phase.',
  criteria: 'Continue the acceptance criteria phase.',
};

export function getPhaseIntentMessage(phase: WorkflowPhase, intentKind: PhaseIntentKind): string {
  return intentKind === 'phase-entry' ? phaseEntryMessages[phase] : phaseContinueMessages[phase];
}

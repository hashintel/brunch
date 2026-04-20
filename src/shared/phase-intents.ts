import * as z from 'zod/v4';

import { workflowPhaseSchema, type WorkflowPhase } from './phase-close.js';

export const phaseIntentModeSchema = z.enum(['greenfield', 'brownfield']);
export const phaseIntentRequestSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('phase-entry'),
    phase: workflowPhaseSchema,
    mode: phaseIntentModeSchema.optional(),
  }),
  z.object({
    kind: z.literal('phase-continue'),
    phase: workflowPhaseSchema,
  }),
]);

export type PhaseIntentRequest = z.infer<typeof phaseIntentRequestSchema>;
export type PhaseIntentKind = PhaseIntentRequest['kind'];
export type PhaseIntentMode = z.infer<typeof phaseIntentModeSchema>;

export const phaseEntryMessages: Record<WorkflowPhase, string> = {
  grounding: 'Begin the grounding phase.',
  design: 'Begin the elicitation phase.',
  requirements: 'Begin the requirements phase.',
  criteria: 'Begin the acceptance criteria phase.',
};

export const phaseContinueMessages: Record<WorkflowPhase, string> = {
  grounding: 'Continue the grounding phase.',
  design: 'Continue the elicitation phase.',
  requirements: 'Continue the requirements phase.',
  criteria: 'Continue the acceptance criteria phase.',
};

function getGroundingStrategyIntentMessage(mode: PhaseIntentMode): string {
  return mode === 'brownfield' ? 'Feature within existing codebase' : 'New concept from scratch';
}

export function getPhaseIntentMessage(phase: WorkflowPhase, intentKind: PhaseIntentKind): string {
  return intentKind === 'phase-entry' ? phaseEntryMessages[phase] : phaseContinueMessages[phase];
}

export function getPhaseIntentDisplayText(intent: PhaseIntentRequest): string {
  return intent.kind === 'phase-entry' && intent.phase === 'grounding' && intent.mode
    ? getGroundingStrategyIntentMessage(intent.mode)
    : getPhaseIntentMessage(intent.phase, intent.kind);
}

export function getPhaseIntentMarkerLabel(intent: PhaseIntentRequest): string | null {
  return intent.kind === 'phase-entry' ? null : 'Interview resumed';
}

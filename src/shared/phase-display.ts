import type { WorkflowPhase } from './phase-close.js';
import { groundingWorkflowPhase } from './phase-routes.js';

export const workflowPhaseLabels = {
  scope: 'Grounding',
  design: 'Elicitation',
  requirements: 'Requirements',
  criteria: 'Acceptance Criteria',
} satisfies Record<WorkflowPhase, string>;

export const groundingPhaseLabel = workflowPhaseLabels[groundingWorkflowPhase];

export function getWorkflowPhaseLabel(phase: WorkflowPhase): string {
  return workflowPhaseLabels[phase];
}

export function getWorkflowPhaseCommandLabel(phase: WorkflowPhase): string {
  return workflowPhaseLabels[phase].toLowerCase();
}

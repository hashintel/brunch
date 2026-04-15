import type { WorkflowPhase } from './phase-close.js';

export const workflowPhaseLabels = {
  scope: 'Grounding',
  design: 'Elicitation',
  requirements: 'Requirements',
  criteria: 'Acceptance Criteria',
} satisfies Record<WorkflowPhase, string>;

export function getWorkflowPhaseLabel(phase: WorkflowPhase): string {
  return workflowPhaseLabels[phase];
}

export function getWorkflowPhaseCommandLabel(phase: WorkflowPhase): string {
  return workflowPhaseLabels[phase].toLowerCase();
}

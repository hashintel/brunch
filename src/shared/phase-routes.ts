import type { WorkflowPhase } from './api-types.js';

export const groundingWorkflowPhase = 'scope' satisfies WorkflowPhase;

/** Maps server workflow phases to client route segments. See SPEC.md D86. */
export const phaseRouteSegments: Record<WorkflowPhase, string> = {
  scope: 'grounding',
  design: 'elicitation',
  requirements: 'requirements-review',
  criteria: 'acceptance-review',
};

export const groundingRouteSegment = phaseRouteSegments[groundingWorkflowPhase];

/** Reverse mapping: client route segments to server workflow phases. */
export const routeSegmentToPhase: Record<string, WorkflowPhase> = Object.fromEntries(
  Object.entries(phaseRouteSegments).map(([phase, segment]) => [segment, phase as WorkflowPhase]),
) as Record<string, WorkflowPhase>;

/** Ordered phase list matching the workflow progression. */
export const phaseOrder: WorkflowPhase[] = [groundingWorkflowPhase, 'design', 'requirements', 'criteria'];

export function getPhaseRouteSegment(phase: WorkflowPhase): string {
  return phaseRouteSegments[phase];
}

export const phaseRoutePaths = {
  scope: '/project/$id/grounding',
  design: '/project/$id/elicitation',
  requirements: '/project/$id/requirements-review',
  criteria: '/project/$id/acceptance-review',
} as const satisfies Record<WorkflowPhase, string>;

export function getPhaseRoutePath(phase: WorkflowPhase): (typeof phaseRoutePaths)[WorkflowPhase] {
  return phaseRoutePaths[phase];
}

/** Returns the next unclosed phase after the given phase, or undefined if all are closed. */
export function getNextActivePhase(
  phases: Record<WorkflowPhase, { status: string }>,
  currentPhase: WorkflowPhase,
): WorkflowPhase | undefined {
  const currentIndex = phaseOrder.indexOf(currentPhase);
  return phaseOrder.find((phase, index) => index > currentIndex && phases[phase].status !== 'closed');
}

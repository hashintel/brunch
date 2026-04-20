import type { WorkflowPhase } from './api-types.js';

/** Maps server workflow phases to client route segments. See SPEC.md D86. */
export const phaseRouteSegments: Record<WorkflowPhase, string> = {
  scope: 'grounding',
  design: 'elicitation',
  requirements: 'requirements-review',
  criteria: 'acceptance-review',
};

/** Reverse mapping: client route segments to server workflow phases. */
export const routeSegmentToPhase: Record<string, WorkflowPhase> = Object.fromEntries(
  Object.entries(phaseRouteSegments).map(([phase, segment]) => [segment, phase as WorkflowPhase]),
) as Record<string, WorkflowPhase>;

/** Ordered phase list matching the workflow progression. */
export const phaseOrder: WorkflowPhase[] = ['scope', 'design', 'requirements', 'criteria'];

/** Returns the next unclosed phase after the given phase, or undefined if all are closed. */
export function getNextActivePhase(
  phases: Record<WorkflowPhase, { status: string }>,
  currentPhase: WorkflowPhase,
): WorkflowPhase | undefined {
  const currentIndex = phaseOrder.indexOf(currentPhase);
  return phaseOrder.find((p, i) => i > currentIndex && phases[p].status !== 'closed');
}

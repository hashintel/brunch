import type { WorkflowPhase } from './api-types.js';

/** Maps server workflow phases to client route segments. See SPEC.md D86. */
export const phaseRouteSegments: Record<WorkflowPhase, string> = {
  scope: 'framing',
  design: 'elicitation',
  requirements: 'requirements-review',
  criteria: 'acceptance-review',
};

/** Ordered phase list matching the workflow progression. */
export const phaseOrder: WorkflowPhase[] = ['scope', 'design', 'requirements', 'criteria'];

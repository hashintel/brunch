import type { WorkflowPhase } from './phase-close.js';

export interface WorkflowPhaseDescriptor {
  readonly phase: WorkflowPhase;
  readonly label: string;
  readonly routeSegment: string;
}

export const workflowPhaseDescriptors = [
  { phase: 'scope', label: 'Grounding', routeSegment: 'grounding' },
  { phase: 'design', label: 'Elicitation', routeSegment: 'elicitation' },
  { phase: 'requirements', label: 'Requirements', routeSegment: 'requirements-review' },
  { phase: 'criteria', label: 'Acceptance Criteria', routeSegment: 'acceptance-review' },
] as const satisfies readonly WorkflowPhaseDescriptor[];

export const groundingWorkflowPhase = workflowPhaseDescriptors[0].phase;
export const phaseOrder = workflowPhaseDescriptors.map((descriptor) => descriptor.phase) as WorkflowPhase[];

export const phaseDescriptorByPhase = Object.fromEntries(
  workflowPhaseDescriptors.map((descriptor) => [descriptor.phase, descriptor]),
) as Record<WorkflowPhase, (typeof workflowPhaseDescriptors)[number]>;

export const workflowPhaseLabels = Object.fromEntries(
  workflowPhaseDescriptors.map((descriptor) => [descriptor.phase, descriptor.label]),
) as Record<WorkflowPhase, string>;

export const phaseRouteSegments = Object.fromEntries(
  workflowPhaseDescriptors.map((descriptor) => [descriptor.phase, descriptor.routeSegment]),
) as Record<WorkflowPhase, string>;

export const phaseRoutePaths = Object.fromEntries(
  workflowPhaseDescriptors.map((descriptor) => [descriptor.phase, `/project/$id/${descriptor.routeSegment}`]),
) as Record<WorkflowPhase, string>;

export const routeSegmentToPhase = Object.fromEntries(
  workflowPhaseDescriptors.map((descriptor) => [descriptor.routeSegment, descriptor.phase]),
) as Record<string, WorkflowPhase>;

export const groundingPhaseLabel = workflowPhaseLabels[groundingWorkflowPhase];
export const groundingRouteSegment = phaseRouteSegments[groundingWorkflowPhase];

export function getWorkflowPhaseDescriptor(phase: WorkflowPhase): (typeof workflowPhaseDescriptors)[number] {
  return phaseDescriptorByPhase[phase];
}

export function getWorkflowPhaseLabel(phase: WorkflowPhase): string {
  return getWorkflowPhaseDescriptor(phase).label;
}

export function getWorkflowPhaseCommandLabel(phase: WorkflowPhase): string {
  return getWorkflowPhaseLabel(phase).toLowerCase();
}

export function getPhaseRouteSegment(phase: WorkflowPhase): string {
  return getWorkflowPhaseDescriptor(phase).routeSegment;
}

export function getPhaseRoutePath(phase: WorkflowPhase): string {
  return phaseRoutePaths[phase];
}

export function getNextActivePhase(
  phases: Record<WorkflowPhase, { status: string }>,
  currentPhase: WorkflowPhase,
): WorkflowPhase | undefined {
  const currentIndex = phaseOrder.indexOf(currentPhase);
  return phaseOrder.find((phase, index) => index > currentIndex && phases[phase].status !== 'closed');
}

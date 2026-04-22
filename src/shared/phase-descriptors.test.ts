import { describe, expect, it } from 'vitest';

import {
  areAllWorkflowPhasesClosed,
  getCurrentOpenPhase,
  getNextActivePhase,
  getPhaseRoutePath,
  getPhaseRouteSegment,
  getWorkflowPhaseDescriptor,
  getWorkflowPhaseLabel,
  groundingWorkflowPhase,
  phaseOrder,
  workflowPhaseDescriptors,
} from './phase-descriptors.js';

describe('workflow phase descriptors', () => {
  it('keeps grounding as the canonical first-phase descriptor', () => {
    expect(groundingWorkflowPhase).toBe('grounding');
    expect(getWorkflowPhaseDescriptor(groundingWorkflowPhase)).toEqual({
      phase: 'grounding',
      label: 'Grounding',
      routeSegment: 'grounding',
    });
    expect(phaseOrder[0]).toBe(groundingWorkflowPhase);
  });

  it('owns labels, route segments, and route paths for every workflow phase', () => {
    expect(workflowPhaseDescriptors).toHaveLength(4);
    expect(getWorkflowPhaseDescriptor('grounding')).toEqual({
      phase: 'grounding',
      label: 'Grounding',
      routeSegment: 'grounding',
    });
    expect(getWorkflowPhaseLabel('design')).toBe('Elicitation');
    expect(getPhaseRouteSegment('requirements')).toBe('requirements-review');
    expect(getPhaseRoutePath('criteria')).toBe('/specification/$id/acceptance-review');
  });

  it('round-trips every phase through the canonical route-segment mapping', () => {
    for (const phase of phaseOrder) {
      expect(
        workflowPhaseDescriptors.find((descriptor) => descriptor.routeSegment === getPhaseRouteSegment(phase))
          ?.phase,
      ).toBe(phase);
    }
  });

  it('finds the current and next unclosed phases in workflow order', () => {
    const workflowSummary = {
      grounding: 'closed',
      design: 'in_progress',
      requirements: 'unstarted',
      criteria: 'unstarted',
    };

    expect(getCurrentOpenPhase(workflowSummary)).toBe('design');
    expect(getNextActivePhase(workflowSummary, 'grounding')).toBe('design');
    expect(areAllWorkflowPhasesClosed(workflowSummary)).toBe(false);

    const closedWorkflowSummary = {
      grounding: 'closed',
      design: 'closed',
      requirements: 'closed',
      criteria: 'closed',
    };

    expect(getCurrentOpenPhase(closedWorkflowSummary)).toBeNull();
    expect(getNextActivePhase(closedWorkflowSummary, 'criteria')).toBeUndefined();
    expect(areAllWorkflowPhasesClosed(closedWorkflowSummary)).toBe(true);
  });
});

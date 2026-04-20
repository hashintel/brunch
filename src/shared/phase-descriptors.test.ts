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
    expect(groundingWorkflowPhase).toBe('scope');
    expect(getWorkflowPhaseDescriptor(groundingWorkflowPhase)).toEqual({
      phase: 'scope',
      label: 'Grounding',
      routeSegment: 'grounding',
    });
    expect(phaseOrder[0]).toBe(groundingWorkflowPhase);
  });

  it('owns labels, route segments, and route paths for every workflow phase', () => {
    expect(workflowPhaseDescriptors).toHaveLength(4);
    expect(getWorkflowPhaseDescriptor('scope')).toEqual({
      phase: 'scope',
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
      scope: 'closed',
      design: 'in_progress',
      requirements: 'unstarted',
      criteria: 'unstarted',
    };

    expect(getCurrentOpenPhase(workflowSummary)).toBe('design');
    expect(getNextActivePhase(workflowSummary, 'scope')).toBe('design');
    expect(areAllWorkflowPhasesClosed(workflowSummary)).toBe(false);

    const closedWorkflowSummary = {
      scope: 'closed',
      design: 'closed',
      requirements: 'closed',
      criteria: 'closed',
    };

    expect(getCurrentOpenPhase(closedWorkflowSummary)).toBeNull();
    expect(getNextActivePhase(closedWorkflowSummary, 'criteria')).toBeUndefined();
    expect(areAllWorkflowPhasesClosed(closedWorkflowSummary)).toBe(true);
  });
});

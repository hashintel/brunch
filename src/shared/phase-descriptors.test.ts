import { describe, expect, it } from 'vitest';

import {
  getNextActivePhase,
  getPhaseRoutePath,
  getPhaseRouteSegment,
  getWorkflowPhaseDescriptor,
  getWorkflowPhaseLabel,
  groundingPhaseLabel,
  groundingRouteSegment,
  groundingWorkflowPhase,
  phaseOrder,
  routeSegmentToPhase,
  workflowPhaseDescriptors,
} from './phase-descriptors.js';

describe('workflow phase descriptors', () => {
  it('keeps grounding as the canonical first-phase descriptor', () => {
    expect(groundingWorkflowPhase).toBe('scope');
    expect(groundingPhaseLabel).toBe('Grounding');
    expect(groundingRouteSegment).toBe('grounding');
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
    expect(getPhaseRoutePath('criteria')).toBe('/project/$id/acceptance-review');
  });

  it('round-trips every phase through the canonical route-segment mapping', () => {
    for (const phase of phaseOrder) {
      expect(routeSegmentToPhase[getPhaseRouteSegment(phase)]).toBe(phase);
    }
  });

  it('finds the next unclosed phase in workflow order', () => {
    expect(
      getNextActivePhase(
        {
          scope: { status: 'closed' },
          design: { status: 'in_progress' },
          requirements: { status: 'unstarted' },
          criteria: { status: 'unstarted' },
        },
        'scope',
      ),
    ).toBe('design');

    expect(
      getNextActivePhase(
        {
          scope: { status: 'closed' },
          design: { status: 'closed' },
          requirements: { status: 'closed' },
          criteria: { status: 'closed' },
        },
        'criteria',
      ),
    ).toBeUndefined();
  });
});

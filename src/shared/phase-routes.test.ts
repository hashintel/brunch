import { describe, expect, it } from 'vitest';

import {
  getNextActivePhase,
  getPhaseRoutePath,
  getPhaseRouteSegment,
  groundingRouteSegment,
  groundingWorkflowPhase,
  phaseOrder,
  phaseRouteSegments,
  routeSegmentToPhase,
} from './phase-routes.js';

describe('phase route helpers', () => {
  it('keeps grounding as the canonical helper vocabulary for the first workflow phase', () => {
    expect(groundingWorkflowPhase).toBe('scope');
    expect(groundingRouteSegment).toBe('grounding');
    expect(phaseOrder[0]).toBe(groundingWorkflowPhase);
  });

  it('derives route segments and route paths from the workflow-phase mapping', () => {
    expect(getPhaseRouteSegment(groundingWorkflowPhase)).toBe('grounding');
    expect(getPhaseRoutePath(groundingWorkflowPhase)).toBe('/project/$id/grounding');
    expect(getPhaseRoutePath('design')).toBe('/project/$id/elicitation');
    expect(phaseRouteSegments.criteria).toBe('acceptance-review');
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

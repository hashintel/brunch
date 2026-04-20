import { describe, expect, it } from 'vitest';

import {
  getPhaseRoutePath,
  getPhaseRouteSegment,
  groundingRouteSegment,
  groundingWorkflowPhase,
  phaseOrder,
  phaseRouteSegments,
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
});

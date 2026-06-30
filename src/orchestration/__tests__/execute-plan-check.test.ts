import { describe, expect, it } from 'vitest';

import { checkExecutionSpecForPlan } from '../execute-plan-check.js';
import type { ExecutionSpecSnapshot } from '../execution-spec-snapshot.js';

const baseSnapshot: ExecutionSpecSnapshot = {
  schemaVersion: 1,
  specId: '7',
  mode: 'greenfield',
  requirements: [
    { itemId: 'requirement-1', nodeId: 1, title: 'Build feature', content: 'Build feature' },
    { itemId: 'requirement-2', nodeId: 2, title: 'Wire feature', content: 'Wire feature' },
  ],
  criteria: [
    {
      itemId: 'criterion-3',
      nodeId: 3,
      title: 'Feature is visible',
      content: 'Feature is visible',
      verifies: ['requirement-1'],
    },
  ],
  context: { constraints: [], invariants: [], decisions: [], examples: [], design: [], oracle: [] },
};

describe('checkExecutionSpecForPlan', () => {
  it('summarizes plan-input coverage and returns warnings without side effects', () => {
    const result = checkExecutionSpecForPlan(baseSnapshot);

    expect(result).toEqual({
      status: 'ok',
      counts: { requirements: 2, criteria: 1, verifiedRequirements: 1, criteriaWithRequirement: 1 },
      findings: [
        {
          code: 'requirement_without_criterion',
          severity: 'warning',
          itemId: 'requirement-2',
          message: 'Requirement requirement-2 has no verifying criterion in the execution snapshot.',
        },
      ],
      sideEffects: [],
    });
  });

  it('blocks an empty execution snapshot', () => {
    const result = checkExecutionSpecForPlan({ ...baseSnapshot, requirements: [], criteria: [] });

    expect(result.status).toBe('blocked');
    expect(result.findings).toEqual([
      {
        code: 'empty_snapshot',
        severity: 'error',
        message: 'Execution snapshot has no requirements to plan from.',
      },
    ]);
  });
});

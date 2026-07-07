import { describe, expect, it } from 'vitest';

import { checkExecutionSpecForPlan } from '../execute-plan-check.js';
import type { ExecutionSpecSnapshot } from '../execution-spec-snapshot.js';

const baseSnapshot: ExecutionSpecSnapshot = {
  schemaVersion: 1,
  specId: '7',
  mode: 'greenfield',
  requirements: [
    { itemId: 'REQ1', nodeId: 1, title: 'Build feature', content: 'Build feature', dependsOn: [] },
    { itemId: 'REQ2', nodeId: 2, title: 'Wire feature', content: 'Wire feature', dependsOn: [] },
  ],
  criteria: [
    {
      itemId: 'AC1',
      nodeId: 3,
      title: 'Feature is visible',
      content: 'Feature is visible',
      dependsOn: [],
      verifies: ['REQ1'],
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
          itemId: 'REQ2',
          message: 'Requirement REQ2 has no verifying criterion in the execution snapshot.',
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

  it('blocks dependency edges that cannot be lowered into slice dependencies', () => {
    const result = checkExecutionSpecForPlan({
      ...baseSnapshot,
      unprojectedDependencies: [{ dependencyId: 'D1', dependentId: 'REQ2' }],
    });

    expect(result.status).toBe('blocked');
    expect(result.findings).toContainEqual({
      code: 'unprojected_dependency',
      severity: 'error',
      itemId: 'REQ2',
      message: 'Dependency D1 -> REQ2 cannot be represented in the executable plan as a slice dependency.',
    });
  });
});

import { describe, expect, it } from 'vitest';

import { checkExecutionSpecForPlan } from '../execute-plan-check.js';
import type { ExecutionSpecSnapshot } from '../execution-spec-snapshot.js';

const baseSnapshot: ExecutionSpecSnapshot = {
  schemaVersion: 1,
  specId: '7',
  mode: 'greenfield',
  frontiers: [],
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
  scopes: [],
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

  it('blocks incomplete or ambiguously-owned scope packages', () => {
    const scope = {
      itemId: 'SCP1',
      nodeId: 10,
      title: 'Feature scope',
      content: '',
      dependsOn: [],
      frontierIds: [],
      requirementIds: ['REQ1'],
      criteria: [],
      design: [],
      verification: [],
    } as const;

    const result = checkExecutionSpecForPlan({ ...baseSnapshot, scopes: [scope] });

    expect(result.status).toBe('blocked');
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'scope_without_frontier', severity: 'error', itemId: 'SCP1' }),
        expect.objectContaining({ code: 'scope_without_definition', severity: 'error', itemId: 'SCP1' }),
        expect.objectContaining({ code: 'scope_without_criterion', severity: 'error', itemId: 'SCP1' }),
        expect.objectContaining({ code: 'scope_without_design', severity: 'error', itemId: 'SCP1' }),
        expect.objectContaining({ code: 'scope_without_verification', severity: 'error', itemId: 'SCP1' }),
      ]),
    );
  });

  it('blocks requirements packaged by more than one scope', () => {
    const completeScope = {
      itemId: 'SCP1',
      nodeId: 10,
      title: 'Feature scope',
      content: 'Build the feature.',
      dependsOn: [],
      frontierIds: ['F1'],
      requirementIds: ['REQ1'],
      criteria: [baseSnapshot.criteria[0]!],
      design: [{ itemId: 'MOD1', nodeId: 11, title: 'Module', content: 'Module', dependsOn: [] }],
      verification: [{ itemId: 'CH1', nodeId: 12, title: 'Check', content: 'Check', dependsOn: [] }],
    } as const;

    const result = checkExecutionSpecForPlan({
      ...baseSnapshot,
      scopes: [completeScope, { ...completeScope, itemId: 'SCP2', nodeId: 13 }],
    });

    expect(result.status).toBe('blocked');
    expect(result.findings).toContainEqual(
      expect.objectContaining({ code: 'requirement_in_multiple_scopes', severity: 'error', itemId: 'REQ1' }),
    );
  });

  it('blocks a scoped dependency whose requirement has no executable scope', () => {
    const requirement = baseSnapshot.requirements[1]!;
    const scope = {
      itemId: 'SCP1',
      nodeId: 10,
      title: 'Dependent scope',
      content: 'Build the dependent feature.',
      dependsOn: [],
      frontierIds: ['F1'],
      requirementIds: ['REQ2'],
      criteria: [{ ...baseSnapshot.criteria[0]!, verifies: ['REQ2'] }],
      design: [{ itemId: 'MOD1', nodeId: 11, title: 'Module', content: 'Module', dependsOn: [] }],
      verification: [{ itemId: 'CH1', nodeId: 12, title: 'Check', content: 'Check', dependsOn: [] }],
    } as const;

    const result = checkExecutionSpecForPlan({
      ...baseSnapshot,
      requirements: [baseSnapshot.requirements[0]!, { ...requirement, dependsOn: ['REQ1'] }],
      scopes: [scope],
    });

    expect(result.status).toBe('blocked');
    expect(result.findings).toContainEqual(
      expect.objectContaining({ code: 'scope_dependency_without_scope', itemId: 'REQ1' }),
    );
  });
});

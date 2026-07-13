import { describe, expect, it } from 'vitest';

import type { ExecutionSpecSnapshot } from '../execution-spec-snapshot.js';
import { projectPlanningInput } from '../planning-projection.js';

const item = (itemId: string, nodeId: number, content: string) => ({
  itemId,
  nodeId,
  title: content,
  content,
  dependsOn: [] as const,
});

const snapshot: ExecutionSpecSnapshot = {
  schemaVersion: 2,
  specId: '7',
  mode: 'greenfield',
  requirements: [{ ...item('REQ1', 1, 'Build feature'), frontierId: 'F1' }],
  criteria: [
    { ...item('AC1', 2, 'Feature is visible'), verifiesRequirements: ['REQ1'], verifiesFrontiers: [] },
  ],
  frontiers: [
    { ...item('F1', 3, 'Deliver feature'), requirementIds: ['REQ1'], verificationCriterionIds: [] },
  ],
  scopes: [
    {
      ...item('SCP1', 4, 'Wire the feature.'),
      frontierIds: ['F1'],
      requirementIds: ['REQ1'],
      criteria: [
        { ...item('AC1', 2, 'Feature is visible'), verifiesRequirements: ['REQ1'], verifiesFrontiers: [] },
      ],
      design: [item('MOD1', 5, 'Feature module')],
      verification: [item('CH1', 6, 'Smoke test')],
    },
  ],
  context: {
    constraints: [item('CON1', 7, 'Implementation language is Python.')],
    invariants: [item('INV1', 8, 'No network calls in tests.')],
    decisions: [item('DEC1', 9, 'Use pytest for verification.')],
    examples: [item('EX1', 10, 'Example transcript')],
    design: [item('MOD9', 11, 'Unlinked module sketch')],
    oracle: [item('CH9', 12, 'Unlinked oracle node')],
  },
};

describe('projectPlanningInput', () => {
  it('carries scopes, requirements, criteria, frontiers, and commitment context', () => {
    const projection = projectPlanningInput(snapshot);

    expect(projection.specId).toBe('7');
    expect(projection.mode).toBe('greenfield');
    expect(projection.scopes.map((scope) => scope.itemId)).toEqual(['SCP1']);
    expect(projection.requirements.map((requirement) => requirement.itemId)).toEqual(['REQ1']);
    expect(projection.criteria.map((criterion) => criterion.itemId)).toEqual(['AC1']);
    expect(projection.frontiers.map((frontier) => frontier.itemId)).toEqual(['F1']);
    expect(projection.commitments).toEqual({
      constraints: [expect.objectContaining({ itemId: 'CON1' })],
      invariants: [expect.objectContaining({ itemId: 'INV1' })],
      decisions: [expect.objectContaining({ itemId: 'DEC1' })],
      verification: [expect.objectContaining({ itemId: 'CH9' })],
    });
  });

  it('keeps the projection bounded: no examples, no unlinked design nodes', () => {
    const projection = projectPlanningInput(snapshot) as unknown as Record<string, unknown>;

    expect(JSON.stringify(projection)).not.toContain('EX1');
    expect(JSON.stringify(projection)).not.toContain('MOD9');
    expect(Object.keys(projection).sort()).toEqual([
      'commitments',
      'criteria',
      'frontiers',
      'mode',
      'requirements',
      'schemaVersion',
      'scopes',
      'specId',
    ]);
  });

  it('rejects a v1 snapshot', () => {
    expect(() =>
      projectPlanningInput({ ...snapshot, schemaVersion: 1 } as unknown as ExecutionSpecSnapshot),
    ).toThrow('Unsupported execution spec snapshot schema version: 1');
  });
});

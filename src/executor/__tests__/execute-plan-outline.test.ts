import { describe, expect, it } from 'vitest';

import { outlineExecutionPlan } from '../execute-plan-outline.js';
import type { ExecutionSpecSnapshot } from '../execution-spec-snapshot.js';

const snapshot: ExecutionSpecSnapshot = {
  schemaVersion: 1,
  specId: '7',
  mode: 'brownfield',
  frontiers: [{ itemId: 'F1', nodeId: 9, title: 'Execution handoff', content: 'Execution handoff', dependsOn: [] }],
  requirements: [
    { itemId: 'REQ1', nodeId: 1, title: 'Build feature', content: 'Build feature', dependsOn: [] },
    {
      itemId: 'REQ2',
      nodeId: 2,
      title: 'Wire feature',
      content: 'Wire feature',
      dependsOn: ['REQ1'],
    },
  ],
  criteria: [
    {
      itemId: 'AC1',
      nodeId: 3,
      title: 'Feature is visible',
      content: 'Feature is visible',
      dependsOn: [],
      verifies: ['REQ2'],
    },
  ],
  context: { constraints: [], invariants: [], decisions: [], examples: [], design: [], oracle: [] },
  scopes: [
    {
      itemId: 'SCP1',
      nodeId: 10,
      title: 'Wire feature scope',
      content: 'Wire the feature from committed design and verification anchors.',
      dependsOn: [],
      frontierIds: ['F1'],
      requirementIds: ['REQ2'],
      criteria: [
        {
          itemId: 'AC1',
          nodeId: 3,
          title: 'Feature is visible',
          content: 'Feature is visible',
          dependsOn: [],
          verifies: ['REQ2'],
        },
      ],
      design: [{ itemId: 'MOD1', nodeId: 4, title: 'Feature module', content: 'Feature module', dependsOn: [] }],
      verification: [
        { itemId: 'CH1', nodeId: 5, title: 'Smoke test', content: 'Smoke test', dependsOn: [] },
      ],
    },
  ],
};

describe('outlineExecutionPlan', () => {
  it('creates one reviewable frontier with scope tasks and attached context', () => {
    expect(outlineExecutionPlan(snapshot)).toEqual({
      schemaVersion: 1,
      specId: '7',
      mode: 'brownfield',
      frontiers: [
        {
          id: 'F1',
          title: 'Execution handoff',
          tasks: [
            {
              id: 'task-1',
              title: 'Wire feature scope',
              scopeId: 'SCP1',
              requirementId: 'REQ2',
              requirementIds: ['REQ2'],
              summary: 'Wire the feature from committed design and verification anchors.',
              dependsOn: ['REQ1'],
              acceptanceCriterionIds: ['AC1'],
              acceptanceCriteria: [
                {
                  criterionId: 'AC1',
                  title: 'Feature is visible',
                  content: 'Feature is visible',
                },
              ],
              designContext: [
                { itemId: 'MOD1', nodeId: 4, title: 'Feature module', content: 'Feature module', dependsOn: [] },
              ],
              verificationContext: [
                { itemId: 'CH1', nodeId: 5, title: 'Smoke test', content: 'Smoke test', dependsOn: [] },
              ],
            },
          ],
        },
      ],
      sideEffects: [],
    });
  });
});

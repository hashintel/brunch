import { describe, expect, it } from 'vitest';

import { outlineExecutionPlan } from '../execute-plan-outline.js';
import type { ExecutionSpecSnapshot } from '../execution-spec-snapshot.js';

const snapshot: ExecutionSpecSnapshot = {
  schemaVersion: 1,
  specId: '7',
  mode: 'brownfield',
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
};

describe('outlineExecutionPlan', () => {
  it('creates one reviewable frontier with requirement tasks and criterion refs', () => {
    expect(outlineExecutionPlan(snapshot)).toEqual({
      schemaVersion: 1,
      specId: '7',
      mode: 'brownfield',
      frontiers: [
        {
          id: 'frontier-1',
          title: 'Implement projected requirements',
          tasks: [
            {
              id: 'task-1',
              title: 'Build feature',
              requirementId: 'REQ1',
              summary: 'Build feature',
              dependsOn: [],
              acceptanceCriterionIds: [],
              acceptanceCriteria: [],
            },
            {
              id: 'task-2',
              title: 'Wire feature',
              requirementId: 'REQ2',
              summary: 'Wire feature',
              dependsOn: ['REQ1'],
              acceptanceCriterionIds: ['AC1'],
              acceptanceCriteria: [
                {
                  criterionId: 'AC1',
                  title: 'Feature is visible',
                  content: 'Feature is visible',
                },
              ],
            },
          ],
        },
      ],
      sideEffects: [],
    });
  });
});

import { describe, expect, it } from 'vitest';

import { outlineExecutionPlan } from '../execute-plan-outline.js';
import type { ExecutionSpecSnapshot } from '../execution-spec-snapshot.js';

const snapshot: ExecutionSpecSnapshot = {
  schemaVersion: 1,
  specId: '7',
  mode: 'brownfield',
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
      verifies: ['requirement-2'],
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
              requirementId: 'requirement-1',
              summary: 'Build feature',
              acceptanceCriterionIds: [],
            },
            {
              id: 'task-2',
              title: 'Wire feature',
              requirementId: 'requirement-2',
              summary: 'Wire feature',
              acceptanceCriterionIds: ['criterion-3'],
            },
          ],
        },
      ],
      sideEffects: [],
    });
  });
});

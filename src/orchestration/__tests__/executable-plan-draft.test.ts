import { describe, expect, it } from 'vitest';

import { draftExecutablePlan } from '../executable-plan-draft.js';
import type { ExecutionPlanOutline } from '../execute-plan-outline.js';

const outline: ExecutionPlanOutline = {
  schemaVersion: 1,
  specId: '7',
  mode: 'greenfield',
  frontiers: [
    {
      id: 'frontier-1',
      title: 'Implement projected requirements',
      tasks: [
        {
          id: 'task-1',
          title: 'Build feature',
          requirementId: 'requirement-1',
          summary: 'Build the feature.',
          acceptanceCriterionIds: ['criterion-2'],
          acceptanceCriteria: [
            { criterionId: 'criterion-2', title: 'Visible', content: 'Feature is visible.' },
          ],
        },
      ],
    },
  ],
  sideEffects: [],
};

describe('draftExecutablePlan', () => {
  it('projects a review outline into an executable-plan draft shape without side effects', () => {
    expect(draftExecutablePlan(outline)).toEqual({
      schemaVersion: 1,
      specId: '7',
      mode: 'greenfield',
      epics: [
        {
          id: 'frontier-1',
          title: 'Implement projected requirements',
          sliceIds: ['task-1'],
          dependsOn: [],
        },
      ],
      slices: [
        {
          id: 'task-1',
          epicId: 'frontier-1',
          title: 'Build feature',
          definition: 'Build the feature.',
          requirementId: 'requirement-1',
          dependsOn: [],
          verification: [{ kind: 'criterion', criterionId: 'criterion-2', target: 'Feature is visible.' }],
        },
      ],
      sideEffects: [],
    });
  });
});

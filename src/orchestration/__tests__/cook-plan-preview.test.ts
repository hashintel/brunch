import { describe, expect, it } from 'vitest';

import { previewCookPlan } from '../cook-plan-preview.js';
import type { ExecutablePlanDraft } from '../executable-plan-draft.js';

const draft: ExecutablePlanDraft = {
  schemaVersion: 1,
  specId: '7',
  mode: 'brownfield',
  epics: [
    { id: 'frontier-1', title: 'Implement projected requirements', sliceIds: ['task-1'], dependsOn: [] },
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
};

describe('previewCookPlan', () => {
  it('maps executable draft data into the old cook plan shape without side effects', () => {
    expect(previewCookPlan(draft)).toEqual({
      schemaVersion: 1,
      mode: 'brownfield',
      epics: [
        { id: 'frontier-1', summary: 'Implement projected requirements', depends_on: [], verification: [] },
      ],
      slices: [
        {
          id: 'task-1',
          epic_id: 'frontier-1',
          definition: 'Build the feature.',
          depends_on: [],
          verification: [{ kind: 'criterion', target: 'Feature is visible.' }],
          derived_from: ['requirement-1'],
        },
      ],
      sideEffects: [],
    });
  });
});

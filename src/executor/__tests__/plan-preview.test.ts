import { describe, expect, it } from 'vitest';

import type { ExecutablePlanDraft } from '../executable-plan-draft.js';
import { previewPlan } from '../plan-preview.js';

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
      requirementId: 'REQ1',
      dependsOn: [],
      verification: [{ kind: 'criterion', criterionId: 'AC1', target: 'Feature is visible.' }],
    },
  ],
  sideEffects: [],
};

describe('previewPlan', () => {
  it('maps executable draft data into the old cook Plan shape without side effects', () => {
    expect(previewPlan(draft)).toMatchObject({
      schemaVersion: 1,
      mode: 'brownfield',
      spec: {
        spec_id: '7',
        requirements: [{ item_id: 'REQ1', content: 'Build the feature.' }],
        criteria: [{ item_id: 'AC1', content: 'Feature is visible.', verifies: ['REQ1'] }],
      },
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
          derived_from: ['REQ1'],
        },
      ],
      sideEffects: [],
    });
  });

  it('leaves old runner fields absent when the executable draft cannot derive them truthfully', () => {
    const preview = previewPlan(draft);

    expect(preview).not.toHaveProperty('profile');
    expect(preview).not.toHaveProperty('harnessNotes');
    expect(preview.epics[0]).not.toHaveProperty('probe');
    expect(preview.epics[0]).not.toHaveProperty('reachability');
    expect(preview.slices[0]).not.toHaveProperty('writes');
  });
});

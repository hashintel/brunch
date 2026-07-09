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
          title: 'Build feature scope',
          scopeId: 'SCP1',
          requirementId: 'REQ1',
          requirementIds: ['REQ1'],
          summary: 'Build the feature from committed design and verification anchors.',
          dependsOn: [],
          acceptanceCriterionIds: ['AC1'],
          acceptanceCriteria: [{ criterionId: 'AC1', title: 'Visible', content: 'Feature is visible.' }],
          designContext: [
            { itemId: 'MOD1', nodeId: 10, title: 'Feature module', content: 'Feature module', dependsOn: [] },
          ],
          verificationContext: [
            { itemId: 'CH1', nodeId: 11, title: 'Smoke test', content: 'Smoke test', dependsOn: [] },
          ],
        },
        {
          id: 'task-2',
          title: 'Wire feature',
          scopeId: 'SCP2',
          requirementId: 'REQ2',
          requirementIds: ['REQ2'],
          summary: 'Wire the feature.',
          dependsOn: ['REQ1'],
          acceptanceCriterionIds: [],
          acceptanceCriteria: [],
          designContext: [],
          verificationContext: [],
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
          sliceIds: ['task-1', 'task-2'],
          dependsOn: [],
        },
      ],
      slices: [
        {
          id: 'task-1',
          epicId: 'frontier-1',
          scopeId: 'SCP1',
          title: 'Build feature scope',
          definition: 'Build the feature from committed design and verification anchors.',
          requirementId: 'REQ1',
          requirementIds: ['REQ1'],
          dependsOn: [],
          designContext: [
            { itemId: 'MOD1', title: 'Feature module', content: 'Feature module' },
          ],
          verificationContext: [
            { itemId: 'CH1', title: 'Smoke test', content: 'Smoke test' },
          ],
          verification: [{ kind: 'criterion', criterionId: 'AC1', target: 'Feature is visible.' }],
        },
        {
          id: 'task-2',
          epicId: 'frontier-1',
          title: 'Wire feature',
          scopeId: 'SCP2',
          definition: 'Wire the feature.',
          requirementId: 'REQ2',
          requirementIds: ['REQ2'],
          dependsOn: ['task-1'],
          designContext: [],
          verificationContext: [],
          verification: [],
        },
      ],
      sideEffects: [],
    });
  });
});

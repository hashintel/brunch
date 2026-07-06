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
          requirementId: 'REQ1',
          summary: 'Build the feature.',
          dependsOn: [],
          acceptanceCriterionIds: ['AC1'],
          acceptanceCriteria: [{ criterionId: 'AC1', title: 'Visible', content: 'Feature is visible.' }],
        },
        {
          id: 'task-2',
          title: 'Wire feature',
          requirementId: 'REQ2',
          summary: 'Wire the feature.',
          dependsOn: ['REQ1'],
          acceptanceCriterionIds: [],
          acceptanceCriteria: [],
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
          title: 'Build feature',
          definition: 'Build the feature.',
          requirementId: 'REQ1',
          dependsOn: [],
          verification: [{ kind: 'criterion', criterionId: 'AC1', target: 'Feature is visible.' }],
        },
        {
          id: 'task-2',
          epicId: 'frontier-1',
          title: 'Wire feature',
          definition: 'Wire the feature.',
          requirementId: 'REQ2',
          dependsOn: ['task-1'],
          verification: [],
        },
      ],
      sideEffects: [],
    });
  });

  it('preserves a diamond-shaped requirement dependency graph as executable slice dependencies', () => {
    const diamond: ExecutionPlanOutline = {
      schemaVersion: 1,
      specId: '7',
      mode: 'greenfield',
      frontiers: [
        {
          id: 'frontier-1',
          title: 'Implement projected requirements',
          tasks: [
            task('task-1', 'REQ1', []),
            task('task-2', 'REQ2', ['REQ1']),
            task('task-3', 'REQ3', ['REQ1']),
            task('task-4', 'REQ4', ['REQ2', 'REQ3']),
            task('task-5', 'REQ5', ['REQ4']),
          ],
        },
      ],
      sideEffects: [],
    };

    expect(draftExecutablePlan(diamond).slices.map(({ id, dependsOn }) => ({ id, dependsOn }))).toEqual([
      { id: 'task-1', dependsOn: [] },
      { id: 'task-2', dependsOn: ['task-1'] },
      { id: 'task-3', dependsOn: ['task-1'] },
      { id: 'task-4', dependsOn: ['task-2', 'task-3'] },
      { id: 'task-5', dependsOn: ['task-4'] },
    ]);
  });
});

function task(
  id: string,
  requirementId: string,
  dependsOn: readonly string[],
): ExecutionPlanOutline['frontiers'][number]['tasks'][number] {
  return {
    id,
    title: requirementId,
    requirementId,
    summary: requirementId,
    dependsOn,
    acceptanceCriterionIds: [],
    acceptanceCriteria: [],
  };
}

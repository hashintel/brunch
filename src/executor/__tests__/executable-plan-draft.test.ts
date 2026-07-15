import { describe, expect, it } from 'vitest';

import {
  assembleExecutablePlanDraft,
  draftExecutablePlan,
  type ExecutablePlanDraftSlice,
} from '../executable-plan-draft.js';
import type { ExecutionPlanOutline } from '../execute-plan-outline.js';

const outline: ExecutionPlanOutline = {
  schemaVersion: 2,
  specId: '7',
  mode: 'greenfield',
  frontiers: [
    {
      id: 'frontier-1',
      title: 'Implement projected requirements',
      dependsOn: [],
      verification: [],
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
  orphanTasks: [],
  sideEffects: [],
};

describe('draftExecutablePlan', () => {
  it('assembles dependency-ordered slices and derives matching epic membership once', () => {
    const slice = (args: {
      id: string;
      epicId?: string;
      dependsOn: readonly string[];
    }): ExecutablePlanDraftSlice => ({
      id: args.id,
      ...(args.epicId ? { epicId: args.epicId } : {}),
      title: args.id,
      definition: args.id,
      requirementId: args.id,
      requirementIds: [args.id],
      dependsOn: args.dependsOn,
      designContext: [],
      verificationContext: [],
      verification: [],
    });

    const draft = assembleExecutablePlanDraft({
      specId: '7',
      mode: 'greenfield',
      epics: [{ id: 'F1', title: 'Feature', dependsOn: [], verification: [] }],
      slices: [
        slice({ id: 'task-2', epicId: 'F1', dependsOn: ['task-1'] }),
        slice({ id: 'orphan', dependsOn: [] }),
        slice({ id: 'task-1', epicId: 'F1', dependsOn: [] }),
      ],
    });

    expect(draft.slices.map(({ id }) => id)).toEqual(['orphan', 'task-1', 'task-2']);
    expect(draft.epics[0]?.sliceIds).toEqual(['task-1', 'task-2']);
  });

  it('projects a review outline into an executable-plan draft shape without side effects', () => {
    expect(draftExecutablePlan(outline)).toEqual({
      schemaVersion: 2,
      specId: '7',
      mode: 'greenfield',
      epics: [
        {
          id: 'frontier-1',
          title: 'Implement projected requirements',
          sliceIds: ['task-1', 'task-2'],
          dependsOn: [],
          verification: [],
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
          designContext: [{ itemId: 'MOD1', title: 'Feature module', content: 'Feature module' }],
          verificationContext: [{ itemId: 'CH1', title: 'Smoke test', content: 'Smoke test' }],
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

  it('keeps requirement dependencies when they cross frontier boundaries', () => {
    expect(
      draftExecutablePlan({
        ...outline,
        frontiers: [
          {
            id: 'frontier-2',
            title: 'Execution handoff',
            dependsOn: [],
            verification: [],
            tasks: [
              {
                id: 'task-2',
                title: 'Wire feature scope',
                scopeId: 'SCP1',
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
          {
            id: 'frontier-1',
            title: 'Implement unscoped requirements',
            dependsOn: [],
            verification: [],
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
            ],
          },
        ],
      }).slices,
    ).toEqual([
      expect.objectContaining({ id: 'task-1', dependsOn: [] }),
      expect.objectContaining({ id: 'task-2', dependsOn: ['task-1'] }),
    ]);
  });

  it('maps dependencies through secondary requirement ids packaged in a scope', () => {
    expect(
      draftExecutablePlan({
        ...outline,
        frontiers: [
          {
            id: 'frontier-1',
            title: 'Execution handoff',
            dependsOn: [],
            verification: [],
            tasks: [
              {
                id: 'task-1',
                title: 'Build feature scope',
                scopeId: 'SCP1',
                requirementId: 'REQ1',
                requirementIds: ['REQ1', 'REQ2'],
                summary: 'Build and wire the feature.',
                dependsOn: [],
                acceptanceCriterionIds: [],
                acceptanceCriteria: [],
                designContext: [],
                verificationContext: [],
              },
              {
                id: 'task-2',
                title: 'Ship shortcut',
                requirementId: 'REQ3',
                summary: 'Ship shortcut',
                dependsOn: ['REQ2'],
                acceptanceCriterionIds: [],
                acceptanceCriteria: [],
              },
            ],
          },
        ],
      }).slices,
    ).toEqual([
      expect.objectContaining({ id: 'task-1', dependsOn: [] }),
      expect.objectContaining({ id: 'task-2', dependsOn: ['task-1'] }),
    ]);
  });

  it('falls back to the primary requirement id when a scope task carries an empty requirementIds list', () => {
    expect(
      draftExecutablePlan({
        ...outline,
        frontiers: [
          {
            id: 'frontier-1',
            title: 'Execution handoff',
            dependsOn: [],
            verification: [],
            tasks: [
              {
                id: 'task-1',
                title: 'Build feature scope',
                scopeId: 'SCP1',
                requirementId: 'REQ1',
                requirementIds: [],
                summary: 'Build the feature.',
                dependsOn: [],
                acceptanceCriterionIds: [],
                acceptanceCriteria: [],
              },
            ],
          },
        ],
      }).slices,
    ).toEqual([
      expect.objectContaining({
        id: 'task-1',
        requirementId: 'REQ1',
        requirementIds: ['REQ1'],
      }),
    ]);
  });

  it('keeps blocked duplicate ownership projectable for plan-check inspection', () => {
    expect(
      draftExecutablePlan({
        ...outline,
        frontiers: [
          {
            id: 'frontier-1',
            title: 'Execution handoff',
            dependsOn: [],
            verification: [],
            tasks: [
              {
                id: 'task-1',
                title: 'First scope',
                scopeId: 'SCP1',
                requirementId: 'REQ1',
                requirementIds: ['REQ1'],
                summary: 'First.',
                dependsOn: [],
                acceptanceCriterionIds: [],
                acceptanceCriteria: [],
              },
              {
                id: 'task-2',
                title: 'Second scope',
                scopeId: 'SCP2',
                requirementId: 'REQ1',
                requirementIds: ['REQ1'],
                summary: 'Second.',
                dependsOn: [],
                acceptanceCriterionIds: [],
                acceptanceCriteria: [],
              },
            ],
          },
        ],
      }).slices,
    ).toEqual([
      expect.objectContaining({ id: 'task-1', dependsOn: [] }),
      expect.objectContaining({ id: 'task-2', dependsOn: [] }),
    ]);
  });

  it('orders epic slice ids to match dependency-ordered slices', () => {
    const draft = draftExecutablePlan({
      ...outline,
      frontiers: [
        {
          id: 'frontier-1',
          title: 'Execution handoff',
          dependsOn: [],
          verification: [],
          tasks: [
            {
              id: 'task-2',
              title: 'Wire feature',
              requirementId: 'REQ2',
              requirementIds: ['REQ2'],
              summary: 'Wire the feature.',
              dependsOn: ['REQ1'],
              acceptanceCriterionIds: [],
              acceptanceCriteria: [],
            },
            {
              id: 'task-1',
              title: 'Build feature',
              requirementId: 'REQ1',
              requirementIds: ['REQ1'],
              summary: 'Build the feature.',
              dependsOn: [],
              acceptanceCriterionIds: [],
              acceptanceCriteria: [],
            },
          ],
        },
      ],
    });

    expect(draft.slices.map((slice) => slice.id)).toEqual(['task-1', 'task-2']);
    expect(draft.epics[0]?.sliceIds).toEqual(['task-1', 'task-2']);
  });

  it('rejects a v1 plan outline instead of drafting from an incompatible shape', () => {
    expect(() =>
      draftExecutablePlan({ ...outline, schemaVersion: 1 } as unknown as ExecutionPlanOutline),
    ).toThrow('Unsupported execution plan outline schema version: 1');
  });
});

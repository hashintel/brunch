import { describe, expect, it } from 'vitest';

import { outlineExecutionPlan } from '../execute-plan-outline.js';
import type { ExecutionSpecSnapshot } from '../execution-spec-snapshot.js';

const snapshot: ExecutionSpecSnapshot = {
  schemaVersion: 1,
  specId: '7',
  mode: 'brownfield',
  frontiers: [
    { itemId: 'F1', nodeId: 9, title: 'Execution handoff', content: 'Execution handoff', dependsOn: [] },
  ],
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
      design: [
        { itemId: 'MOD1', nodeId: 4, title: 'Feature module', content: 'Feature module', dependsOn: [] },
      ],
      verification: [{ itemId: 'CH1', nodeId: 5, title: 'Smoke test', content: 'Smoke test', dependsOn: [] }],
    },
  ],
};

describe('outlineExecutionPlan', () => {
  it('drops dependencies that stay inside the same scope package', () => {
    const scope = snapshot.scopes[0]!;

    expect(
      outlineExecutionPlan({
        ...snapshot,
        scopes: [
          {
            ...scope,
            requirementIds: ['REQ1', 'REQ2'],
          },
        ],
      }).frontiers[0]?.tasks,
    ).toEqual([
      expect.objectContaining({
        requirementIds: ['REQ1', 'REQ2'],
        dependsOn: [],
      }),
    ]);
  });

  it('assigns globally unique task ids when scoped and unscoped frontiers coexist', () => {
    const outline = outlineExecutionPlan(snapshot);

    expect(outline.frontiers.flatMap((frontier) => frontier.tasks.map((task) => task.id))).toEqual([
      'task-1',
      'task-2',
    ]);
  });

  it('creates scope tasks and keeps orphan requirements visible', () => {
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
                  verifies: ['REQ2'],
                },
              ],
              requirements: [
                {
                  itemId: 'REQ2',
                  nodeId: 2,
                  title: 'Wire feature',
                  content: 'Wire feature',
                  dependsOn: ['REQ1'],
                },
              ],
              designContext: [
                {
                  itemId: 'MOD1',
                  nodeId: 4,
                  title: 'Feature module',
                  content: 'Feature module',
                  dependsOn: [],
                },
              ],
              verificationContext: [
                { itemId: 'CH1', nodeId: 5, title: 'Smoke test', content: 'Smoke test', dependsOn: [] },
              ],
            },
          ],
        },
        {
          id: 'frontier-unscoped-requirements',
          title: 'Implement unscoped requirements',
          tasks: [
            {
              id: 'task-2',
              title: 'Build feature',
              requirementId: 'REQ1',
              requirements: [
                {
                  itemId: 'REQ1',
                  nodeId: 1,
                  title: 'Build feature',
                  content: 'Build feature',
                  dependsOn: [],
                },
              ],
              summary: 'Build feature',
              dependsOn: [],
              acceptanceCriterionIds: [],
              acceptanceCriteria: [],
            },
          ],
        },
      ],
      sideEffects: [],
    });
  });

  it('keeps additional requirements that are not packaged into any scope', () => {
    expect(
      outlineExecutionPlan({
        ...snapshot,
        requirements: [
          ...snapshot.requirements,
          {
            itemId: 'REQ3',
            nodeId: 6,
            title: 'Ship keyboard shortcut',
            content: 'Ship keyboard shortcut',
            dependsOn: [],
          },
        ],
      }),
    ).toEqual({
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
                  verifies: ['REQ2'],
                },
              ],
              requirements: [
                {
                  itemId: 'REQ2',
                  nodeId: 2,
                  title: 'Wire feature',
                  content: 'Wire feature',
                  dependsOn: ['REQ1'],
                },
              ],
              designContext: [
                {
                  itemId: 'MOD1',
                  nodeId: 4,
                  title: 'Feature module',
                  content: 'Feature module',
                  dependsOn: [],
                },
              ],
              verificationContext: [
                { itemId: 'CH1', nodeId: 5, title: 'Smoke test', content: 'Smoke test', dependsOn: [] },
              ],
            },
          ],
        },
        {
          id: 'frontier-unscoped-requirements',
          title: 'Implement unscoped requirements',
          tasks: [
            {
              id: 'task-2',
              title: 'Build feature',
              requirementId: 'REQ1',
              requirements: [
                {
                  itemId: 'REQ1',
                  nodeId: 1,
                  title: 'Build feature',
                  content: 'Build feature',
                  dependsOn: [],
                },
              ],
              summary: 'Build feature',
              dependsOn: [],
              acceptanceCriterionIds: [],
              acceptanceCriteria: [],
            },
            {
              id: 'task-3',
              title: 'Ship keyboard shortcut',
              requirementId: 'REQ3',
              requirements: [
                {
                  itemId: 'REQ3',
                  nodeId: 6,
                  title: 'Ship keyboard shortcut',
                  content: 'Ship keyboard shortcut',
                  dependsOn: [],
                },
              ],
              summary: 'Ship keyboard shortcut',
              dependsOn: [],
              acceptanceCriterionIds: [],
              acceptanceCriteria: [],
            },
          ],
        },
      ],
      sideEffects: [],
    });
  });
});

import { describe, expect, it } from 'vitest';

import { outlineExecutionPlan } from '../execute-plan-outline.js';
import type { ExecutionSpecSnapshot } from '../execution-spec-snapshot.js';

const snapshot: ExecutionSpecSnapshot = {
  schemaVersion: 2,
  specId: '7',
  mode: 'brownfield',
  requirements: [
    {
      itemId: 'REQ1',
      nodeId: 1,
      title: 'Build feature',
      content: 'Build feature',
      dependsOn: [],
      frontierId: 'F1',
    },
    {
      itemId: 'REQ2',
      nodeId: 2,
      title: 'Wire feature',
      content: 'Wire feature',
      dependsOn: ['REQ1'],
      frontierId: 'F1',
    },
  ],
  criteria: [
    {
      itemId: 'AC1',
      nodeId: 3,
      title: 'Feature is visible',
      content: 'Feature is visible',
      dependsOn: [],
      verifiesRequirements: ['REQ2'],
      verifiesFrontiers: [],
    },
  ],
  frontiers: [
    {
      itemId: 'F1',
      nodeId: 9,
      title: 'Execution handoff',
      content: 'Execution handoff',
      dependsOn: [],
      requirementIds: ['REQ1', 'REQ2'],
      verificationCriterionIds: [],
    },
  ],
  context: {
    constraints: [],
    invariants: [],
    decisions: [],
    examples: [],
    design: [],
    oracle: [],
    executionHarnesses: [],
  },
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
          verifiesRequirements: ['REQ2'],
          verifiesFrontiers: [],
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
  it('does not repair a scope without requirements into unscoped tasks', () => {
    const scope = snapshot.scopes[0]!;
    const outline = outlineExecutionPlan({
      ...snapshot,
      scopes: [{ ...scope, requirementIds: [] }],
    });

    expect(outline.frontiers).toEqual([]);
  });

  it('does not guess an owner when a scope names multiple parent frontiers', () => {
    const scope = snapshot.scopes[0]!;
    const outline = outlineExecutionPlan({
      ...snapshot,
      frontiers: [
        ...snapshot.frontiers,
        {
          itemId: 'F2',
          nodeId: 11,
          title: 'Other frontier',
          content: 'Other frontier',
          dependsOn: [],
          requirementIds: [],
          verificationCriterionIds: [],
        },
      ],
      scopes: [{ ...scope, frontierIds: ['F1', 'F2'] }],
    });

    expect(outline.frontiers).toEqual([]);
  });

  it('claims shared scope requirements once', () => {
    const scope = snapshot.scopes[0]!;
    const outline = outlineExecutionPlan({
      ...snapshot,
      scopes: [
        scope,
        {
          ...scope,
          itemId: 'SCP2',
          nodeId: 12,
          title: 'Duplicate wire feature scope',
          requirementIds: ['REQ2'],
        },
      ],
    });

    expect(outline.frontiers).toEqual([
      expect.objectContaining({
        id: 'F1',
        tasks: [expect.objectContaining({ scopeId: 'SCP1', requirementIds: ['REQ2'] })],
      }),
    ]);
  });

  it('does not assign a parentless scope to an unrelated frontier', () => {
    const scope = snapshot.scopes[0]!;

    expect(
      outlineExecutionPlan({
        ...snapshot,
        scopes: [{ ...scope, frontierIds: [] }],
      }).frontiers,
    ).toEqual([]);
  });

  it('lowers a multi-requirement scope into multiple scoped tasks', () => {
    expect(
      outlineExecutionPlan({
        ...snapshot,
        requirements: [
          snapshot.requirements[0]!,
          snapshot.requirements[1]!,
          {
            itemId: 'REQ3',
            nodeId: 6,
            title: 'Ship keyboard shortcut',
            content: 'Ship keyboard shortcut',
            dependsOn: ['REQ2'],
          },
        ],
        criteria: [
          snapshot.criteria[0]!,
          {
            itemId: 'AC2',
            nodeId: 7,
            title: 'Shortcut opens feature',
            content: 'Shortcut opens feature',
            dependsOn: [],
            verifiesRequirements: ['REQ3'],
            verifiesFrontiers: [],
          },
        ],
        scopes: [
          {
            ...snapshot.scopes[0]!,
            title: 'Feature delivery scope',
            requirementIds: ['REQ2', 'REQ3'],
            criteria: [
              snapshot.scopes[0]!.criteria[0]!,
              {
                itemId: 'AC2',
                nodeId: 7,
                title: 'Shortcut opens feature',
                content: 'Shortcut opens feature',
                dependsOn: [],
                verifiesRequirements: ['REQ3'],
                verifiesFrontiers: [],
              },
            ],
          },
        ],
      }).frontiers,
    ).toEqual([
      {
        id: 'F1',
        title: 'Execution handoff',
        dependsOn: [],
        verification: [],
        tasks: [
          expect.objectContaining({
            id: 'task-1',
            scopeId: 'SCP1',
            title: 'Wire feature',
            requirementId: 'REQ2',
            requirementIds: ['REQ2'],
            summary: 'Wire feature',
            dependsOn: ['REQ1'],
            acceptanceCriterionIds: ['AC1'],
          }),
          expect.objectContaining({
            id: 'task-2',
            scopeId: 'SCP1',
            title: 'Ship keyboard shortcut',
            requirementId: 'REQ3',
            requirementIds: ['REQ3'],
            summary: 'Ship keyboard shortcut',
            dependsOn: ['REQ2'],
            acceptanceCriterionIds: ['AC2'],
          }),
        ],
      },
    ]);
  });

  it('keeps internal requirement dependencies visible when a scope fans out', () => {
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
        requirementId: 'REQ1',
        requirementIds: ['REQ1'],
        dependsOn: [],
      }),
      expect.objectContaining({
        requirementId: 'REQ2',
        requirementIds: ['REQ2'],
        dependsOn: ['REQ1'],
      }),
    ]);
  });

  it('keeps scope-linked criteria on every derived task when a scope fans out', () => {
    const scope = snapshot.scopes[0]!;

    expect(
      outlineExecutionPlan({
        ...snapshot,
        requirements: [
          snapshot.requirements[0]!,
          snapshot.requirements[1]!,
          {
            itemId: 'REQ3',
            nodeId: 6,
            title: 'Ship keyboard shortcut',
            content: 'Ship keyboard shortcut',
            dependsOn: ['REQ2'],
          },
        ],
        scopes: [
          {
            ...scope,
            requirementIds: ['REQ2', 'REQ3'],
            criteria: [
              {
                itemId: 'AC0',
                nodeId: 8,
                title: 'Flow remains coherent',
                content: 'The feature flow remains coherent across both requirements.',
                dependsOn: [],
                verifiesRequirements: [],
                verifiesFrontiers: [],
                scopeLinked: true,
              },
              scope.criteria[0]!,
              {
                itemId: 'AC2',
                nodeId: 7,
                title: 'Shortcut opens feature',
                content: 'Shortcut opens feature',
                dependsOn: [],
                verifiesRequirements: ['REQ3'],
                verifiesFrontiers: [],
              },
            ],
          },
        ],
      }).frontiers[0]?.tasks,
    ).toEqual([
      expect.objectContaining({
        requirementId: 'REQ2',
        acceptanceCriterionIds: ['AC0', 'AC1'],
      }),
      expect.objectContaining({
        requirementId: 'REQ3',
        acceptanceCriterionIds: ['AC0', 'AC2'],
      }),
    ]);
  });

  it('assigns task ids across committed scope frontiers', () => {
    const outline = outlineExecutionPlan(snapshot);

    expect(outline.frontiers.flatMap((frontier) => frontier.tasks.map((task) => task.id))).toEqual([
      'task-1',
    ]);
  });

  it('creates only committed scope tasks once scopes exist', () => {
    expect(outlineExecutionPlan(snapshot)).toEqual({
      schemaVersion: 2,
      specId: '7',
      mode: 'brownfield',
      frontiers: [
        {
          id: 'F1',
          title: 'Execution handoff',
          dependsOn: [],
          verification: [],
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
                  frontierId: 'F1',
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
      ],
      orphanTasks: [],
      sideEffects: [],
    });
  });

  it('does not infer execution tasks for requirements outside committed scopes', () => {
    const outline = outlineExecutionPlan({
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
    });

    expect(outline.frontiers).toHaveLength(1);
    expect(outline.frontiers[0]?.tasks.map((task) => task.requirementIds)).toEqual([['REQ2']]);
  });

  it('rejects a v1 execution snapshot instead of interpreting the incompatible shape', () => {
    expect(() =>
      outlineExecutionPlan({ ...snapshot, schemaVersion: 1 } as unknown as ExecutionSpecSnapshot),
    ).toThrow('Unsupported execution spec snapshot schema version: 1');
  });
});

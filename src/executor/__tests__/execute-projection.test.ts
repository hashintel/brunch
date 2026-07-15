import { describe, expect, it } from 'vitest';

import type { GraphEdge } from '../../graph/schema/edges.js';
import type { GraphNode } from '../../graph/schema/nodes.js';
import { projectExecuteGraph } from '../execute-projection.js';

const base = {
  specId: 7,
  basis: 'explicit',
  settlement: 'settled',
  createdAtLsn: 1,
  updatedAtLsn: 1,
} as const;

describe('projectExecuteGraph', () => {
  it('projects authored frontiers, dependencies, verification provenance, and orphan slices', () => {
    const nodes: GraphNode[] = [
      { ...base, id: 1, plane: 'plan', kind: 'frontier', kindOrdinal: 1, title: 'Foundation' },
      { ...base, id: 2, plane: 'plan', kind: 'frontier', kindOrdinal: 2, title: 'Feature' },
      { ...base, id: 10, plane: 'intent', kind: 'requirement', kindOrdinal: 1, title: 'Build base' },
      { ...base, id: 11, plane: 'intent', kind: 'requirement', kindOrdinal: 2, title: 'Build feature' },
      { ...base, id: 12, plane: 'intent', kind: 'requirement', kindOrdinal: 3, title: 'Orphan task' },
      { ...base, id: 20, plane: 'intent', kind: 'criterion', kindOrdinal: 1, title: 'Feature verified' },
    ];
    const edges: GraphEdge[] = [
      { ...base, id: 1, category: 'composition', sourceId: 1, targetId: 10 },
      { ...base, id: 2, category: 'composition', sourceId: 2, targetId: 11 },
      { ...base, id: 3, category: 'dependency', sourceId: 1, targetId: 2 },
      { ...base, id: 4, category: 'witness', sourceId: 20, targetId: 2, stance: 'for' },
    ];

    const projection = projectExecuteGraph({ specId: 7, graphLsn: 9, nodes, edges });

    expect(projection.planPreview.epics).toEqual([
      { id: 'F1', summary: 'Foundation', depends_on: [], verification: [] },
      {
        id: 'F2',
        summary: 'Feature',
        depends_on: ['F1'],
        verification: [{ kind: 'criterion', criterionId: 'AC1', target: 'Feature verified' }],
      },
    ]);
    expect(projection.planPreview.slices).toEqual([
      expect.objectContaining({ id: 'task-1', epic_id: 'F1', derived_from: ['REQ1'] }),
      expect.objectContaining({ id: 'task-2', epic_id: 'F2', derived_from: ['REQ2'] }),
      expect.not.objectContaining({ epic_id: expect.anything() }),
    ]);
  });

  it('rejects a requirement composed into multiple frontiers', () => {
    const nodes: GraphNode[] = [
      { ...base, id: 1, plane: 'plan', kind: 'frontier', kindOrdinal: 1, title: 'One' },
      { ...base, id: 2, plane: 'plan', kind: 'frontier', kindOrdinal: 2, title: 'Two' },
      { ...base, id: 10, plane: 'intent', kind: 'requirement', kindOrdinal: 1, title: 'Shared' },
    ];
    const edges: GraphEdge[] = [
      { ...base, id: 1, category: 'composition', sourceId: 1, targetId: 10 },
      { ...base, id: 2, category: 'composition', sourceId: 2, targetId: 10 },
    ];

    expect(() => projectExecuteGraph({ specId: 7, graphLsn: 10, nodes, edges })).toThrow(
      'Requirement REQ1 is composed into multiple frontiers',
    );
  });

  it('centralizes graph to snapshot/check/outline/draft/preview projection', () => {
    const nodes: GraphNode[] = [
      {
        ...base,
        id: 10,
        plane: 'intent',
        kind: 'requirement',
        kindOrdinal: 1,
        title: 'Build feature',
      },
      {
        ...base,
        id: 11,
        plane: 'intent',
        kind: 'criterion',
        kindOrdinal: 1,
        title: 'Visible feature',
      },
    ];
    const edges: GraphEdge[] = [
      {
        ...base,
        id: 1,
        category: 'witness',
        sourceId: 11,
        targetId: 10,
        stance: 'for',
      },
    ];

    const projection = projectExecuteGraph({ specId: 7, mode: 'brownfield', graphLsn: 5, nodes, edges });

    expect(projection.source).toEqual({ graphLsn: 5, visibility: 'active' });
    expect(projection.snapshot.requirements.map((requirement) => requirement.itemId)).toEqual(['REQ1']);
    expect(projection.snapshot.criteria[0]?.verifiesRequirements).toEqual(['REQ1']);
    expect(projection.check.status).toBe('ok');
    expect(projection.outline.orphanTasks[0]?.requirementId).toBe('REQ1');
    expect(projection.draft.slices[0]?.requirementId).toBe('REQ1');
    expect(projection.planPreview.slices[0]?.derived_from).toEqual(['REQ1']);
  });

  it('keeps non-requirement dependency edges out of executable scheduling blockers', () => {
    const nodes: GraphNode[] = [
      {
        ...base,
        id: 10,
        plane: 'intent',
        kind: 'requirement',
        kindOrdinal: 1,
        title: 'Build foundation',
      },
      {
        ...base,
        id: 11,
        plane: 'intent',
        kind: 'requirement',
        kindOrdinal: 2,
        title: 'Build dependent feature',
      },
      {
        ...base,
        id: 12,
        plane: 'intent',
        kind: 'criterion',
        kindOrdinal: 1,
        title: 'Foundation works',
      },
      {
        ...base,
        id: 13,
        plane: 'intent',
        kind: 'criterion',
        kindOrdinal: 2,
        title: 'Dependent feature works',
      },
      {
        ...base,
        id: 20,
        plane: 'design',
        kind: 'module',
        kindOrdinal: 1,
        title: 'Foundation module',
      },
      {
        ...base,
        id: 21,
        plane: 'design',
        kind: 'module',
        kindOrdinal: 2,
        title: 'Feature module',
      },
    ];
    const edges: GraphEdge[] = [
      { ...base, id: 1, category: 'dependency', sourceId: 10, targetId: 11 },
      { ...base, id: 2, category: 'dependency', sourceId: 20, targetId: 21 },
      { ...base, id: 3, category: 'witness', sourceId: 12, targetId: 10, stance: 'for' },
      { ...base, id: 4, category: 'witness', sourceId: 13, targetId: 11, stance: 'for' },
    ];

    const projection = projectExecuteGraph({ specId: 7, graphLsn: 8, nodes, edges });

    expect(projection.check.status).toBe('ok');
    expect(projection.planPreview.slices).toEqual([
      expect.objectContaining({ id: 'task-1', derived_from: ['REQ1'], depends_on: [] }),
      expect.objectContaining({ id: 'task-2', derived_from: ['REQ2'], depends_on: ['task-1'] }),
    ]);
  });

  it('lowers one committed scope into multiple scoped slices', () => {
    const nodes: GraphNode[] = [
      {
        ...base,
        id: 1,
        plane: 'plan',
        kind: 'frontier',
        kindOrdinal: 1,
        title: 'Execution handoff',
      },
      {
        ...base,
        id: 2,
        plane: 'plan',
        kind: 'scope',
        kindOrdinal: 1,
        title: 'Feature delivery scope',
        body: 'Deliver the feature scope from committed design and verification anchors.',
      },
      {
        ...base,
        id: 10,
        plane: 'intent',
        kind: 'requirement',
        kindOrdinal: 1,
        title: 'Wire feature',
      },
      {
        ...base,
        id: 11,
        plane: 'intent',
        kind: 'requirement',
        kindOrdinal: 2,
        title: 'Ship keyboard shortcut',
      },
      {
        ...base,
        id: 12,
        plane: 'intent',
        kind: 'requirement',
        kindOrdinal: 3,
        title: 'Build foundation',
      },
      {
        ...base,
        id: 20,
        plane: 'intent',
        kind: 'criterion',
        kindOrdinal: 1,
        title: 'Feature is visible',
      },
      {
        ...base,
        id: 21,
        plane: 'intent',
        kind: 'criterion',
        kindOrdinal: 2,
        title: 'Shortcut opens feature',
      },
      {
        ...base,
        id: 30,
        plane: 'design',
        kind: 'module',
        kindOrdinal: 1,
        title: 'Feature module',
      },
      {
        ...base,
        id: 40,
        plane: 'oracle',
        kind: 'check',
        kindOrdinal: 1,
        title: 'Feature smoke test',
      },
    ];
    const edges: GraphEdge[] = [
      { ...base, id: 1, category: 'composition', sourceId: 1, targetId: 2 },
      { ...base, id: 2, category: 'realization', sourceId: 10, targetId: 2 },
      { ...base, id: 3, category: 'realization', sourceId: 11, targetId: 2 },
      { ...base, id: 4, category: 'realization', sourceId: 12, targetId: 2 },
      { ...base, id: 5, category: 'dependency', sourceId: 12, targetId: 10 },
      { ...base, id: 6, category: 'dependency', sourceId: 10, targetId: 11 },
      { ...base, id: 7, category: 'witness', sourceId: 20, targetId: 10, stance: 'for' },
      { ...base, id: 8, category: 'witness', sourceId: 21, targetId: 11, stance: 'for' },
      { ...base, id: 9, category: 'composition', sourceId: 2, targetId: 30 },
      { ...base, id: 10, category: 'dependency', sourceId: 40, targetId: 2 },
      { ...base, id: 11, category: 'dependency', sourceId: 20, targetId: 2 },
      { ...base, id: 12, category: 'dependency', sourceId: 21, targetId: 2 },
    ];

    const projection = projectExecuteGraph({ specId: 7, graphLsn: 9, mode: 'brownfield', nodes, edges });

    expect(projection.outline.frontiers).toEqual([
      expect.objectContaining({
        id: 'F1',
        tasks: [
          expect.objectContaining({
            id: 'task-1',
            scopeId: 'SCP1',
            requirementId: 'REQ1',
            dependsOn: ['REQ3'],
          }),
          expect.objectContaining({
            id: 'task-2',
            scopeId: 'SCP1',
            requirementId: 'REQ2',
            dependsOn: ['REQ1'],
          }),
          expect.objectContaining({
            id: 'task-3',
            scopeId: 'SCP1',
            requirementId: 'REQ3',
            dependsOn: [],
          }),
        ],
      }),
    ]);
    expect(projection.planPreview.slices).toEqual([
      expect.objectContaining({ id: 'task-3', scope_id: 'SCP1', derived_from: ['REQ3'], depends_on: [] }),
      expect.objectContaining({
        id: 'task-1',
        scope_id: 'SCP1',
        derived_from: ['REQ1'],
        depends_on: ['task-3'],
      }),
      expect.objectContaining({
        id: 'task-2',
        scope_id: 'SCP1',
        derived_from: ['REQ2'],
        depends_on: ['task-1'],
      }),
    ]);
  });
});

describe('projectExecuteGraph execution contract', () => {
  const nodes: GraphNode[] = [
    { ...base, id: 10, plane: 'intent', kind: 'requirement', kindOrdinal: 1, title: 'Build base' },
  ];

  it('does not invent a greenfield verification action without an authored recipe', () => {
    const projection = projectExecuteGraph({ specId: 7, graphLsn: 9, nodes, edges: [] });

    expect(projection.executionContract.requiredCapabilities).toEqual([]);
    expect(projection.executionContract.resolvedActions.verify).toEqual([]);
    expect(projection.planPreview.execution_contract).toEqual(projection.executionContract);
  });

  it('retains detected workspace facts without turning them into command authority', () => {
    const projection = projectExecuteGraph({
      specId: 7,
      graphLsn: 9,
      nodes,
      edges: [],
      mode: 'brownfield',
      detectedCapabilities: [{ id: 'node.script.test', source: { kind: 'detected', path: 'package.json' } }],
    });

    expect(projection.executionContract.requiredCapabilities).toEqual([]);
    expect(projection.executionContract.detectedCapabilities).toEqual([
      { id: 'node.script.test', source: { kind: 'detected', path: 'package.json' } },
    ]);
    expect(projection.executionContract.resolvedActions.verify).toEqual([]);
  });

  it('does not apply the greenfield default when brownfield detection finds no verify command', () => {
    const projection = projectExecuteGraph({
      specId: 7,
      graphLsn: 9,
      nodes,
      edges: [],
      mode: 'brownfield',
      detectedCapabilities: [],
    });

    expect(projection.executionContract.requiredCapabilities).toEqual([]);
    expect(projection.executionContract.resolvedActions.verify).toEqual([]);
  });

  it('derives the contract from the settled Project execution harness V&V method', () => {
    const projection = projectExecuteGraph({
      specId: 7,
      graphLsn: 9,
      nodes: [
        ...nodes,
        {
          ...base,
          id: 30,
          plane: 'oracle',
          kind: 'vv_method',
          kindOrdinal: 1,
          title: 'Project execution harness',
          body: 'Verification runs through cargo.\nexecute.verify: cargo test',
        },
      ],
      edges: [],
    });

    expect(projection.executionContract.requiredCapabilities).toEqual([
      { id: 'spec.verify', source: { kind: 'elicited', itemId: 'VV1' } },
    ]);
    expect(projection.executionContract.resolvedActions.verify).toEqual([
      { capabilityId: 'spec.verify', providerId: 'spec-recipe', command: 'cargo', args: ['test'] },
    ]);
  });

  it.each([
    {
      source: 'a decision with the canonical title',
      node: {
        ...base,
        id: 30,
        plane: 'intent',
        kind: 'decision',
        kindOrdinal: 1,
        title: 'Project execution harness',
        body: 'execute.verify: decision-command',
      } satisfies GraphNode,
    },
    {
      source: 'a differently titled V&V method',
      node: {
        ...base,
        id: 30,
        plane: 'oracle',
        kind: 'vv_method',
        kindOrdinal: 1,
        title: 'Release verification',
        body: 'execute.verify: wrong-title-command',
      } satisfies GraphNode,
    },
    {
      source: 'an advisory canonical V&V method',
      node: {
        ...base,
        settlement: 'advisory',
        id: 30,
        plane: 'oracle',
        kind: 'vv_method',
        kindOrdinal: 1,
        title: 'Project execution harness',
        body: 'execute.verify: advisory-command',
      } satisfies GraphNode,
    },
  ])('does not grant command authority to $source', ({ node }) => {
    const projection = projectExecuteGraph({
      specId: 7,
      graphLsn: 9,
      nodes: [...nodes, node],
      edges: [],
    });

    expect(projection.executionContract.requiredCapabilities).toEqual([]);
    expect(projection.executionContract.resolvedActions.verify).toEqual([]);
  });

  it('blocks the contract on malformed recipe lines instead of guessing', () => {
    const projection = projectExecuteGraph({
      specId: 7,
      graphLsn: 9,
      nodes: [
        ...nodes,
        {
          ...base,
          id: 30,
          plane: 'oracle',
          kind: 'vv_method',
          kindOrdinal: 1,
          title: 'Project execution harness',
          body: 'execute.verify: cargo test && echo done',
        },
      ],
      edges: [],
    });

    expect(projection.executionContract.blocked[0]).toMatchObject({
      id: 'spec.recipe',
      reason: 'malformed_recipe',
    });
  });
});

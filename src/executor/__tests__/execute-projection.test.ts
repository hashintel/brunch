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
    expect(projection.snapshot.criteria[0]?.verifies).toEqual(['REQ1']);
    expect(projection.check.status).toBe('ok');
    expect(projection.outline.frontiers[0]?.tasks[0]?.requirementId).toBe('REQ1');
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
});

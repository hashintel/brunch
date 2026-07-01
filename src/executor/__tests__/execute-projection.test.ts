import { describe, expect, it } from 'vitest';

import type { GraphEdge } from '../../graph/schema/edges.js';
import type { GraphNode } from '../../graph/schema/nodes.js';
import { projectExecuteGraph } from '../execute-projection.js';

const base = { specId: 7, basis: 'explicit', createdAtLsn: 1, updatedAtLsn: 1 } as const;

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
});

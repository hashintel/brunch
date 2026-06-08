import { describe, expect, it } from 'vitest';

import type { NodeNeighborhood } from '../../../graph/queries.js';
import type { GraphNode } from '../../../graph/schema/nodes.js';
import { renderNodeContext } from './node.js';

const neighborhood: NodeNeighborhood = {
  selector: { id: 1 },
  status: 'found',
  node: node(
    1,
    'intent',
    'requirement',
    'Selected spec has graph truth',
    'A long body explains the requirement.',
  ),
  related: [
    node(2, 'design', 'module', 'Graph snapshot reader'),
    node(3, 'oracle', 'check', 'Prompt path test'),
  ],
  edges: [
    {
      id: 5,
      specId: 1,
      category: 'realization',
      sourceId: 2,
      targetId: 1,
      basis: 'explicit',
      rationale: 'The reader supplies typed selected-spec data to context renderers.',
      createdAtLsn: 5,
      updatedAtLsn: 5,
    },
  ],
};

describe('renderNodeContext', () => {
  it('renders anchor, neighbors, and relevant edges with bounded output', () => {
    const rendered = renderNodeContext(neighborhood, { maxNeighbors: 1, maxEdges: 1 });

    expect(rendered).toContain('[Selected-spec node context]');
    expect(rendered).toContain('- anchor: [REQ1] intent/requirement: Selected spec has graph truth');
    expect(rendered).toContain('- anchor body: A long body explains the requirement.');
    expect(rendered).toContain('[MOD2] design/module: Graph snapshot reader');
    expect(rendered).toContain('…1 more neighbor(s) omitted');
    expect(rendered).toContain('MOD2 -[realization]-> REQ1');
  });

  it('renders a clear selected-spec missing-node result', () => {
    expect(renderNodeContext({ selector: { id: 404 }, status: 'not_found', related: [], edges: [] })).toBe(
      '[Selected-spec node context]\n- node: not found in selected spec',
    );
  });
});

function node(
  id: number,
  plane: GraphNode['plane'],
  kind: GraphNode['kind'],
  title: string,
  body?: string,
): GraphNode {
  return {
    id,
    specId: 1,
    plane,
    kind,
    kindOrdinal: id,
    title,
    ...(body ? { body } : {}),
    basis: 'explicit',
    createdAtLsn: id,
    updatedAtLsn: id,
  };
}

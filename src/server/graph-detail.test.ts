/**
 * Oracle for buildGraphDetail — the pure projection of the selected node into its
 * detail-panel payload. Derives entirely from the graph model (the node data the
 * projection already carries), so it has a direct test seam without React or
 * entity-state re-walking.
 */

import { describe, expect, it } from 'vitest';

import type { GraphModel } from '@/views/graph/buildGraphModel.js';
import { buildGraphDetail } from '@/views/graph/graphDetail.js';
import type { GraphEdgeData, GraphNodeData } from '@/views/graph/types.js';

function node(id: string, kind: GraphNodeData['kind'], overrides: Partial<GraphNodeData> = {}) {
  return {
    id,
    data: {
      kind,
      degree: 0,
      selected: false,
      dimmed: false,
      referenceCode: id.toUpperCase(),
      content: `content of ${id}`,
      rationale: `rationale of ${id}`,
      ...overrides,
    } satisfies GraphNodeData,
  };
}

function edge(source: string, target: string, relationship: GraphEdgeData['relationship']) {
  return { source, target, data: { relationship } };
}

// goal:1 ← (derived_from) requirement:5 → (depends_on) decision:7
const model: GraphModel = {
  nodes: [node('goal:1', 'goal'), node('requirement:5', 'requirement'), node('decision:7', 'decision')],
  edges: [edge('requirement:5', 'goal:1', 'derived_from'), edge('requirement:5', 'decision:7', 'depends_on')],
};

describe('buildGraphDetail', () => {
  it('returns null when the selected id is not in the model', () => {
    expect(buildGraphDetail('term:99', model)).toBeNull();
  });

  it('projects the selected node’s own fields from the model', () => {
    const detail = buildGraphDetail('requirement:5', model)!;
    expect(detail.kind).toBe('requirement');
    expect(detail.referenceCode).toBe('REQUIREMENT:5');
    expect(detail.content).toBe('content of requirement:5');
    expect(detail.rationale).toBe('rationale of requirement:5');
  });

  it('orients every incident edge from the selected node’s point of view', () => {
    const detail = buildGraphDetail('requirement:5', model)!;
    expect(detail.connections).toHaveLength(2);
    // Both edges leave the requirement, so both read as outgoing, carrying the other end's data.
    const byRef = new Map(detail.connections.map((c) => [c.otherReference, c]));
    expect(byRef.get('GOAL:1')).toMatchObject({
      direction: 'outgoing',
      relationship: 'derived_from',
      otherKind: 'goal',
      otherContent: 'content of goal:1',
    });
    expect(byRef.get('DECISION:7')).toMatchObject({ direction: 'outgoing', relationship: 'depends_on' });
  });

  it('reads an edge as incoming when the selected node is its target', () => {
    const detail = buildGraphDetail('goal:1', model)!;
    expect(detail.connections).toHaveLength(1);
    expect(detail.connections[0]).toMatchObject({
      direction: 'incoming',
      relationship: 'derived_from',
      otherReference: 'REQUIREMENT:5',
    });
  });

  it('reports no connections for an isolated node', () => {
    const lone: GraphModel = { nodes: [node('term:2', 'term')], edges: [] };
    expect(buildGraphDetail('term:2', lone)?.connections).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';

import type { GraphEdge } from '../../graph/schema/edges.js';
import type { GraphNode, NodeKind, NodePlane } from '../../graph/schema/nodes.js';
import { projectExecutionSpecSnapshot } from '../execution-spec-snapshot.js';

const base = {
  specId: 7,
  basis: 'explicit',
  settlement: 'settled',
  createdAtLsn: 1,
  updatedAtLsn: 1,
} as const;

function node(args: {
  id: number;
  plane: NodePlane;
  kind: NodeKind;
  kindOrdinal: number;
  title: string;
  body?: string;
}): GraphNode {
  return { ...base, ...args };
}

function edge(args: {
  id: number;
  category: GraphEdge['category'];
  sourceId: number;
  targetId: number;
  stance?: GraphEdge['stance'];
}): GraphEdge {
  const { stance, ...rest } = args;
  return stance ? { ...base, ...rest, stance } : { ...base, ...rest };
}

describe('projectExecutionSpecSnapshot', () => {
  it('projects requirements, criteria verifies links, mode, and execution context', () => {
    const requirementA = node({
      id: 10,
      plane: 'intent',
      kind: 'requirement',
      kindOrdinal: 2,
      title: 'Render graph canvas',
      body: 'Users can switch from list view to a spatial canvas.',
    });
    const requirementB = node({
      id: 11,
      plane: 'intent',
      kind: 'requirement',
      kindOrdinal: 1,
      title: 'Persist layout choice',
    });
    const criterion = node({
      id: 20,
      plane: 'intent',
      kind: 'criterion',
      kindOrdinal: 1,
      title: 'Canvas appears after toggle',
      body: 'A browser-level check proves the canvas is reachable after toggling.',
    });
    const antiCriterion = node({
      id: 21,
      plane: 'intent',
      kind: 'criterion',
      kindOrdinal: 2,
      title: 'Rejected witness',
    });
    const constraint = node({
      id: 30,
      plane: 'intent',
      kind: 'constraint',
      kindOrdinal: 1,
      title: 'Do not replace list view',
    });
    const decision = node({
      id: 31,
      plane: 'intent',
      kind: 'decision',
      kindOrdinal: 1,
      title: 'Use React Flow',
    });
    const sketch = node({
      id: 40,
      plane: 'design',
      kind: 'sketch',
      kindOrdinal: 1,
      title: 'Route-level canvas shell',
    });
    const check = node({
      id: 50,
      plane: 'oracle',
      kind: 'check',
      kindOrdinal: 1,
      title: 'Playwright viewport check',
    });

    const snapshot = projectExecutionSpecSnapshot({
      specId: 7,
      mode: 'brownfield',
      nodes: [requirementA, criterion, check, requirementB, antiCriterion, sketch, decision, constraint],
      edges: [
        edge({
          id: 1,
          category: 'witness',
          sourceId: criterion.id,
          targetId: requirementA.id,
          stance: 'for',
        }),
        edge({
          id: 2,
          category: 'witness',
          sourceId: criterion.id,
          targetId: requirementB.id,
          stance: 'for',
        }),
        edge({
          id: 3,
          category: 'witness',
          sourceId: antiCriterion.id,
          targetId: requirementA.id,
          stance: 'against',
        }),
        edge({
          id: 4,
          category: 'rationale',
          sourceId: criterion.id,
          targetId: requirementA.id,
          stance: 'for',
        }),
      ],
    });

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.specId).toBe('7');
    expect(snapshot.mode).toBe('brownfield');
    expect(snapshot.requirements.map((item) => item.itemId)).toEqual(['REQ1', 'REQ2']);
    expect(snapshot.requirements[0]).toMatchObject({
      title: 'Persist layout choice',
      content: 'Persist layout choice',
    });
    expect(snapshot.criteria).toEqual([
      expect.objectContaining({
        itemId: 'AC1',
        content: 'A browser-level check proves the canvas is reachable after toggling.',
        verifies: ['REQ1', 'REQ2'],
      }),
      expect.objectContaining({ itemId: 'AC2', verifies: [] }),
    ]);
    expect(snapshot.context.constraints.map((item) => item.itemId)).toEqual(['CON1']);
    expect(snapshot.context.decisions.map((item) => item.itemId)).toEqual(['D1']);
    expect(snapshot.context.design.map((item) => item.itemId)).toEqual(['SKT1']);
    expect(snapshot.context.oracle.map((item) => item.itemId)).toEqual(['CH1']);
  });
});

import { describe, expect, it } from 'vitest';

import type { GraphEdgeData, GraphNodeData } from '@/views/graph/types.js';
import { forceLayout } from '@/views/graph/forceLayout.js';

/**
 * Behavioral contract for the `forceLayout` pass.
 *
 * `forceLayout` takes a graph model (React-Flow-shaped nodes + edges) and runs
 * a d3-force simulation to convergence *synchronously*, returning final node
 * positions. There is no animated fly-in: the positions handed back are the
 * settled layout. These tests pin the observable spatial properties the slice
 * promises — connected items cluster, dense hubs sit centrally, and orphans are
 * pushed to the periphery — plus the structural guarantees React Flow needs.
 */

interface LayoutNodeInput {
  id: string;
  data: GraphNodeData;
}

interface LayoutEdgeInput {
  id: string;
  source: string;
  target: string;
  data: GraphEdgeData;
}

interface GraphModel {
  nodes: LayoutNodeInput[];
  edges: LayoutEdgeInput[];
}

interface Point {
  x: number;
  y: number;
}

function makeNode(id: string, kind: GraphNodeData['kind'] = 'term'): LayoutNodeInput {
  return { id, data: { kind, degree: 0, selected: false, dimmed: false } };
}

function makeEdge(
  source: string,
  target: string,
  relationship: GraphEdgeData['relationship'] = 'depends_on',
): LayoutEdgeInput {
  return { id: `${source}->${target}`, source, target, data: { relationship } };
}

/** Fully connect every pair of the given node ids with edges. */
function clique(ids: string[]): LayoutEdgeInput[] {
  const edges: LayoutEdgeInput[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      edges.push(makeEdge(ids[i]!, ids[j]!));
    }
  }
  return edges;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function centroid(points: Point[]): Point {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/** Index the returned positioned nodes by id, asserting each carries a finite point. */
function positionsById(result: ReadonlyArray<{ id: string; position: Point }>): Map<string, Point> {
  const map = new Map<string, Point>();
  for (const node of result) {
    expect(Number.isFinite(node.position.x)).toBe(true);
    expect(Number.isFinite(node.position.y)).toBe(true);
    map.set(node.id, node.position);
  }
  return map;
}

describe('forceLayout', () => {
  it('returns a finite position for every node, keyed by id', () => {
    const model: GraphModel = {
      nodes: [makeNode('a'), makeNode('b'), makeNode('c')],
      edges: [makeEdge('a', 'b'), makeEdge('b', 'c')],
    };

    const result = forceLayout(model);

    expect(result).toHaveLength(3);
    const positions = positionsById(result);
    expect([...positions.keys()].sort()).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty layout for an empty graph', () => {
    expect(forceLayout({ nodes: [], edges: [] })).toEqual([]);
  });

  it('places a lone node at a finite position', () => {
    const result = forceLayout({ nodes: [makeNode('solo')], edges: [] });

    expect(result).toHaveLength(1);
    const positions = positionsById(result);
    expect(positions.has('solo')).toBe(true);
  });

  it('preserves each node’s render data alongside its position', () => {
    const model: GraphModel = {
      nodes: [makeNode('goal-1', 'goal'), makeNode('req-1', 'requirement')],
      edges: [makeEdge('req-1', 'goal-1', 'derived_from')],
    };

    const result = forceLayout(model);

    const byId = new Map(result.map((node) => [node.id, node]));
    expect((byId.get('goal-1') as { data: GraphNodeData }).data.kind).toBe('goal');
    expect((byId.get('req-1') as { data: GraphNodeData }).data.kind).toBe('requirement');
  });

  it('settles to a stable, converged layout (no fly-in: identical positions on repeat)', () => {
    const build = (): GraphModel => ({
      nodes: ['a', 'b', 'c', 'd', 'e'].map((id) => makeNode(id)),
      edges: [makeEdge('a', 'b'), makeEdge('b', 'c'), makeEdge('c', 'd'), makeEdge('d', 'e')],
    });

    const first = positionsById(forceLayout(build()));
    const second = positionsById(forceLayout(build()));

    for (const [id, point] of first) {
      const other = second.get(id)!;
      expect(other.x).toBeCloseTo(point.x, 3);
      expect(other.y).toBeCloseTo(point.y, 3);
    }
  });

  it('clusters connected items: each node’s nearest neighbor shares its cluster', () => {
    const clusterA = ['a0', 'a1', 'a2', 'a3'];
    const clusterB = ['b0', 'b1', 'b2', 'b3'];
    const model: GraphModel = {
      nodes: [...clusterA, ...clusterB].map((id) => makeNode(id)),
      edges: [...clique(clusterA), ...clique(clusterB)],
    };

    const positions = positionsById(forceLayout(model));
    const clusterOf = (id: string) => (clusterA.includes(id) ? 'A' : 'B');

    for (const [id, point] of positions) {
      let nearest: string | undefined;
      let nearestDist = Infinity;
      for (const [otherId, otherPoint] of positions) {
        if (otherId === id) continue;
        const d = distance(point, otherPoint);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = otherId;
        }
      }
      expect(clusterOf(nearest!)).toBe(clusterOf(id));
    }
  });

  it('keeps two disconnected clusters spatially separated', () => {
    const clusterA = ['a0', 'a1', 'a2', 'a3'];
    const clusterB = ['b0', 'b1', 'b2', 'b3'];
    const model: GraphModel = {
      nodes: [...clusterA, ...clusterB].map((id) => makeNode(id)),
      edges: [...clique(clusterA), ...clique(clusterB)],
    };

    const positions = positionsById(forceLayout(model));
    const pointsA = clusterA.map((id) => positions.get(id)!);
    const pointsB = clusterB.map((id) => positions.get(id)!);

    const diameter = (pts: Point[]) =>
      Math.max(...pts.flatMap((p) => pts.map((q) => distance(p, q))));
    const separation = distance(centroid(pointsA), centroid(pointsB));

    expect(separation).toBeGreaterThan(diameter(pointsA));
    expect(separation).toBeGreaterThan(diameter(pointsB));
  });

  it('places a dense hub centrally among its neighbors', () => {
    const leaves = ['l0', 'l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7'];
    const model: GraphModel = {
      nodes: [makeNode('hub'), ...leaves.map((id) => makeNode(id))],
      edges: leaves.map((id) => makeEdge('hub', id)),
    };

    const positions = positionsById(forceLayout(model));
    const center = centroid([...positions.values()]);

    const hubDistance = distance(positions.get('hub')!, center);
    const avgLeafDistance =
      leaves.reduce((sum, id) => sum + distance(positions.get(id)!, center), 0) / leaves.length;

    expect(hubDistance).toBeLessThan(avgLeafDistance);
  });

  it('pushes an orphan node to the periphery', () => {
    const connected = ['c0', 'c1', 'c2', 'c3'];
    const model: GraphModel = {
      nodes: [...connected, 'orphan'].map((id) => makeNode(id)),
      edges: clique(connected),
    };

    const positions = positionsById(forceLayout(model));
    const center = centroid([...positions.values()]);

    const orphanDistance = distance(positions.get('orphan')!, center);
    const maxConnectedDistance = Math.max(
      ...connected.map((id) => distance(positions.get(id)!, center)),
    );

    expect(orphanDistance).toBeGreaterThan(maxConnectedDistance);
  });
});

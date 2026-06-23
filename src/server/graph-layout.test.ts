/**
 * Behavioral contract for the retuned `forceLayout` pass.
 *
 * The layout uses CARD-tuned forces: a collision force sized to the single
 * uniform collapsed card footprint, with link distance / charge retuned so
 * cards settle WITHOUT OVERLAPPING while preserving the organic,
 * relationship-clustered feel. Layout still settles synchronously to
 * convergence before first paint (settle-once: identical positions on repeat,
 * no animated fly-in).
 *
 * These tests pin the observable spatial properties:
 *   - every card carries a finite, settled position (structural)
 *   - the layout is deterministic / settle-once
 *   - connected items cluster, hubs sit centrally, orphans drift outward
 *     (organic feel is preserved)
 *   - cards no longer overlap and are separated at CARD scale, not dot scale
 *     (the collision behavior)
 *
 * They are written against the public `forceLayout` surface and the shared
 * `cardFootprint`, never against the simulation's internal force constants.
 */

import { describe, expect, it } from 'vitest';

import { cardFootprint } from '@/views/graph/cardFootprint';
import { forceLayout, kindRank } from '@/views/graph/forceLayout.js';
import { collisionRadius } from '@/views/graph/graphForces.js';
import type { GraphEdgeData, GraphNodeData } from '@/views/graph/types.js';

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
  return {
    id,
    data: { kind, degree: 0, selected: false, dimmed: false, referenceCode: '', content: '', rationale: '' },
  };
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

/** Smallest centre-to-centre distance between any two distinct cards. */
function minPairwiseDistance(points: Point[]): number {
  let min = Infinity;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      min = Math.min(min, distance(points[i]!, points[j]!));
    }
  }
  return min;
}

describe('forceLayout — structural guarantees', () => {
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
    expect(positionsById(result).has('solo')).toBe(true);
  });

  it('preserves each node’s render data alongside its position', () => {
    const model: GraphModel = {
      nodes: [makeNode('goal-1', 'goal'), makeNode('req-1', 'requirement')],
      edges: [makeEdge('req-1', 'goal-1', 'derived_from')],
    };

    const byId = new Map(forceLayout(model).map((node) => [node.id, node]));
    expect((byId.get('goal-1') as { data: GraphNodeData }).data.kind).toBe('goal');
    expect((byId.get('req-1') as { data: GraphNodeData }).data.kind).toBe('requirement');
  });

  it('settles once to a stable, converged layout (identical positions on repeat)', () => {
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
});

describe('forceLayout — cards settle without overlapping (collision sized to footprint)', () => {
  it('separates connected cards by at least a card footprint, not dot scale', () => {
    // A chain of cards: link force pulls neighbours together, but the
    // footprint-sized collision floor keeps every card at card scale apart.
    const model: GraphModel = {
      nodes: ['a', 'b', 'c', 'd', 'e'].map((id) => makeNode(id)),
      edges: [makeEdge('a', 'b'), makeEdge('b', 'c'), makeEdge('c', 'd'), makeEdge('d', 'e')],
    };

    const positions = [...positionsById(forceLayout(model)).values()];

    // Dot-tuned layout settled neighbours ~40px apart (smaller than the card).
    // A footprint-sized collision force must hold them at least a card apart.
    expect(minPairwiseDistance(positions)).toBeGreaterThanOrEqual(cardFootprint.height);
  });

  it('keeps even a dense clique of cards from overlapping', () => {
    // The hardest case for collision: every card is linked to every other, so
    // link attraction is maximal. Collision must still win.
    const ids = ['n0', 'n1', 'n2', 'n3', 'n4', 'n5'];
    const model: GraphModel = { nodes: ids.map((id) => makeNode(id)), edges: clique(ids) };

    const positions = [...positionsById(forceLayout(model)).values()];

    expect(minPairwiseDistance(positions)).toBeGreaterThanOrEqual(cardFootprint.height);
  });

  it('no two card bounding boxes overlap in a mixed graph', () => {
    // Two linked clusters plus a hub and an orphan — a representative spread.
    const clusterA = ['a0', 'a1', 'a2', 'a3'];
    const clusterB = ['b0', 'b1', 'b2', 'b3'];
    const leaves = ['l0', 'l1', 'l2'];
    const model: GraphModel = {
      nodes: [...clusterA, ...clusterB, 'hub', ...leaves, 'orphan'].map((id) => makeNode(id)),
      edges: [
        ...clique(clusterA),
        ...clique(clusterB),
        makeEdge('a0', 'b0'),
        ...leaves.map((id) => makeEdge('hub', id)),
      ],
    };

    const positions = [...positionsById(forceLayout(model)).values()];

    // Each card occupies a width×height axis-aligned box centred on its
    // position. Two boxes overlap iff they are within width on x AND height on
    // y. A footprint-sized collision force must prevent that for every pair.
    // A 1px tolerance absorbs the simulation's convergence epsilon.
    const tol = 1;
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = Math.abs(positions[i]!.x - positions[j]!.x);
        const dy = Math.abs(positions[i]!.y - positions[j]!.y);
        const separated = dx >= cardFootprint.width - tol || dy >= cardFootprint.height - tol;
        expect(separated).toBe(true);
      }
    }
  });
});

describe('forceLayout — organic relationship-clustered feel is preserved', () => {
  it('clusters connected items: each card’s nearest neighbour shares its cluster', () => {
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

    const diameter = (pts: Point[]) => Math.max(...pts.flatMap((p) => pts.map((q) => distance(p, q))));
    const separation = distance(centroid(pointsA), centroid(pointsB));

    expect(separation).toBeGreaterThan(diameter(pointsA));
    expect(separation).toBeGreaterThan(diameter(pointsB));
  });

  it('places a dense hub centrally among its neighbours', () => {
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

  it('pushes an orphan card to the periphery', () => {
    const connected = ['c0', 'c1', 'c2', 'c3'];
    const model: GraphModel = {
      nodes: [...connected, 'orphan'].map((id) => makeNode(id)),
      edges: clique(connected),
    };

    const positions = positionsById(forceLayout(model));
    const center = centroid([...positions.values()]);

    const orphanDistance = distance(positions.get('orphan')!, center);
    const maxConnectedDistance = Math.max(...connected.map((id) => distance(positions.get(id)!, center)));

    expect(orphanDistance).toBeGreaterThan(maxConnectedDistance);
  });

  it('keeps a lone orphan within a graph-scaled radius rather than flinging it far', () => {
    const connected = ['c0', 'c1', 'c2', 'c3'];
    const model: GraphModel = {
      nodes: [...connected, 'orphan'].map((id) => makeNode(id)),
      edges: clique(connected),
    };

    const positions = positionsById(forceLayout(model));
    const orphan = positions.get('orphan')!;
    const boundRadius = collisionRadius * (3 + Math.sqrt(model.nodes.length));

    expect(Math.hypot(orphan.x, orphan.y)).toBeLessThanOrEqual(boundRadius * 1.2);
  });
});

describe('forceLayout — knowledge hierarchy lays out top-to-bottom by kind', () => {
  // One node per kind, wired along the natural hierarchy, so the vertical bias
  // has a real multi-kind graph to tilt into layers.
  const model: GraphModel = {
    nodes: [
      makeNode('goal', 'goal'),
      makeNode('context', 'context'),
      makeNode('term', 'term'),
      makeNode('constraint', 'constraint'),
      makeNode('decision', 'decision'),
      makeNode('assumption', 'assumption'),
      makeNode('requirement', 'requirement'),
      makeNode('criterion', 'criterion'),
    ],
    edges: [
      makeEdge('requirement', 'goal', 'derived_from'),
      makeEdge('criterion', 'requirement', 'verifies'),
      makeEdge('requirement', 'decision', 'depends_on'),
      makeEdge('constraint', 'requirement', 'constrains'),
    ],
  };

  it('settles shallow-rank kinds above deep-rank kinds on average', () => {
    const positions = positionsById(forceLayout(model));
    const layerY = (kind: GraphNodeData['kind']) => positions.get(kind)!.y;
    const meanY = (kinds: readonly GraphNodeData['kind'][]) =>
      kinds.reduce((sum, k) => sum + layerY(k), 0) / kinds.length;

    // The bias is deliberately gentle, so any single node may interleave (an
    // orphan floats to its band, a link-tethered node is pulled toward its
    // neighbour). What holds is the aggregate tilt: the shallow framing layers
    // (ranks 0–1) sit above the deep requirement/criterion layers (ranks 3–4).
    const shallow = ['goal', 'context', 'term', 'constraint'] as const;
    const deep = ['requirement', 'criterion'] as const;
    for (const k of shallow) expect(kindRank[k]).toBeLessThanOrEqual(1);
    for (const k of deep) expect(kindRank[k]).toBeGreaterThanOrEqual(3);

    expect(meanY(shallow)).toBeLessThan(meanY(deep));
  });

  it('places the rank-0 goal above the rank-4 criterion', () => {
    const positions = positionsById(forceLayout(model));
    expect(positions.get('goal')!.y).toBeLessThan(positions.get('criterion')!.y);
  });
});

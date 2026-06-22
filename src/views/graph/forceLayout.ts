/**
 * d3-force layout pass: ticks to convergence synchronously (no fly-in) so connected items cluster,
 * hubs centre, and orphans drift out, with a gentle per-kind vertical bias (`kindRank`) tilting the
 * knowledge hierarchy top-to-bottom without overpowering the clustering.
 */

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';

import { cardFootprint } from '@/views/graph/cardFootprint';

import type { GraphEdgeData, GraphNodeData, GraphNodeKind } from './types.js';

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

/** A node with its settled layout position. */
export interface PositionedNode {
  id: string;
  data: GraphNodeData;
  position: { x: number; y: number };
}

interface SimNode extends SimulationNodeDatum {
  id: string;
  data: GraphNodeData;
}

/** Vertical layer per kind, top (0) to bottom: goals → framing → design → requirements → criteria. */
export const kindRank: Record<GraphNodeKind, number> = {
  goal: 0,
  context: 1,
  term: 1,
  constraint: 1,
  decision: 2,
  assumption: 2,
  requirement: 3,
  criterion: 4,
};

/** Vertical spacing between adjacent layers, in pixels. */
const LAYER_HEIGHT = 260;

/** Target y for a kind's layer, centred so the middle layer sits near the origin. */
function layerY(kind: GraphNodeKind): number {
  return (kindRank[kind] - 2) * LAYER_HEIGHT;
}

/**
 * Deterministic PRNG (mulberry32) so the simulation converges to identical
 * positions on every run — d3's force jiggle otherwise pulls from Math.random.
 */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function forceLayout(model: GraphModel): PositionedNode[] {
  if (model.nodes.length === 0) {
    return [];
  }

  const nodes: SimNode[] = model.nodes.map((node) => ({
    id: node.id,
    data: node.data,
  }));

  const links: SimulationLinkDatum<SimNode>[] = model.edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
  }));

  // Collision radius sized so that the circular collision floor guarantees the
  // uniform collapsed card boxes (width×height) can never overlap: half the box
  // diagonal is the largest centre-to-centre distance at which two boxes still
  // touch, so packing to that radius keeps every pair separated on x or y.
  const collisionRadius = Math.hypot(cardFootprint.width, cardFootprint.height) / 2;

  // forceCenter only re-centres (never compresses), so charge/collision keep the organic 2D shape;
  // the weak forceY toward each kind's layer tilts it top-to-bottom without flattening same-kind clusters.
  const simulation = forceSimulation<SimNode>(nodes)
    .randomSource(seededRandom(0x9e3779b9))
    .force(
      'link',
      forceLink<SimNode, SimulationLinkDatum<SimNode>>(links)
        .id((node) => node.id)
        .distance(collisionRadius * 2),
    )
    .force('charge', forceManyBody<SimNode>().strength(-800))
    .force('collide', forceCollide<SimNode>(collisionRadius).strength(1).iterations(4))
    .force('center', forceCenter(0, 0))
    .force('y', forceY<SimNode>((node) => layerY(node.data.kind)).strength(0.06))
    .stop();

  // Tick to convergence synchronously. Mirrors d3's default cooling schedule:
  // run until alpha decays below alphaMin.
  const alphaMin = simulation.alphaMin();
  const alphaDecay = simulation.alphaDecay();
  const iterations = Math.ceil(Math.log(alphaMin) / Math.log(1 - alphaDecay));
  simulation.tick(iterations);

  return nodes.map((node) => ({
    id: node.id,
    data: node.data,
    position: { x: node.x ?? 0, y: node.y ?? 0 },
  }));
}

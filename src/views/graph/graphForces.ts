/**
 * Shared d3-force configuration for the graph canvas: the single definition of the
 * forces, per-kind vertical layering, collision footprint, and deterministic seed.
 * Both the synchronous `forceLayout` pass and the live simulation consume this, so
 * their physics can never drift out of tune.
 */

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';

import { cardFootprint } from '@/views/graph/cardFootprint';

import type { GraphNodeData, GraphNodeKind } from './types.js';

/** A simulation node: the layout id + render data, with d3's mutable x/y/vx/vy/fx/fy. */
export interface SimNode extends SimulationNodeDatum {
  id: string;
  data: GraphNodeData;
}

export type SimLink = SimulationLinkDatum<SimNode>;

/** Minimal node input the simulation needs — id plus the kind-carrying render data. */
export interface SimInputNode {
  id: string;
  data: GraphNodeData;
}

/** Minimal edge input — just the endpoints to wire the link force. */
export interface SimInputEdge {
  source: string;
  target: string;
}

export interface SimModel {
  nodes: SimInputNode[];
  edges: SimInputEdge[];
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
export function layerY(kind: GraphNodeKind): number {
  return (kindRank[kind] - 2) * LAYER_HEIGHT;
}

/**
 * Collision radius sized so the circular collision floor guarantees the uniform
 * collapsed card boxes (width×height) can never overlap: half the box diagonal is
 * the largest centre-to-centre distance at which two boxes still touch, so packing
 * to that radius keeps every pair separated on x or y.
 */
export const collisionRadius = Math.hypot(cardFootprint.width, cardFootprint.height) / 2;

/** Seed for the deterministic random source — d3's jiggle otherwise pulls from Math.random. */
const GRAPH_SEED = 0x9e3779b9;

/**
 * Deterministic PRNG (mulberry32) so the simulation converges to identical
 * positions on every run.
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

/**
 * Build a *stopped* simulation with all forces wired and the deterministic random
 * source installed. The caller decides whether to tick to convergence synchronously
 * (`forceLayout`) or drive it live — this is the one place the forces are configured.
 *
 * forceCenter only re-centres (never compresses), so charge/collision keep the organic
 * 2D shape; the weak forceY toward each kind's layer tilts it top-to-bottom without
 * flattening same-kind clusters.
 */
export function buildSimulation(model: SimModel): {
  simulation: Simulation<SimNode, SimLink>;
  nodes: SimNode[];
} {
  const nodes: SimNode[] = model.nodes.map((node) => ({ id: node.id, data: node.data }));
  const links: SimLink[] = model.edges.map((edge) => ({ source: edge.source, target: edge.target }));

  const simulation = forceSimulation<SimNode>(nodes)
    .randomSource(seededRandom(GRAPH_SEED))
    .force(
      'link',
      forceLink<SimNode, SimLink>(links)
        .id((node) => node.id)
        .distance(collisionRadius * 2),
    )
    .force('charge', forceManyBody<SimNode>().strength(-800))
    .force('collide', forceCollide<SimNode>(collisionRadius).strength(1).iterations(4))
    .force('center', forceCenter(0, 0))
    .force('y', forceY<SimNode>((node) => layerY(node.data.kind)).strength(0.06))
    .stop();

  return { simulation, nodes };
}

/**
 * Iterations to reach convergence synchronously. Mirrors d3's default cooling
 * schedule: run until alpha decays below alphaMin.
 */
export function convergenceTicks(simulation: Simulation<SimNode, SimLink>): number {
  return Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()));
}

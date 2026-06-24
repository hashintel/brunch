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

import { cardFootprint } from '@/client/components/graph/cardFootprint';

import type { GraphNodeData, GraphNodeKind } from './types.js';

export interface SimNode extends SimulationNodeDatum {
  id: string;
  data: GraphNodeData;
}

export type SimLink = SimulationLinkDatum<SimNode>;

export interface SimInputNode {
  id: string;
  data: GraphNodeData;
}

export interface SimInputEdge {
  source: string;
  target: string;
}

export interface SimModel {
  nodes: SimInputNode[];
  edges: SimInputEdge[];
}

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

const LAYER_HEIGHT = 260;

export function layerY(kind: GraphNodeKind): number {
  return (kindRank[kind] - 2) * LAYER_HEIGHT;
}

export const collisionRadius = Math.hypot(cardFootprint.width, cardFootprint.height) / 2;

function radialBound(radius: number): (alpha: number) => void {
  let nodes: SimNode[] = [];
  const force = (alpha: number) => {
    for (const node of nodes) {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const dist = Math.hypot(x, y);
      if (dist > radius) {
        const pull = ((dist - radius) / dist) * alpha;
        node.vx = (node.vx ?? 0) - x * pull;
        node.vy = (node.vy ?? 0) - y * pull;
      }
    }
  };
  force.initialize = (simNodes: SimNode[]) => {
    nodes = simNodes;
  };
  return force;
}

const GRAPH_SEED = 0x9e3779b9;

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

export function buildSimulation(model: SimModel): {
  simulation: Simulation<SimNode, SimLink>;
  nodes: SimNode[];
} {
  const nodes: SimNode[] = model.nodes.map((node) => ({ id: node.id, data: node.data }));
  const links: SimLink[] = model.edges.map((edge) => ({ source: edge.source, target: edge.target }));

  const boundRadius = collisionRadius * (3 + Math.sqrt(nodes.length));

  const simulation = forceSimulation<SimNode>(nodes)
    .randomSource(seededRandom(GRAPH_SEED))
    .force(
      'link',
      forceLink<SimNode, SimLink>(links)
        .id((node) => node.id)
        .distance(collisionRadius * 2),
    )
    // Charge scales with the card footprint (∝ collisionRadius²) so cluster
    // separation and the overall layout shape stay the same as the card size changes.
    .force('charge', forceManyBody<SimNode>().strength(-(collisionRadius * collisionRadius) * 0.092))
    .force('collide', forceCollide<SimNode>(collisionRadius).strength(1).iterations(4))
    .force('center', forceCenter(0, 0))
    .force('y', forceY<SimNode>((node) => layerY(node.data.kind)).strength(0.06))
    .force('bound', radialBound(boundRadius))
    .stop();

  return { simulation, nodes };
}

export function convergenceTicks(simulation: Simulation<SimNode, SimLink>): number {
  return Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()));
}

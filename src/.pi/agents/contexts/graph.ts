import { formatGraphNodeCode, type GraphNode } from '../../../graph/schema/nodes.js';
import type { GraphOverview } from '../../../graph/snapshot.js';
import type { AgentLensSelection } from '../../../session/runtime-state.js';

export interface RenderGraphContextOptions {
  readonly lens: AgentLensSelection;
  readonly maxNodes?: number;
  readonly maxEdges?: number;
}

const DEFAULT_MAX_NODES = 8;
const DEFAULT_MAX_EDGES = 8;

export function renderGraphContext(overview: GraphOverview, options: RenderGraphContextOptions): string {
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  const maxEdges = options.maxEdges ?? DEFAULT_MAX_EDGES;
  const emphasizedNodes = [...overview.nodes].sort((a, b) => {
    const byLens = lensScore(b, options.lens) - lensScore(a, options.lens);
    return byLens || a.id - b.id;
  });
  const nodesById = new Map(overview.nodes.map((node) => [node.id, node]));

  const lines = [
    `[Selected-spec graph context · ${options.lens} lens]`,
    `- selected-spec lsn: ${overview.lsn}; nodes: ${overview.nodeCount}; edges: ${overview.edgeCount}`,
    `- emphasis: ${lensEmphasis(options.lens)}`,
  ];

  if (overview.nodeCount === 0) {
    lines.push('- graph: empty');
    return lines.join('\n');
  }

  lines.push('- emphasized nodes:');
  for (const node of emphasizedNodes.slice(0, maxNodes)) {
    lines.push(`  - ${formatNode(node)}`);
  }
  if (overview.nodes.length > maxNodes) {
    lines.push(`  - …${overview.nodes.length - maxNodes} more node(s) omitted`);
  }

  if (overview.edges.length > 0) {
    lines.push('- edges:');
    for (const edge of overview.edges.slice(0, maxEdges)) {
      const stance = edge.stance ? `/${edge.stance}` : '';
      const source = nodesById.get(edge.sourceId);
      const target = nodesById.get(edge.targetId);
      const sourceCode = source ? formatGraphNodeCode(source.kind, source.kindOrdinal) : `#${edge.sourceId}`;
      const targetCode = target ? formatGraphNodeCode(target.kind, target.kindOrdinal) : `#${edge.targetId}`;
      lines.push(`  - ${sourceCode} -[${edge.category}${stance}]-> ${targetCode}`);
    }
    if (overview.edges.length > maxEdges) {
      lines.push(`  - …${overview.edges.length - maxEdges} more edge(s) omitted`);
    }
  }

  return lines.join('\n');
}

function lensScore(node: GraphNode, lens: AgentLensSelection): number {
  if (node.plane === lens) return 4;
  if (lens === 'intent' && node.plane === 'plan') return 1;
  if (lens === 'design' && (node.plane === 'intent' || node.plane === 'plan')) return 1;
  if (lens === 'oracle' && node.kind === 'invariant') return 2;
  return 0;
}

function lensEmphasis(lens: AgentLensSelection): string {
  switch (lens) {
    case 'intent':
      return 'intent claims, terms, assumptions, constraints, and decisions first';
    case 'design':
      return 'design modules/interfaces and boundary implications first';
    case 'oracle':
      return 'verification checks, evidence, obligations, and proof gaps first';
    case 'auto':
      return 'AUTO lens selection pending; keep intent, design, and oracle cues visible';
  }
}

function formatNode(node: GraphNode): string {
  const body = node.body ? ` — ${truncate(node.body, 120)}` : '';
  return `[${formatGraphNodeCode(node.kind, node.kindOrdinal)}] ${node.plane}/${node.kind}: ${node.title}${body}`;
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

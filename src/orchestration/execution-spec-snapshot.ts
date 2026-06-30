import type { GraphEdge } from '../graph/schema/edges.js';
import { formatGraphNodeCode, type GraphNode, type NodeKind } from '../graph/schema/nodes.js';

export type ExecutionSpecMode = 'greenfield' | 'brownfield';

export interface ExecutionSpecItemSnapshot {
  readonly itemId: string;
  readonly nodeId: number;
  readonly title: string;
  readonly content: string;
}

export interface ExecutionSpecCriterionSnapshot extends ExecutionSpecItemSnapshot {
  readonly verifies: readonly string[];
}

export interface ExecutionSpecContextSnapshot {
  readonly constraints: readonly ExecutionSpecItemSnapshot[];
  readonly invariants: readonly ExecutionSpecItemSnapshot[];
  readonly decisions: readonly ExecutionSpecItemSnapshot[];
  readonly examples: readonly ExecutionSpecItemSnapshot[];
  readonly design: readonly ExecutionSpecItemSnapshot[];
  readonly oracle: readonly ExecutionSpecItemSnapshot[];
}

export interface ExecutionSpecSnapshot {
  readonly schemaVersion: 1;
  readonly specId: string;
  readonly mode: ExecutionSpecMode;
  readonly requirements: readonly ExecutionSpecItemSnapshot[];
  readonly criteria: readonly ExecutionSpecCriterionSnapshot[];
  readonly context: ExecutionSpecContextSnapshot;
}

export interface ProjectExecutionSpecSnapshotInput {
  readonly specId: number | string;
  readonly mode: ExecutionSpecMode;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

const CONTEXT_KINDS = [
  'constraint',
  'invariant',
  'decision',
  'example',
] as const satisfies readonly NodeKind[];
const DESIGN_KINDS = ['module', 'interface', 'entity', 'sketch'] as const satisfies readonly NodeKind[];
const ORACLE_KINDS = [
  'check',
  'vv_method',
  'evidence',
  'vv_obligation',
] as const satisfies readonly NodeKind[];

type ContextKind = (typeof CONTEXT_KINDS)[number];

export function projectExecutionSpecSnapshot(
  input: ProjectExecutionSpecSnapshotInput,
): ExecutionSpecSnapshot {
  const nodes = [...input.nodes].sort(byKindOrdinalThenId);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const requirementIds = new Set(nodes.filter((node) => node.kind === 'requirement').map((node) => node.id));
  const criteria = nodes.filter((node) => node.kind === 'criterion');

  return {
    schemaVersion: 1,
    specId: String(input.specId),
    mode: input.mode,
    requirements: nodes.filter((node) => node.kind === 'requirement').map(itemSnapshot),
    criteria: criteria.map((criterion) => ({
      ...itemSnapshot(criterion),
      verifies: verifiesRequirementItemIds(criterion, input.edges, nodeById, requirementIds),
    })),
    context: {
      constraints: contextItems(nodes, 'constraint'),
      invariants: contextItems(nodes, 'invariant'),
      decisions: contextItems(nodes, 'decision'),
      examples: contextItems(nodes, 'example'),
      design: nodes.filter((node) => DESIGN_KINDS.includes(node.kind as never)).map(itemSnapshot),
      oracle: nodes.filter((node) => ORACLE_KINDS.includes(node.kind as never)).map(itemSnapshot),
    },
  };
}

function verifiesRequirementItemIds(
  criterion: GraphNode,
  edges: readonly GraphEdge[],
  nodeById: ReadonlyMap<number, GraphNode>,
  requirementIds: ReadonlySet<number>,
): readonly string[] {
  const ids = new Set<string>();
  for (const edge of edges) {
    if (edge.category !== 'witness' || edge.stance === 'against') continue;
    if (edge.sourceId !== criterion.id) continue;
    if (!requirementIds.has(edge.targetId)) continue;
    const requirement = nodeById.get(edge.targetId);
    if (requirement) ids.add(itemId(requirement));
  }
  return [...ids].sort();
}

function contextItems(nodes: readonly GraphNode[], kind: ContextKind): readonly ExecutionSpecItemSnapshot[] {
  return nodes.filter((node) => node.kind === kind).map(itemSnapshot);
}

function itemSnapshot(node: GraphNode): ExecutionSpecItemSnapshot {
  return {
    itemId: itemId(node),
    nodeId: node.id,
    title: node.title,
    content: node.body ?? node.title,
  };
}

function itemId(node: GraphNode): string {
  return formatGraphNodeCode(node.kind, node.kindOrdinal);
}

function byKindOrdinalThenId(a: GraphNode, b: GraphNode): number {
  return a.kindOrdinal - b.kindOrdinal || a.id - b.id;
}

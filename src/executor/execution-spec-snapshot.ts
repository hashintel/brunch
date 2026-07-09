import type { GraphEdge } from '../graph/schema/edges.js';
import { formatGraphNodeCode, type GraphNode, type NodeKind } from '../graph/schema/nodes.js';

export type ExecutionSpecMode = 'greenfield' | 'brownfield';

export interface ExecutionSpecItemSnapshot {
  readonly itemId: string;
  readonly nodeId: number;
  readonly title: string;
  readonly content: string;
  readonly dependsOn: readonly string[];
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

export interface ExecutionSpecScopeSnapshot extends ExecutionSpecItemSnapshot {
  readonly frontierIds: readonly string[];
  readonly requirementIds: readonly string[];
  readonly criteria: readonly ExecutionSpecCriterionSnapshot[];
  readonly design: readonly ExecutionSpecItemSnapshot[];
  readonly verification: readonly ExecutionSpecItemSnapshot[];
}

export interface ExecutionSpecSnapshot {
  readonly schemaVersion: 1;
  readonly specId: string;
  readonly mode: ExecutionSpecMode;
  readonly frontiers: readonly ExecutionSpecItemSnapshot[];
  readonly requirements: readonly ExecutionSpecItemSnapshot[];
  readonly criteria: readonly ExecutionSpecCriterionSnapshot[];
  readonly scopes: readonly ExecutionSpecScopeSnapshot[];
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
  const requirementItemIds = new Map(
    nodes.filter((node) => node.kind === 'requirement').map((node) => [node.id, itemId(node)]),
  );
  const requirementDependencies = dependencyItemIdsByRequirement(input.edges, requirementItemIds);
  const criteria = nodes.filter((node) => node.kind === 'criterion');
  const criteriaById = new Map(
    criteria.map((criterion) => [criterion.id, {
      ...itemSnapshot(criterion),
      verifies: verifiesRequirementItemIds(criterion, input.edges, nodeById, requirementIds),
    }]),
  );
  const frontierItems = nodes.filter((node) => node.kind === 'frontier').map((node) => itemSnapshot(node));

  return {
    schemaVersion: 1,
    specId: String(input.specId),
    mode: input.mode,
    frontiers: frontierItems,
    requirements: nodes
      .filter((node) => node.kind === 'requirement')
      .map((node) => itemSnapshot(node, requirementDependencies.get(itemId(node)) ?? [])),
    criteria: [...criteriaById.values()],
    scopes: nodes
      .filter((node) => node.kind === 'scope')
      .map((node) =>
        scopeSnapshot({
          node,
          edges: input.edges,
          nodeById,
          criteriaById,
          requirementDependencies,
        }),
      ),
    context: {
      constraints: contextItems(nodes, 'constraint'),
      invariants: contextItems(nodes, 'invariant'),
      decisions: contextItems(nodes, 'decision'),
      examples: contextItems(nodes, 'example'),
      design: nodes
        .filter((node) => DESIGN_KINDS.includes(node.kind as never))
        .map((node) => itemSnapshot(node)),
      oracle: nodes
        .filter((node) => ORACLE_KINDS.includes(node.kind as never))
        .map((node) => itemSnapshot(node)),
    },
  };
}

function scopeSnapshot(args: {
  readonly node: GraphNode;
  readonly edges: readonly GraphEdge[];
  readonly nodeById: ReadonlyMap<number, GraphNode>;
  readonly criteriaById: ReadonlyMap<number, ExecutionSpecCriterionSnapshot>;
  readonly requirementDependencies: ReadonlyMap<string, readonly string[]>;
}): ExecutionSpecScopeSnapshot {
  const frontierIds = relatedItemIds(args.node.id, args.edges, args.nodeById, {
    category: 'composition',
    direction: 'incoming',
    kinds: ['frontier'],
  });
  const requirementIds = relatedUnionItemIds(args.node.id, args.edges, args.nodeById, [
    { category: 'realization', direction: 'incoming', kinds: ['requirement'] },
    // Accept the older tracer shape while the durable handoff model settles.
    { category: 'realization', direction: 'outgoing', kinds: ['requirement'] },
  ]);
  const criteria = relatedUnionNodeIds(args.node.id, args.edges, args.nodeById, [
    { category: 'dependency', direction: 'incoming', kinds: ['criterion'] },
    // Accept the older tracer shape while the durable handoff model settles.
    { category: 'realization', direction: 'outgoing', kinds: ['criterion'] },
  ])
    .map((nodeId) => args.criteriaById.get(nodeId))
    .filter((criterion): criterion is ExecutionSpecCriterionSnapshot => criterion !== undefined);
  const design = relatedItems(args.node.id, args.edges, args.nodeById, {
    category: 'composition',
    direction: 'outgoing',
    kinds: DESIGN_KINDS,
  });
  const verification = relatedUnionItems(args.node.id, args.edges, args.nodeById, [
    { category: 'dependency', direction: 'incoming', kinds: ORACLE_KINDS },
    // Accept the older tracer shape while the durable handoff model settles.
    { category: 'witness', direction: 'incoming', kinds: ORACLE_KINDS },
  ]);
  const dependsOn = new Set<string>();
  for (const requirementId of requirementIds) {
    for (const dependencyId of args.requirementDependencies.get(requirementId) ?? []) {
      dependsOn.add(dependencyId);
    }
  }

  return {
    ...itemSnapshot(args.node),
    dependsOn: [...dependsOn].sort(),
    frontierIds,
    requirementIds,
    criteria,
    design,
    verification,
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

function dependencyItemIdsByRequirement(
  edges: readonly GraphEdge[],
  requirementItemIds: ReadonlyMap<number, string>,
): ReadonlyMap<string, readonly string[]> {
  const byDependent = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (edge.category !== 'dependency') continue;
    const dependency = requirementItemIds.get(edge.sourceId);
    const dependent = requirementItemIds.get(edge.targetId);
    if (!dependency || !dependent) continue;
    const dependencies = byDependent.get(dependent) ?? new Set<string>();
    dependencies.add(dependency);
    byDependent.set(dependent, dependencies);
  }

  return new Map([...byDependent].map(([dependent, dependencies]) => [dependent, [...dependencies].sort()]));
}

function contextItems(nodes: readonly GraphNode[], kind: ContextKind): readonly ExecutionSpecItemSnapshot[] {
  return nodes.filter((node) => node.kind === kind).map((node) => itemSnapshot(node));
}

function relatedNodeIds(
  anchorId: number,
  edges: readonly GraphEdge[],
  nodeById: ReadonlyMap<number, GraphNode>,
  args: {
    readonly category: GraphEdge['category'];
    readonly direction: 'incoming' | 'outgoing';
    readonly kinds: readonly NodeKind[];
  },
): readonly number[] {
  const ids = new Set<number>();
  for (const edge of edges) {
    if (edge.category !== args.category) continue;
    if (edge.category === 'witness' && edge.stance === 'against') continue;
    const matches =
      args.direction === 'incoming' ? edge.targetId === anchorId : edge.sourceId === anchorId;
    if (!matches) continue;
    const relatedId = args.direction === 'incoming' ? edge.sourceId : edge.targetId;
    const node = nodeById.get(relatedId);
    if (!node || !args.kinds.includes(node.kind)) continue;
    ids.add(relatedId);
  }
  return [...ids].sort((a, b) => a - b);
}

function relatedItems(
  anchorId: number,
  edges: readonly GraphEdge[],
  nodeById: ReadonlyMap<number, GraphNode>,
  args: {
    readonly category: GraphEdge['category'];
    readonly direction: 'incoming' | 'outgoing';
    readonly kinds: readonly NodeKind[];
  },
): readonly ExecutionSpecItemSnapshot[] {
  return relatedNodeIds(anchorId, edges, nodeById, args)
    .map((nodeId) => nodeById.get(nodeId))
    .filter((node): node is GraphNode => node !== undefined)
    .map((node) => itemSnapshot(node));
}

function relatedUnionNodeIds(
  anchorId: number,
  edges: readonly GraphEdge[],
  nodeById: ReadonlyMap<number, GraphNode>,
  queries: readonly {
    readonly category: GraphEdge['category'];
    readonly direction: 'incoming' | 'outgoing';
    readonly kinds: readonly NodeKind[];
  }[],
): readonly number[] {
  const ids = new Set<number>();
  for (const query of queries) {
    for (const nodeId of relatedNodeIds(anchorId, edges, nodeById, query)) {
      ids.add(nodeId);
    }
  }
  return [...ids].sort((a, b) => a - b);
}

function relatedUnionItems(
  anchorId: number,
  edges: readonly GraphEdge[],
  nodeById: ReadonlyMap<number, GraphNode>,
  queries: readonly {
    readonly category: GraphEdge['category'];
    readonly direction: 'incoming' | 'outgoing';
    readonly kinds: readonly NodeKind[];
  }[],
): readonly ExecutionSpecItemSnapshot[] {
  return relatedUnionNodeIds(anchorId, edges, nodeById, queries)
    .map((nodeId) => nodeById.get(nodeId))
    .filter((node): node is GraphNode => node !== undefined)
    .map((node) => itemSnapshot(node));
}

function relatedUnionItemIds(
  anchorId: number,
  edges: readonly GraphEdge[],
  nodeById: ReadonlyMap<number, GraphNode>,
  queries: readonly {
    readonly category: GraphEdge['category'];
    readonly direction: 'incoming' | 'outgoing';
    readonly kinds: readonly NodeKind[];
  }[],
): readonly string[] {
  return relatedUnionItems(anchorId, edges, nodeById, queries).map((item) => item.itemId);
}

function relatedItemIds(
  anchorId: number,
  edges: readonly GraphEdge[],
  nodeById: ReadonlyMap<number, GraphNode>,
  args: {
    readonly category: GraphEdge['category'];
    readonly direction: 'incoming' | 'outgoing';
    readonly kinds: readonly NodeKind[];
  },
): readonly string[] {
  return relatedItems(anchorId, edges, nodeById, args).map((item) => item.itemId);
}

function itemSnapshot(node: GraphNode, dependsOn: readonly string[] = []): ExecutionSpecItemSnapshot {
  return {
    itemId: itemId(node),
    nodeId: node.id,
    title: node.title,
    content: node.body ?? node.title,
    dependsOn,
  };
}

function itemId(node: GraphNode): string {
  return formatGraphNodeCode(node.kind, node.kindOrdinal);
}

function byKindOrdinalThenId(a: GraphNode, b: GraphNode): number {
  return a.kindOrdinal - b.kindOrdinal || a.id - b.id;
}

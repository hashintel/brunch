// ── Knowledge-graph display grouping ──────────────────────────────────
//
// Presentation-only ordering and section titles for the structured list view.
// One section per node kind (mirroring the prior trunk's graph-view groups),
// ordered by plane then editorial flow. `NODE_KIND_METADATA.label` is the short
// badge code (G, CTX, …); these are the plural human section headings.

import type { GraphSlice } from '../../../graph/queries.js';
import type { NodeKind, NodePlane } from '../../../graph/schema/nodes.js';

type GraphNode = GraphSlice['nodes'][number];

/** Plural human section heading for each node kind. */
export const KIND_SECTION_LABEL: Record<NodeKind, string> = {
  // intent
  goal: 'Goals',
  context: 'Context',
  constraint: 'Constraints',
  assumption: 'Assumptions',
  decision: 'Decisions',
  requirement: 'Requirements',
  criterion: 'Acceptance Criteria',
  term: 'Terms',
  thesis: 'Theses',
  invariant: 'Invariants',
  example: 'Examples',
  // oracle
  check: 'Checks',
  validation_method: 'Validation Methods',
  evidence: 'Evidence',
  obligation: 'Obligations',
  // design
  module: 'Modules',
  interface: 'Interfaces',
  // plan
  milestone: 'Milestones',
  frontier: 'Frontier',
  slice: 'Slices',
};

// Section order: intent (editorial flow) → oracle → design → plan.
const DISPLAY_KIND_ORDER: readonly NodeKind[] = [
  'goal',
  'context',
  'constraint',
  'assumption',
  'decision',
  'requirement',
  'criterion',
  'term',
  'thesis',
  'invariant',
  'example',
  'check',
  'validation_method',
  'evidence',
  'obligation',
  'module',
  'interface',
  'milestone',
  'frontier',
  'slice',
];

export interface KindSection {
  readonly kind: NodeKind;
  readonly plane: NodePlane;
  readonly label: string;
  readonly nodes: readonly GraphNode[];
}

/**
 * Group nodes into ordered per-kind sections. Only kinds with at least one node
 * yield a section; nodes within a section sort by `kindOrdinal`.
 */
export function buildKindSections(nodes: readonly GraphNode[]): KindSection[] {
  const byKind = new Map<NodeKind, GraphNode[]>();
  for (const node of nodes) {
    const bucket = byKind.get(node.kind);
    if (bucket) bucket.push(node);
    else byKind.set(node.kind, [node]);
  }

  const sections: KindSection[] = [];
  for (const kind of DISPLAY_KIND_ORDER) {
    const kindNodes = byKind.get(kind);
    if (!kindNodes || kindNodes.length === 0) continue;
    kindNodes.sort((a, b) => a.kindOrdinal - b.kindOrdinal);
    sections.push({
      kind,
      plane: kindNodes[0]!.plane,
      label: KIND_SECTION_LABEL[kind],
      nodes: kindNodes,
    });
  }
  return sections;
}

import { knowledgeKindRegistry, type KnowledgeKind } from '@/shared/knowledge.js';

export interface KnowledgeDisplayGroup {
  label: string;
  kinds: KnowledgeKind[];
}

// Sidebar groups: tighter bundling so a fixed-width column shows fewer headers.
export const knowledgeDisplayGroups: KnowledgeDisplayGroup[] = [
  { label: 'Goals', kinds: ['goal', 'context', 'constraint'] },
  { label: 'Assumptions & Decisions', kinds: ['assumption', 'decision'] },
  { label: 'Requirements', kinds: ['requirement'] },
  { label: 'Acceptance Criteria', kinds: ['criterion'] },
  { label: 'Terminology', kinds: ['term'] },
];

// Graph view groups: one section per kind, mapping 1:1 to the toggle chip row
// — afforded by the wider full-screen layout. Order follows the editorial flow
// of the sidebar bundles, expanded.
const GRAPH_GROUP_ORDER: readonly KnowledgeKind[] = [
  'goal',
  'context',
  'constraint',
  'assumption',
  'decision',
  'requirement',
  'criterion',
  'term',
];

export const graphDisplayGroups: KnowledgeDisplayGroup[] = GRAPH_GROUP_ORDER.map((kind) => {
  const entry = knowledgeKindRegistry.find((registryEntry) => registryEntry.kind === kind);
  if (!entry) throw new Error(`Unknown knowledge kind: ${kind}`);
  return { label: entry.label, kinds: [kind] };
});

/** Groups (sidebar) that should be hidden entirely when they have no items. */
export const hiddenWhenEmptyGroups = new Set(['Requirements', 'Acceptance Criteria']);

const visibleKnowledgeKinds = new Set(knowledgeDisplayGroups.flatMap((group) => group.kinds));

export function isVisibleKnowledgeKind(kind: KnowledgeKind): boolean {
  return visibleKnowledgeKinds.has(kind);
}

import type { Story, StoryDefault } from '@ladle/react';

import {
  KnowledgeDetailCard,
  type KnowledgeEdgeData,
  type KnowledgeItemData,
} from '@/client/components/knowledge-card';

export default {
  title: 'Patterns / Cards / Knowledge',
} satisfies StoryDefault;

// ── Fixture data ────────────────────────────────────────────────────

const edges: KnowledgeEdgeData[] = [
  {
    type: 'depends_on',
    label: 'Depends on',
    sourceId: 1,
    sourceCollection: 'decision',
    relatedId: 2,
    relatedCollection: 'requirement',
    relatedLabel: 'Real-time synchronization of document edits',
  },
  {
    type: 'derived_from',
    label: 'Derived from',
    sourceId: 1,
    sourceCollection: 'decision',
    relatedId: 1,
    relatedCollection: 'goal',
    relatedLabel: 'Enable structured specification elicitation',
  },
];

// ── Permutations ────────────────────────────────────────────────────
//
// Each card demos a different combination of summary (rationale),
// children (subtype/edges), or neither.

const items: {
  item: KnowledgeItemData;
  edges?: KnowledgeEdgeData[];
  label: string;
}[] = [
  // summary + children (rationale + subtype + edges) — full toggle
  {
    label: 'Summary + children (rationale, subtype, edges)',
    item: {
      id: 1,
      kind: 'decision',
      content: 'Use SQLite for local-first persistence',
      rationale: 'Single-file database simplifies distribution and backup. No server process needed.',
      subtype: 'architectural',
    },
    edges,
  },
  // summary + children (rationale + edges, no subtype)
  {
    label: 'Summary + children (rationale, edges)',
    item: {
      id: 2,
      kind: 'requirement',
      content:
        'Real-time synchronization of document edits across all connected clients with sub-second latency',
      rationale:
        'Core product commitment to collaborative editing requires sub-second sync with conflict-free merge semantics.',
    },
    edges: [edges[0]!],
  },
  // summary only (rationale, no subtype/edges) — static summary strip
  {
    label: 'Summary only (rationale, no extras) — no toggle',
    item: {
      id: 1,
      kind: 'context',
      content: 'Enterprise users need offline editing capability',
      rationale:
        'Field teams in construction and logistics frequently lose connectivity for hours at a time.',
    },
  },
  // children only (subtype, no rationale) — full collapse toggle
  {
    label: 'Children only (subtype, no rationale) — full collapse',
    item: {
      id: 1,
      kind: 'criterion',
      content:
        'All API endpoints must respond within 200ms at p99 under sustained load of 1000 concurrent connections',
      subtype: 'performance',
    },
  },
  // children only (edges, no rationale) — full collapse toggle
  {
    label: 'Children only (edges, no rationale) — full collapse',
    item: {
      id: 1,
      kind: 'term',
      content: 'Turn tree — the branching conversation structure that tracks each question-answer pair',
    },
    edges: [edges[1]!],
  },
  // neither — static card, no drawer
  {
    label: 'Neither summary nor children — static card',
    item: {
      id: 1,
      kind: 'goal',
      content: 'Enable structured specification elicitation through AI-guided interviews',
    },
  },
  // summary + children (rationale + subtype) — short content
  {
    label: 'Summary + children (short content)',
    item: {
      id: 1,
      kind: 'assumption',
      content: 'Single user per project',
      rationale: 'Simplifies concurrency model for v1.',
      subtype: 'scope',
    },
  },
  // summary only — long content
  {
    label: 'Summary only — long content',
    item: {
      id: 1,
      kind: 'constraint', // stand-in for non-goal (NG prefix)
      content:
        'Multi-tenant collaboration with real-time co-editing across geographically distributed teams is explicitly out of scope for the initial release',
      rationale:
        'Collaboration adds significant complexity to conflict resolution, permissions, and infrastructure. Deferring to v2.',
    },
  },
];

// ── All permutations ────────────────────────────────────────────────

export const AllPermutations: Story = () => {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      {items.map((entry, i) => (
        <div key={i}>
          <p className="mb-1.5 text-xs text-hint">{entry.label}</p>
          <KnowledgeDetailCard item={entry.item} edges={entry.edges} />
        </div>
      ))}
    </div>
  );
};

// ── Expanded by default ─────────────────────────────────────────────

export const Expanded: Story = () => {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      {items
        .filter((entry) => entry.edges || entry.item.subtype)
        .map((entry, i) => (
          <KnowledgeDetailCard key={i} item={entry.item} edges={entry.edges} defaultExpanded />
        ))}
    </div>
  );
};

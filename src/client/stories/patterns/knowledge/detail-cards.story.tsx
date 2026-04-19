/**
 * Knowledge detail cards — KnowledgeDetailCard with DrawerCard in various
 * states (summary + children, summary only, children only, neither).
 */
import {
  KnowledgeDetailCard,
  type KnowledgeEdgeData,
  type KnowledgeItemData,
} from '@/client/components/knowledge-card';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import { Separator } from '@/client/components/ui/separator';

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

const items: {
  item: KnowledgeItemData;
  edges?: KnowledgeEdgeData[];
  label: string;
}[] = [
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
  {
    label: 'Children only (edges, no rationale) — full collapse',
    item: {
      id: 1,
      kind: 'term',
      content: 'Turn tree — the branching conversation structure that tracks each question-answer pair',
    },
    edges: [edges[1]!],
  },
  {
    label: 'Neither summary nor children — static card',
    item: {
      id: 1,
      kind: 'goal',
      content: 'Enable structured specification elicitation through AI-guided interviews',
    },
  },
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
  {
    label: 'Summary only — long content',
    item: {
      id: 1,
      kind: 'constraint',
      content:
        'Multi-tenant collaboration with real-time co-editing across geographically distributed teams is explicitly out of scope for the initial release',
      rationale:
        'Collaboration adds significant complexity to conflict resolution, permissions, and infrastructure. Deferring to v2.',
    },
  },
];

// ── Story ────────────────────────────────────────────────────────────

export function DetailCardsStory() {
  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto max-w-5xl p-8">
        <h1 className="text-[22px] leading-none font-medium tracking-[-0.015em] text-ink">
          Knowledge Detail Cards
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-sub">
          KnowledgeDetailCard permutations — summary + children, summary only, children only, and static.
        </p>

        <Separator className="my-8" />

        {/* ── All permutations (collapsed) ─────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">All permutations (collapsed)</h2>
          <div className="mt-6 flex max-w-2xl flex-col gap-3">
            {items.map((entry, i) => (
              <div key={i}>
                <p className="mb-1.5 text-xs text-hint">{entry.label}</p>
                <KnowledgeDetailCard item={entry.item} edges={entry.edges} />
              </div>
            ))}
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Expanded by default ──────────────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Expanded by default</h2>
          <div className="mt-6 flex max-w-2xl flex-col gap-3">
            {items
              .filter((entry) => entry.edges || entry.item.subtype)
              .map((entry, i) => (
                <KnowledgeDetailCard key={i} item={entry.item} edges={entry.edges} defaultExpanded />
              ))}
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}

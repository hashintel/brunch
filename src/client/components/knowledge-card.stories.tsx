import type { Story, StoryDefault } from '@ladle/react';

import {
  CountBadge,
  KindBadge,
  KnowledgeDetailCard,
  KnowledgeGroupCard,
  KnowledgeRow,
  MetadataRow,
  type KnowledgeEdgeData,
  type KnowledgeItemData,
} from './knowledge-card';

export default {
  title: 'Knowledge',
} satisfies StoryDefault;

// ── Sample data ──────────────────────────────────────────────────────

const sampleGoals: KnowledgeItemData[] = [
  {
    id: 1,
    kind: 'goal',
    content: 'Enable structured specification elicitation through AI-guided interviews',
  },
  {
    id: 2,
    kind: 'goal',
    content: 'Support both greenfield and brownfield project scoping',
  },
];

const sampleDecisions: KnowledgeItemData[] = [
  {
    id: 1,
    kind: 'decision',
    content: 'Use SQLite for local-first persistence',
    rationale:
      'Single-file database simplifies distribution and backup. No server process needed. SQLite handles concurrent reads well for a single-user tool.',
    subtype: 'architectural',
  },
  {
    id: 2,
    kind: 'decision',
    content: 'Separate interviewer from observer agent',
    rationale:
      'Keeps the interview prompt clean and focused. Observer extraction happens in a separate call during user think time.',
  },
  {
    id: 3,
    kind: 'decision',
    content: 'Use Vercel AI SDK as the primary agent framework',
  },
];

const sampleEdges: KnowledgeEdgeData[] = [
  {
    type: 'depends_on',
    label: 'Depends on',
    sourceId: 2,
    sourceCollection: 'decision',
    relatedId: 1,
    relatedCollection: 'decision',
    relatedLabel: 'Use SQLite for local-first persistence',
  },
  {
    type: 'derived_from',
    label: 'Derived from',
    sourceId: 3,
    sourceCollection: 'decision',
    relatedId: 2,
    relatedCollection: 'decision',
    relatedLabel: 'Separate interviewer from observer agent',
  },
];

// ── Badges ────────────────────────────────────────────────────────────

export const Badges: Story = () => {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-base font-medium text-ink">Badges</h2>

      <div>
        <p className="mb-2 text-xs text-hint">Kind badges</p>
        <div className="flex gap-2">
          <KindBadge kind="goal" />
          <KindBadge kind="term" />
          <KindBadge kind="context" />
          <KindBadge kind="constraint" />
          <KindBadge kind="assumption" />
          <KindBadge kind="decision" />
          <KindBadge kind="requirement" />
          <KindBadge kind="criterion" />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs text-hint">Count badges</p>
        <div className="flex gap-2">
          <CountBadge count={3} />
          <CountBadge count={12} />
          <CountBadge count={0} />
        </div>
      </div>
    </div>
  );
};

// ── Knowledge row ────────────────────────────────────────────────────

export const Rows: Story = () => {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-base font-medium text-ink">Knowledge rows</h2>
      <div className="overflow-hidden rounded-xl border border-rule">
        <KnowledgeRow item={sampleDecisions[0]} />
        <KnowledgeRow item={sampleDecisions[1]} />
        <KnowledgeRow item={sampleDecisions[2]} className="border-b-0" />
      </div>
    </div>
  );
};

// ── Group card ────────────────────────────────────────────────────────

export const GroupCard: Story = () => {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h2 className="text-base font-medium text-ink">Knowledge group card</h2>
      <KnowledgeGroupCard kind="decision" items={sampleDecisions} edges={sampleEdges} />
      <KnowledgeGroupCard kind="goal" items={sampleGoals} />
    </div>
  );
};

// ── Detail card ──────────────────────────────────────────────────────

export const DetailCard: Story = () => {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h2 className="text-base font-medium text-ink">Knowledge detail card</h2>
      <KnowledgeDetailCard item={sampleDecisions[0]} edges={[sampleEdges[0]]} />
      <KnowledgeDetailCard item={sampleGoals[0]} />
    </div>
  );
};

// ── Metadata row ─────────────────────────────────────────────────────

export const Metadata: Story = () => {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-base font-medium text-ink">Metadata row</h2>
      <div className="rounded-xl border border-rule p-4">
        <MetadataRow
          items={[
            { label: 'Generated on', value: 'Apr 12, 2026' },
            { label: 'Last edited', value: '2 minutes ago' },
            { label: 'Overall Confidence', value: '72%' },
          ]}
        />
      </div>
    </div>
  );
};

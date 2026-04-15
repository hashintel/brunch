import type { Story, StoryDefault } from '@ladle/react';
import { useState } from 'react';

import {
  EmptyCard,
  PhaseSidebar,
  ShellButton,
  StageSidebar,
  TabSwitcher,
  type Phase,
  type PhaseStatus,
  type StageItem,
} from './app-shell';

export default {
  title: 'Shell',
} satisfies StoryDefault;

// ── Stage sidebar ────────────────────────────────────────────────────

const sampleStages: StageItem[] = [
  {
    key: 'scope',
    label: 'Project Spec',
    status: 'done',
    children: [
      { key: 'scope-defining', label: 'Defining', status: 'done' },
      { key: 'scope-clarify', label: 'Clarify specification', status: 'done' },
    ],
  },
  { key: 'assumptions', label: 'Assumptions', status: 'active' },
  { key: 'spec-overview', label: 'Specification Overview', status: 'future' },
  { key: 'requirements', label: 'Requirements', status: 'future' },
  { key: 'gaps', label: 'Gaps & Surprises', status: 'future' },
];

const samplePhases: Record<Phase, PhaseStatus> = {
  scope: 'closed',
  design: 'in_progress',
  requirements: 'unstarted',
  criteria: 'unstarted',
};

export const StageSidebarExpanded: Story = () => {
  return (
    <div className="flex h-[500px] border border-rule">
      <StageSidebar stages={sampleStages} projectLabel="Project Spec" />
      <div className="flex-1 bg-background p-4">
        <p className="text-sm text-sub">Main content area</p>
      </div>
    </div>
  );
};

export const PhaseSidebarCollapsed: Story = () => {
  return (
    <div className="flex h-[500px] border border-rule">
      <PhaseSidebar phases={samplePhases} activePhase="design" />
      <div className="flex-1 bg-background p-4">
        <p className="text-sm text-sub">Main content area</p>
      </div>
    </div>
  );
};

export const SidebarToggle: Story = () => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="flex h-[500px] border border-rule">
      {expanded ? (
        <StageSidebar
          stages={sampleStages}
          projectLabel="Project Spec"
          onCollapse={() => setExpanded(false)}
        />
      ) : (
        <PhaseSidebar phases={samplePhases} activePhase="design" onExpand={() => setExpanded(true)} />
      )}
      <div className="flex-1 bg-background p-4">
        <p className="text-sm text-sub">Click the collapse/expand button to toggle.</p>
      </div>
    </div>
  );
};

// ── Empty states ─────────────────────────────────────────────────────

export const EmptyStates: Story = () => {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-base font-medium text-ink">Empty state patterns</h2>

      {/* Pattern 1: Text only */}
      <div>
        <p className="mb-2 text-xs text-hint">1. Simple — text only</p>
        <div className="grid max-w-2xl grid-cols-2 gap-3">
          <EmptyCard title="Purpose" description="Purpose will be defined based on your answers." />
          <EmptyCard title="Success Criteria" description="No success criteria defined yet." />
        </div>
      </div>

      {/* Pattern 2: With CTA */}
      <div>
        <p className="mb-2 text-xs text-hint">2. With call to action</p>
        <div className="max-w-md">
          <EmptyCard
            title="Specification"
            description="Start the interview to generate your first spec draft."
          >
            <div className="mt-3">
              <ShellButton variant="primary">Start interview</ShellButton>
            </div>
          </EmptyCard>
        </div>
      </div>

      {/* Pattern 3: Centered hero */}
      <div>
        <p className="mb-2 text-xs text-hint">3. Centered hero</p>
        <div className="flex max-w-2xl flex-col items-center gap-3 rounded-xl border border-dashed border-rule bg-[#f7f7f7] px-8 py-16 text-center">
          <p className="text-base font-medium tracking-[-0.015em] text-sub">No conversation yet</p>
          <p className="max-w-sm text-sm leading-relaxed text-sub">
            Begin the interview to start building your specification.
          </p>
          <div className="mt-2">
            <ShellButton variant="primary">Begin interview</ShellButton>
          </div>
        </div>
      </div>

      {/* Pattern 4: Inline within a list */}
      <div>
        <p className="mb-2 text-xs text-hint">4. Inline within a list</p>
        <div className="max-w-md overflow-hidden rounded-xl border border-rule">
          <div className="border-b border-rule bg-white p-4">
            <p className="text-sm font-medium text-ink">Assumptions</p>
          </div>
          <div className="bg-tint p-4">
            <p className="text-sm text-hint italic">
              No assumptions recorded yet. They'll appear here as the interview surfaces implicit beliefs.
            </p>
          </div>
        </div>
      </div>

      {/* Pattern 5: Attention / warning */}
      <div>
        <p className="mb-2 text-xs text-hint">5. Attention — missing required section</p>
        <div className="max-w-md">
          <div className="flex gap-3 rounded-xl border border-dashed border-[#ffe7c6] bg-[rgba(255,157,28,0.04)] p-4">
            <div>
              <p className="text-base font-medium tracking-[-0.015em] text-ink">No verification criteria</p>
              <p className="mt-1 text-sm leading-relaxed text-sub">
                This requirement has no criteria yet. Add at least one to make the spec exportable.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Shell buttons + tab switcher ─────────────────────────────────────

export const ShellControls: Story = () => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-base font-medium text-ink">Shell controls</h2>

      <div>
        <p className="mb-2 text-xs text-hint">Button variants</p>
        <div className="flex gap-3">
          <ShellButton variant="ghost">Ghost</ShellButton>
          <ShellButton variant="outline">Outline</ShellButton>
          <ShellButton variant="primary">Primary</ShellButton>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs text-hint">Tab switcher</p>
        <TabSwitcher
          tabs={[
            { key: 'overview', label: 'Overview' },
            { key: 'details', label: 'Details' },
            { key: 'history', label: 'History' },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>
    </div>
  );
};

// ── Typography scale demo ────────────────────────────────────────────

export const TypographyScale: Story = () => {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-medium text-ink">Typography scale</h2>
      <div className="flex flex-col gap-3 rounded-xl border border-rule p-4">
        <p className="text-xxs text-hint">text-xxs (11px) — impact badges, tag labels</p>
        <p className="text-xs text-sub">text-xs (12px) — built-in, secondary text</p>
        <p className="text-xs-plus text-sub">text-xs-plus (13px) — secondary body, "why" text</p>
        <p className="text-sm text-ink">text-sm (14px) — built-in, body text</p>
        <p className="text-sm-plus font-medium text-ink">
          text-sm-plus (15px) — card headings, question text
        </p>
        <p className="text-base font-medium text-ink">text-base (16px) — built-in, section headings</p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-rule p-4">
        <p className="text-sm font-normal text-ink">font-normal (400) — regular body text</p>
        <p className="text-sm font-medium text-ink">font-medium (500) — emphasized text, labels</p>
        <p className="text-sm font-semibold text-ink">font-semibold (600) — strong emphasis</p>
      </div>

      <h2 className="mt-4 text-base font-medium text-ink">Color ramp</h2>
      <div className="flex flex-col gap-2 rounded-xl border border-rule p-4">
        <div className="flex items-center gap-3">
          <span className="size-6 rounded bg-ink" />
          <span className="text-sm text-ink">ink (#202020) — primary text</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="size-6 rounded bg-sub" />
          <span className="text-sm text-sub">sub (#5b5b5b) — subtitles, section headers</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="size-6 rounded bg-hint" />
          <span className="text-sm text-hint">hint (#a6a6a6) — IDs, placeholders</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="size-6 rounded border border-rule bg-rule" />
          <span className="text-sm text-sub">rule (#e3e3e3) — borders, dividers</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="size-6 rounded border border-rule bg-wash" />
          <span className="text-sm text-sub">wash (#f0f0f0) — ghost fills, tracks</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="size-6 rounded border border-rule bg-tint" />
          <span className="text-sm text-sub">tint (#fafafa) — subtle background</span>
        </div>
      </div>

      <h2 className="mt-4 text-base font-medium text-ink">Shadow tokens</h2>
      <div className="flex gap-4 p-4">
        <div className="rounded-xl bg-white p-4 shadow-[var(--shadow-card)]">
          <p className="text-sm text-sub">shadow-card</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-[var(--shadow-ring)]">
          <p className="text-sm text-sub">shadow-ring</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-[var(--shadow-card-ring)]">
          <p className="text-sm text-sub">shadow-card-ring</p>
        </div>
      </div>
    </div>
  );
};

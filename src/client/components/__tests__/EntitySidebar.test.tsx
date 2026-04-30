// @vitest-environment happy-dom

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { EntitiesData } from '@/shared/api-types.js';
import { createKnowledgeReferenceCode } from '@/shared/knowledge.js';

import { EntitySidebar } from '../EntitySidebar.js';
import { ReviewSetCard } from '../review-set-card.js';

afterEach(() => {
  cleanup();
});

function createEntityState(overrides: Partial<EntitiesData> = {}): EntitiesData {
  return {
    goals: [],
    terms: [],
    contexts: [],
    constraints: [],
    requirements: [],
    criteria: [],
    decisions: [],
    assumptions: [],
    relationships: [],
    ...overrides,
  };
}

describe('EntitySidebar', () => {
  it('renders server-owned reference codes for requirements without review badges', () => {
    render(
      <EntitySidebar
        entityState={createEntityState({
          requirements: [
            {
              id: 3,
              specification_id: 1,
              kind: 'requirement',
              subtype: null,
              content: 'Export the reviewed spec',
              rationale: null,
              referenceCode: createKnowledgeReferenceCode('requirement', 1),
            },
            {
              id: 4,
              specification_id: 1,
              kind: 'requirement',
              subtype: null,
              content: 'Support exporting the spec as a PDF',
              rationale: null,
              referenceCode: createKnowledgeReferenceCode('requirement', 2),
            },
            {
              id: 5,
              specification_id: 1,
              kind: 'requirement',
              subtype: null,
              content: 'Resume the interview from SQLite after restart',
              rationale: null,
              referenceCode: createKnowledgeReferenceCode('requirement', 3),
            },
          ],
        })}
      />,
    );

    expect(screen.getByText(createKnowledgeReferenceCode('requirement', 1))).toBeTruthy();
    expect(screen.getByText(createKnowledgeReferenceCode('requirement', 2))).toBeTruthy();
    expect(screen.getByText(createKnowledgeReferenceCode('requirement', 3))).toBeTruthy();
    expect(screen.getByText('Export the reviewed spec')).toBeTruthy();
    expect(screen.getByText('Support exporting the spec as a PDF')).toBeTruthy();
    expect(screen.getByText('Resume the interview from SQLite after restart')).toBeTruthy();
    expect(screen.queryByText('Approved')).toBeNull();
    expect(screen.queryByText('Rejected')).toBeNull();
    expect(screen.queryByText('Pending')).toBeNull();
  });

  it('renders all visible knowledge groups including terms and reports visible totals', () => {
    render(
      <EntitySidebar
        entityState={createEntityState({
          goals: [
            {
              id: 1,
              specification_id: 1,
              kind: 'goal',
              subtype: null,
              content: 'Ship a faithful active-path export',
              rationale: null,
              referenceCode: createKnowledgeReferenceCode('goal', 1),
            },
          ],
          terms: [
            {
              id: 2,
              specification_id: 1,
              kind: 'term',
              subtype: null,
              content: 'Invisible term',
              rationale: null,
              referenceCode: createKnowledgeReferenceCode('term', 1),
            },
          ],
          contexts: [
            {
              id: 3,
              specification_id: 1,
              kind: 'context',
              subtype: null,
              content: 'Current flow is chat-first',
              rationale: null,
              referenceCode: createKnowledgeReferenceCode('context', 1),
            },
          ],
          requirements: [
            {
              id: 4,
              specification_id: 1,
              kind: 'requirement',
              subtype: null,
              content: 'Export must be markdown',
              rationale: null,
              referenceCode: createKnowledgeReferenceCode('requirement', 1),
            },
          ],
          criteria: [
            {
              id: 5,
              specification_id: 1,
              kind: 'criterion',
              subtype: null,
              content: 'Export reflects approved items only',
              rationale: null,
              referenceCode: createKnowledgeReferenceCode('criterion', 1),
            },
          ],
          decisions: [
            {
              id: 6,
              specification_id: 1,
              content: 'Use the active-path entity projection for routed state',
              rationale: 'Keeps routed state aligned with export',
              referenceCode: createKnowledgeReferenceCode('decision', 1),
            },
          ],
          assumptions: [
            {
              id: 7,
              specification_id: 1,
              content: 'Users only trust the current branch state',
              referenceCode: createKnowledgeReferenceCode('assumption', 1),
            },
          ],
        })}
      />,
    );

    expect(screen.getByText('Knowledge Graph')).toBeTruthy();
    expect(screen.getByText('Goals')).toBeTruthy();
    expect(screen.getByText('Assumptions & Decisions')).toBeTruthy();
    expect(screen.getByText('Requirements')).toBeTruthy();
    expect(screen.getByText('Acceptance Criteria')).toBeTruthy();
    expect(screen.getByText('Terminology')).toBeTruthy();
    expect(screen.getByText('Invisible term')).toBeTruthy();
    expect(screen.getByText('Ship a faithful active-path export')).toBeTruthy();
    expect(screen.getByText('Use the active-path entity projection for routed state')).toBeTruthy();
    expect(screen.getByText('Users only trust the current branch state')).toBeTruthy();
    expect(screen.getByText('Export must be markdown')).toBeTruthy();
    expect(screen.getByText('Export reflects approved items only')).toBeTruthy();
    const header = screen.getByText('Knowledge Graph').parentElement?.textContent ?? '';
    expect(header).toContain('7 Items');
    expect(header).toContain('0 Connections');
  });

  it('shows a review-ready sidebar inventory that agrees with review-card grounding refs', () => {
    const entityState = createEntityState({
      goals: [
        {
          id: 1,
          specification_id: 1,
          kind: 'goal',
          subtype: null,
          content:
            'Launch a lightweight issue tracker that covers the core ticket lifecycle for day-one teams',
          rationale: null,
          referenceCode: createKnowledgeReferenceCode('goal', 1),
        },
        {
          id: 2,
          specification_id: 1,
          kind: 'goal',
          subtype: null,
          content:
            'Keep ticket visibility and role-specific actions clear for admins, developers, and viewers',
          rationale: null,
          referenceCode: createKnowledgeReferenceCode('goal', 2),
        },
      ],
      contexts: [
        {
          id: 3,
          specification_id: 1,
          kind: 'context',
          subtype: null,
          content:
            'Tickets move through a workflow that always includes title, description, priority, and assignee',
          rationale: null,
          referenceCode: createKnowledgeReferenceCode('context', 1),
        },
        {
          id: 4,
          specification_id: 1,
          kind: 'context',
          subtype: null,
          content: 'The team needs a trustworthy audit trail whenever ticket status changes',
          rationale: null,
          referenceCode: createKnowledgeReferenceCode('context', 2),
        },
      ],
      constraints: [
        {
          id: 5,
          specification_id: 1,
          kind: 'constraint',
          subtype: null,
          content: 'Audit history must be retained as immutable actor-and-timestamp records',
          rationale: null,
          referenceCode: createKnowledgeReferenceCode('constraint', 1),
        },
        {
          id: 6,
          specification_id: 1,
          kind: 'constraint',
          subtype: null,
          content: 'Viewer access must stay read-only and must not mutate ticket data or settings',
          rationale: null,
          referenceCode: createKnowledgeReferenceCode('constraint', 2),
        },
      ],
      decisions: [
        {
          id: 7,
          specification_id: 1,
          content: 'Model the first release around one shared ticket record with role-aware actions',
          rationale: null,
          referenceCode: createKnowledgeReferenceCode('decision', 1),
        },
      ],
    });

    render(
      <div>
        <ReviewSetCard
          reviewSet={{
            title: 'Requirements',
            items: [
              {
                reviewItemId: 'requirements:1',
                referenceCode: createKnowledgeReferenceCode('requirement', 1),
                content:
                  'Create, edit, and close tickets with required fields: title, description, priority, and assignee',
                rationale: 'Captures the core ticket lifecycle the tool must support from day one.',
                grounding: [
                  { code: createKnowledgeReferenceCode('goal', 1) },
                  { code: createKnowledgeReferenceCode('context', 1) },
                  { code: createKnowledgeReferenceCode('decision', 1) },
                ],
              },
              {
                reviewItemId: 'requirements:2',
                referenceCode: createKnowledgeReferenceCode('requirement', 2),
                content:
                  'Every status change records the actor identity and ISO 8601 timestamp in the audit log',
                rationale: 'Protects accountability and traceability for regulated workflows.',
                grounding: [
                  { code: createKnowledgeReferenceCode('context', 2) },
                  { code: createKnowledgeReferenceCode('constraint', 1) },
                ],
              },
              {
                reviewItemId: 'requirements:3',
                referenceCode: createKnowledgeReferenceCode('requirement', 3),
                content:
                  'Role-based visibility: admins see all tickets and settings, developers see assigned and unassigned tickets, viewers have read-only access',
                rationale: 'Ensures each role sees only the operations appropriate to its responsibility.',
                grounding: [
                  { code: createKnowledgeReferenceCode('goal', 2) },
                  { code: createKnowledgeReferenceCode('constraint', 2) },
                ],
              },
            ],
          }}
          description="Review the whole requirement set before moving forward."
          note=""
          onNoteChange={() => {}}
          onAccept={() => {}}
          onRequestChanges={() => {}}
          disabled={false}
          submitted={false}
          showItemComments
        />
        <EntitySidebar entityState={entityState} />
      </div>,
    );

    const reviewSetCard = screen.getByTestId('review-set-card');
    expect(within(reviewSetCard).getByText(createKnowledgeReferenceCode('goal', 1))).toBeTruthy();
    expect(within(reviewSetCard).getByText(createKnowledgeReferenceCode('context', 2))).toBeTruthy();
    expect(within(reviewSetCard).getByText(createKnowledgeReferenceCode('constraint', 2))).toBeTruthy();
    expect(within(reviewSetCard).getByText(createKnowledgeReferenceCode('decision', 1))).toBeTruthy();

    const goalsAndContextSection = screen.getByText('Goals').closest('section');
    const assumptionsAndDecisionsSection = screen.getByText('Assumptions & Decisions').closest('section');
    expect(goalsAndContextSection).not.toBeNull();
    expect(assumptionsAndDecisionsSection).not.toBeNull();
    expect(within(goalsAndContextSection!).getByText(createKnowledgeReferenceCode('goal', 1))).toBeTruthy();
    expect(
      within(goalsAndContextSection!).getByText(createKnowledgeReferenceCode('context', 2)),
    ).toBeTruthy();
    expect(
      within(goalsAndContextSection!).getByText(createKnowledgeReferenceCode('constraint', 2)),
    ).toBeTruthy();
    expect(
      within(assumptionsAndDecisionsSection!).getByText(createKnowledgeReferenceCode('decision', 1)),
    ).toBeTruthy();
    const header = screen.getByText('Knowledge Graph').parentElement?.textContent ?? '';
    expect(header).toContain('7 Items');
    expect(header).toContain('0 Connections');
  });

  it('groups goals, contexts, and constraints together under Goals', () => {
    render(
      <EntitySidebar
        entityState={createEntityState({
          goals: [
            {
              id: 1,
              specification_id: 1,
              kind: 'goal',
              subtype: null,
              content: 'Ship something useful',
              rationale: null,
              referenceCode: createKnowledgeReferenceCode('goal', 1),
            },
          ],
          contexts: [
            {
              id: 2,
              specification_id: 1,
              kind: 'context',
              subtype: null,
              content: 'Users already work in docs',
              rationale: null,
              referenceCode: createKnowledgeReferenceCode('context', 1),
            },
          ],
          constraints: [
            {
              id: 3,
              specification_id: 1,
              kind: 'constraint',
              subtype: null,
              content: 'Keep first run local-first',
              rationale: null,
              referenceCode: createKnowledgeReferenceCode('constraint', 1),
            },
          ],
        })}
      />,
    );

    const goalsAndContextSection = screen.getByText('Goals').closest('section');
    expect(goalsAndContextSection?.textContent).toContain('Ship something useful');
    expect(goalsAndContextSection?.textContent).toContain('Users already work in docs');
    expect(goalsAndContextSection?.textContent).toContain('Keep first run local-first');
  });

  it('shows outgoing edge previews with directionally honest labels and target reference codes', () => {
    render(
      <EntitySidebar
        entityState={createEntityState({
          goals: [
            {
              id: 1,
              specification_id: 1,
              kind: 'goal',
              subtype: null,
              content: 'Ship a useful first version',
              rationale: null,
              referenceCode: createKnowledgeReferenceCode('goal', 1),
            },
          ],
          contexts: [
            {
              id: 2,
              specification_id: 1,
              kind: 'context',
              subtype: null,
              content: 'The team currently works from a spreadsheet',
              rationale: null,
              referenceCode: createKnowledgeReferenceCode('context', 1),
            },
          ],
          relationships: [
            {
              type: 'derived_from',
              source: { collection: 'knowledge_item', kind: 'goal', id: 1 },
              target: { collection: 'knowledge_item', kind: 'context', id: 2 },
            },
          ],
        })}
      />,
    );

    expect(screen.getByText('Links to:')).toBeTruthy();
    expect(screen.getAllByText(createKnowledgeReferenceCode('context', 1))).toHaveLength(2);
    const header = screen.getByText('Knowledge Graph').parentElement?.textContent ?? '';
    expect(header).toContain('1 Connections');
  });

  it('does not show edge preview content for items without relationships', () => {
    render(
      <EntitySidebar
        entityState={createEntityState({
          goals: [
            {
              id: 1,
              specification_id: 1,
              kind: 'goal',
              subtype: null,
              content: 'Ship a useful first version',
              rationale: null,
              referenceCode: createKnowledgeReferenceCode('goal', 1),
            },
          ],
        })}
      />,
    );

    expect(screen.queryByText('Links to:')).toBeNull();
  });
});

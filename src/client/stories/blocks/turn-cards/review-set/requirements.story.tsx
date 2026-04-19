/**
 * Turn block: Requirements review-set cards — active interactive review,
 * completed-accepted, and completed-changes-requested states.
 */
import { useState } from 'react';

import { ReviewSetCard, type ReviewSetCardItem } from '@/client/components/review-set-card';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import { Separator } from '@/client/components/ui/separator';
import { createKnowledgeReferenceCode } from '@/shared/knowledge.js';

// ── Fixture data ─────────────────────────────────────────────────────

const code = createKnowledgeReferenceCode;

const requirementItems: ReviewSetCardItem[] = [
  {
    referenceCode: code('requirement', 1),
    content:
      'The system shall provide a structured intake form that captures project name, stakeholder contacts, and initial scope description',
    rationale: 'Replaces the current spreadsheet-based intake process identified during grounding.',
    grounding: [{ code: code('goal', 1) }, { code: code('context', 1) }, { code: code('decision', 1) }],
  },
  {
    referenceCode: code('requirement', 2),
    content:
      'All submitted intake requests shall be validated against a completeness checklist before entering the processing queue',
    rationale: 'Prevents incomplete submissions that currently cause rework in the manual workflow.',
    grounding: [{ code: code('goal', 1) }, { code: code('constraint', 2) }],
  },
  {
    referenceCode: code('requirement', 3),
    content:
      'The platform shall consolidate data from the three internal dashboards into a unified real-time view',
    rationale: 'Directly addresses the dashboard consolidation goal surfaced during grounding.',
    grounding: [{ code: code('goal', 2) }, { code: code('context', 1) }, { code: code('assumption', 1) }],
  },
  {
    referenceCode: code('requirement', 4),
    content:
      'Users shall be able to configure notification preferences per project with digest frequency controls',
    rationale: 'Stakeholders require awareness of changes without information overload.',
    grounding: [{ code: code('decision', 3) }, { code: code('constraint', 5) }],
  },
  {
    referenceCode: code('requirement', 5),
    content:
      'The system shall support role-based access control with at least three permission tiers: viewer, editor, and administrator',
    rationale:
      'Multi-team usage requires fine-grained access boundaries to prevent unauthorized modifications.',
    grounding: [
      { code: code('goal', 2) },
      { code: code('constraint', 3) },
      { code: code('decision', 2) },
      { code: code('assumption', 3) },
    ],
  },
  {
    referenceCode: code('requirement', 6),
    content:
      'Audit logs shall record all state transitions for intake requests with timestamps and acting user identity',
    rationale: 'Compliance and traceability requirements identified during design trade-off discussions.',
    grounding: [{ code: code('constraint', 4) }, { code: code('assumption', 7) }],
    isRevised: true,
  },
  {
    referenceCode: code('requirement', 7),
    content: 'API integration with the legacy CRM system for bidirectional contact synchronization',
    rationale:
      'Added by the user during review to capture a requirement surfaced in a stakeholder meeting after the initial grounding phase.',
    grounding: [{ code: code('goal', 1) }, { code: code('context', 1) }],
    isUserCreated: true,
  },
];

const reviewDescription =
  'Review the synthesized requirements below. Each requirement is grounded in goals, context, constraints, and decisions captured during earlier phases. Comment on individual items or add an overall review note, then accept or request changes.';

// ── Interactive wrapper ──────────────────────────────────────────────

function InteractiveRequirementsReview() {
  const [note, setNote] = useState('');

  return (
    <ReviewSetCard
      reviewSet={{ title: 'Requirements', items: requirementItems }}
      description={reviewDescription}
      note={note}
      onNoteChange={setNote}
      onAccept={() => console.log('Requirements accepted')}
      onRequestChanges={() => console.log('Changes requested')}
      disabled={false}
      submitted={false}
      showItemComments
      initialComments={{
        [code('requirement', 3)]: 'Should specify which three dashboards and their data freshness SLAs.',
        [code('requirement', 6)]: 'Revised to include acting user identity per compliance feedback.',
      }}
    />
  );
}

// ── Story ────────────────────────────────────────────────────────────

export function RequirementsStory() {
  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto max-w-5xl p-8">
        <h1 className="text-[22px] leading-none font-medium tracking-[-0.015em] text-ink">
          Turn Block — Requirements Review
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-sub">
          Review-set cards for the requirements review phase with interactive commenting, accept, and
          request-changes actions.
        </p>

        <Separator className="my-8" />

        {/* ── Active requirements review ────────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Active Requirements Review</h2>
          <p className="mt-1 text-sm text-sub">
            Interactive review with per-item commenting and initial comments seeded.
          </p>

          <div className="mt-6 max-w-3xl">
            <InteractiveRequirementsReview />
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Completed — accepted ──────────────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Completed — Accepted</h2>
          <p className="mt-1 text-sm text-sub">Review resolved with acceptance.</p>

          <div className="mt-6 max-w-3xl">
            <ReviewSetCard
              reviewSet={{ title: 'Requirements', items: requirementItems }}
              description={reviewDescription}
              note=""
              onNoteChange={() => {}}
              onAccept={() => {}}
              onRequestChanges={() => {}}
              disabled
              submitted={false}
              resolvedAction="accept"
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Completed — changes requested ─────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Completed — Changes Requested</h2>
          <p className="mt-1 text-sm text-sub">Review resolved with changes requested.</p>

          <div className="mt-6 max-w-3xl">
            <ReviewSetCard
              reviewSet={{ title: 'Requirements', items: requirementItems }}
              description={reviewDescription}
              note="R3 needs tighter scope — specify exact dashboards. R6 audit log retention policy is missing."
              onNoteChange={() => {}}
              onAccept={() => {}}
              onRequestChanges={() => {}}
              disabled
              submitted={false}
              resolvedAction="request-changes"
            />
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}

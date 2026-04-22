/**
 * Turn block: Acceptance criteria review-set cards — active interactive review
 * and completed-accepted state.
 */
import { useState } from 'react';

import { ReviewSetCard, type ReviewSetCardItem } from '@/client/components/review-set-card';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import { Separator } from '@/client/components/ui/separator';
import { createKnowledgeReferenceCode } from '@/shared/knowledge.js';

// ── Fixture data ─────────────────────────────────────────────────────

const code = createKnowledgeReferenceCode;

const criterionItems: ReviewSetCardItem[] = [
  {
    reviewItemId: 'criteria:1',
    referenceCode: code('criterion', 1),
    content:
      'Intake form submissions with all required fields populated are accepted into the processing queue within 5 seconds',
    rationale: 'Verifies the structured intake form meets the automation latency expectation.',
    grounding: [{ code: code('requirement', 1) }, { code: code('goal', 1) }, { code: code('constraint', 2) }],
  },
  {
    reviewItemId: 'criteria:2',
    referenceCode: code('criterion', 2),
    content: 'Submissions missing any required field display inline validation errors and are not queued',
    rationale: 'Ensures the completeness checklist requirement prevents incomplete submissions.',
    grounding: [{ code: code('requirement', 2) }, { code: code('decision', 1) }],
  },
  {
    reviewItemId: 'criteria:3',
    referenceCode: code('criterion', 3),
    content:
      'The unified dashboard reflects data from all three source systems with no more than 30 seconds of staleness',
    rationale: 'Validates real-time consolidation against the dashboard unification goal.',
    grounding: [{ code: code('requirement', 3) }, { code: code('goal', 2) }, { code: code('assumption', 1) }],
  },
  {
    reviewItemId: 'criteria:4',
    referenceCode: code('criterion', 4),
    content:
      'A user with viewer permissions cannot modify any project data or configuration after a full page reload',
    rationale: 'Revised to prove the RBAC boundary still holds after the workspace rehydrates.',
    grounding: [
      { code: code('requirement', 5) },
      { code: code('constraint', 3) },
      { code: code('decision', 2) },
    ],
    isRevised: true,
  },
  {
    reviewItemId: 'criteria:5',
    referenceCode: code('criterion', 5),
    content:
      'Every accepted review revision shows Added in revision and Revised badges before the route refresh completes',
    rationale: 'Adds an explicit transcript-trust proof for review regeneration states.',
    grounding: [
      { code: code('requirement', 6) },
      { code: code('constraint', 4) },
      { code: code('assumption', 7) },
    ],
    isUserCreated: true,
  },
];

const reviewDescription =
  'Review the synthesized acceptance criteria below. Each criterion is grounded in requirements and upstream knowledge items. Verify that criteria are specific, measurable, and testable.';

// ── Interactive wrapper ──────────────────────────────────────────────

function InteractiveCriteriaReview() {
  const [note, setNote] = useState('');

  return (
    <ReviewSetCard
      reviewSet={{ title: 'Acceptance Criteria', items: criterionItems }}
      description={reviewDescription}
      note={note}
      onNoteChange={setNote}
      onAccept={() => console.log('Criteria accepted')}
      onRequestChanges={() => console.log('Changes requested')}
      disabled={false}
      submitted={false}
      showItemComments
    />
  );
}

// ── Story ────────────────────────────────────────────────────────────

export function CriteriaStory() {
  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto max-w-5xl p-8">
        <h1 className="text-[22px] leading-none font-medium tracking-[-0.015em] text-ink">
          Turn Block — Acceptance Criteria Review
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-sub">
          Review-set cards for the acceptance criteria review phase, with criteria grounded in requirements
          and upstream decisions.
        </p>

        <Separator className="my-8" />

        {/* ── Active criteria review ────────────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Active Criteria Review</h2>
          <p className="mt-1 text-sm text-sub">
            Interactive review with per-item commenting for acceptance criteria.
          </p>

          <div className="mt-6 max-w-3xl">
            <InteractiveCriteriaReview />
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Completed — accepted ──────────────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Completed — Accepted</h2>
          <p className="mt-1 text-sm text-sub">Criteria review resolved with acceptance.</p>

          <div className="mt-6 max-w-3xl">
            <ReviewSetCard
              reviewSet={{ title: 'Acceptance Criteria', items: criterionItems }}
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
      </div>
    </ScrollArea>
  );
}

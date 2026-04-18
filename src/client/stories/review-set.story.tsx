/**
 * Pattern: Review set — synthesized requirement/criteria list with
 * per-item commenting, collection-level stats, global review note,
 * and full-set review submission (Accept Review / Request Changes).
 */
import { useState } from 'react';

import {
  ReviewPhaseCompletionCard,
  ReviewSetCard,
  type ReviewSetCardItem,
} from '@/client/components/review-set-card';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import { Separator } from '@/client/components/ui/separator';
import { createKnowledgeReferenceCode } from '@/shared/knowledge.js';

// ── Fixture data ─────────────────────────────────────────────────────

const code = createKnowledgeReferenceCode;

const initialItems: ReviewSetCardItem[] = [
  {
    referenceCode: code('requirement', 1),
    content: 'Live cursor presence indicators for all active collaborators',
    rationale:
      'Multiple stakeholders emphasized real-time awareness as critical for concurrent editing workflows.',
    grounding: [
      { code: code('goal', 1) },
      { code: code('goal', 2) },
      { code: code('context', 3) },
      { code: code('decision', 1) },
    ],
  },
  {
    referenceCode: code('requirement', 2),
    content: 'Real-time synchronization of document edits across all connected clients',
    rationale:
      'Core product commitment to collaborative editing requires sub-second sync with conflict-free merge semantics.',
    grounding: [
      { code: code('goal', 1) },
      { code: code('goal', 3) },
      { code: code('context', 1) },
      { code: code('constraint', 2) },
      { code: code('decision', 3) },
      { code: code('assumption', 1) },
      { code: code('assumption', 2) },
    ],
  },
  {
    referenceCode: code('requirement', 3),
    content: 'Version history with rollback functionality',
    rationale:
      'Multiple knowledge items point to the need for audit trails and undo capability at the document level.',
    grounding: [{ code: code('goal', 2) }, { code: code('decision', 4) }, { code: code('constraint', 1) }],
  },
  {
    referenceCode: code('requirement', 4),
    content: 'Offline editing mode with automatic conflict resolution on reconnect',
    rationale: 'Enterprise users in the field need to continue working without network connectivity.',
    grounding: [{ code: code('context', 4) }, { code: code('constraint', 3) }],
  },
  {
    referenceCode: code('requirement', 5),
    content: 'Granular permissions control at document, section, and field levels',
    rationale:
      'Multi-tenant architecture requires fine-grained access boundaries to prevent data leakage across teams.',
    grounding: [
      { code: code('goal', 4) },
      { code: code('constraint', 1) },
      { code: code('constraint', 4) },
      { code: code('decision', 2) },
      { code: code('assumption', 3) },
    ],
  },
  {
    referenceCode: code('requirement', 6),
    content: 'Document export in PDF, Markdown, and DOCX formats',
    rationale: 'Interoperability with external stakeholder toolchains was cited across multiple interviews.',
    grounding: [{ code: code('context', 2) }, { code: code('decision', 5) }, { code: code('assumption', 4) }],
  },
  {
    referenceCode: code('requirement', 7),
    content: 'Collaborative annotation and commenting on document sections',
    rationale: 'Review workflows need inline discussion threads anchored to specific content ranges.',
    grounding: [
      { code: code('goal', 1) },
      { code: code('goal', 5) },
      { code: code('context', 5) },
      { code: code('decision', 6) },
      { code: code('decision', 7) },
      { code: code('assumption', 5) },
    ],
    isUserCreated: true,
  },
  {
    referenceCode: code('requirement', 8),
    content: 'Notification system for document changes with configurable granularity',
    rationale:
      'Users need awareness of changes without information overload; digest frequency should be tunable.',
    grounding: [
      { code: code('goal', 3) },
      { code: code('context', 6) },
      { code: code('decision', 8) },
      { code: code('assumption', 6) },
    ],
    isRevised: true,
  },
];

// ── Interactive Review Set ───────────────────────────────────────────

function InteractiveReviewSet() {
  const [globalNote, setGlobalNote] = useState('');
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <ReviewSetCard
        reviewSet={{ title: 'Requirements', items: initialItems }}
        description="Review the synthesized requirements. Comment on individual items or add an overall review note, then accept the review or request changes."
        note={globalNote}
        onNoteChange={setGlobalNote}
        onAccept={() => setAccepted(true)}
        onRequestChanges={() => console.log('Request changes')}
        disabled={false}
        submitted={false}
        showItemComments
        initialComments={{
          R3: 'This should be scoped to document-level rollback only, not field-level.',
        }}
      />

      {accepted ? (
        <ReviewPhaseCompletionCard
          title="Requirements phase is complete"
          description="All requirements have been reviewed and finalized. You can proceed to acceptance criteria."
          cta="Continue to acceptance criteria"
          onContinue={() => console.log('Continue')}
        />
      ) : null}
    </div>
  );
}

// ── Main Story Component ─────────────────────────────────────────────

export function ReviewSetPage() {
  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto max-w-5xl p-8">
        <h1 className="text-[22px] leading-none font-medium tracking-[-0.015em] text-ink">
          Pattern — Review Set
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-sub">
          Synthesized requirement list with per-item commenting, collection-level stats, global review note,
          and full-set review submission (Accept Review / Request Changes).
        </p>

        <Separator className="my-8" />

        {/* ── Section 1: Interactive Review Set ─────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Interactive Review Set</h2>
          <p className="mt-1 text-sm text-sub">
            Full interactive demo with per-item commenting via icon-button toggle, global review note, and
            full-set Accept Review / Request Changes actions.
          </p>

          <div className="mt-6 max-w-3xl">
            <InteractiveReviewSet />
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Section 3: Phase Completion ────────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Phase Completion</h2>
          <p className="mt-1 text-sm text-sub">The completion card shown after the review is accepted.</p>

          <div className="mt-6 max-w-3xl">
            <ReviewPhaseCompletionCard
              title="Requirements phase is complete"
              description="All requirements have been reviewed and finalized. You can proceed to acceptance criteria."
              cta="Continue to acceptance criteria"
              testId="story-review-phase-completion-card"
            />
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}

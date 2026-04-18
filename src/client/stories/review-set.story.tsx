/**
 * Pattern: Review set — synthesized requirement/criteria list with
 * stable reference codes, grounding context, one review note, and
 * full-set review submission (Accept Review / Request Changes).
 */
import { useState } from 'react';

import {
  ReviewPhaseCompletionCard,
  ReviewSetCard,
  type ReviewSetCardItem,
} from '@/client/components/review-set-card';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import { Separator } from '@/client/components/ui/separator';

// ── Fixture data ─────────────────────────────────────────────────────

const initialItems: ReviewSetCardItem[] = [
  {
    referenceCode: 'R1',
    content: 'Live cursor presence indicators for all active collaborators',
    rationale:
      'Multiple stakeholders emphasized real-time awareness as critical for concurrent editing workflows.',
    grounding: [{ code: 'GOL-1' }, { code: 'GOL-2' }, { code: 'CTX-3' }, { code: 'DEC-1' }],
  },
  {
    referenceCode: 'R2',
    content: 'Real-time synchronization of document edits across all connected clients',
    rationale:
      'Core product commitment to collaborative editing requires sub-second sync with conflict-free merge semantics.',
    grounding: [
      { code: 'GOL-1' },
      { code: 'GOL-3' },
      { code: 'CTX-1' },
      { code: 'CST-2' },
      { code: 'DEC-3' },
      { code: 'ASM-1' },
      { code: 'ASM-2' },
    ],
  },
  {
    referenceCode: 'R3',
    content: 'Version history with rollback functionality',
    rationale:
      'Multiple knowledge items point to the need for audit trails and undo capability at the document level.',
    grounding: [{ code: 'GOL-2' }, { code: 'DEC-4' }, { code: 'CST-1' }],
  },
  {
    referenceCode: 'R4',
    content: 'Offline editing mode with automatic conflict resolution on reconnect',
    rationale: 'Enterprise users in the field need to continue working without network connectivity.',
    grounding: [{ code: 'CTX-4' }, { code: 'CST-3' }],
  },
  {
    referenceCode: 'R5',
    content: 'Granular permissions control at document, section, and field levels',
    rationale:
      'Multi-tenant architecture requires fine-grained access boundaries to prevent data leakage across teams.',
    grounding: [
      { code: 'GOL-4' },
      { code: 'CST-1' },
      { code: 'CST-4' },
      { code: 'DEC-2' },
      { code: 'ASM-3' },
    ],
  },
  {
    referenceCode: 'R6',
    content: 'Document export in PDF, Markdown, and DOCX formats',
    rationale: 'Interoperability with external stakeholder toolchains was cited across multiple interviews.',
    grounding: [{ code: 'CTX-2' }, { code: 'DEC-5' }, { code: 'ASM-4' }],
  },
  {
    referenceCode: 'R7',
    content: 'Collaborative annotation and commenting on document sections',
    rationale: 'Review workflows need inline discussion threads anchored to specific content ranges.',
    grounding: [
      { code: 'GOL-1' },
      { code: 'GOL-5' },
      { code: 'CTX-5' },
      { code: 'DEC-6' },
      { code: 'DEC-7' },
      { code: 'ASM-5' },
    ],
    isUserCreated: true,
  },
  {
    referenceCode: 'R8',
    content: 'Notification system for document changes with configurable granularity',
    rationale:
      'Users need awareness of changes without information overload; digest frequency should be tunable.',
    grounding: [{ code: 'GOL-3' }, { code: 'CTX-6' }, { code: 'DEC-8' }, { code: 'ASM-6' }],
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
          Synthesized requirement list with stable reference codes, grounding context, one review note, and
          full-set review submission (Accept Review / Request Changes).
        </p>

        <Separator className="my-8" />

        {/* ── Section 1: Interactive Review Set ─────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Interactive Review Set</h2>
          <p className="mt-1 text-sm text-sub">
            Full interactive demo with a lightweight candidate-set review surface, one overall note, and
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
            />
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}

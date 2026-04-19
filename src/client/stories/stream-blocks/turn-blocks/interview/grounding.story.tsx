/**
 * Turn block: Grounding-phase question cards — active, answered, and skeleton states.
 *
 * The grounding phase asks about project goals, context, and foundational decisions.
 */
import {
  ActiveQuestionCard,
  AnsweredQuestionCard,
  QuestionCardSkeleton,
} from '@/client/components/question-cards';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import { Separator } from '@/client/components/ui/separator';
import type { ProjectStateTurn } from '@/shared/api-types.js';
import { createKnowledgeReferenceCode } from '@/shared/knowledge.js';

// ── Fixture data ─────────────────────────────────────────────────────

const code = createKnowledgeReferenceCode;

const groundingOptions = [
  {
    position: 0,
    content: 'Replace an existing manual workflow with an automated system',
    is_recommended: true,
  },
  { position: 1, content: 'Build a new product for an underserved market segment', is_recommended: false },
  {
    position: 2,
    content: 'Consolidate several internal tools into a single platform',
    is_recommended: false,
  },
  { position: 3, content: 'Extend an existing product with a major new capability', is_recommended: false },
];

const answeredGroundingTurn: ProjectStateTurn = {
  id: 1,
  project_id: 1,
  parent_turn_id: null,
  phase: 'scope',
  question: 'What is the primary purpose of this project?',
  why: 'Understanding the core motivation helps scope all downstream decisions — architecture, constraints, and success criteria flow from this answer.',
  impact: 'high',
  answer: null,
  is_resolution: false,
  user_parts: JSON.stringify([
    {
      type: 'data-turn-response',
      data: {
        turnId: 1,
        selectedOptionIds: [101, 103],
        freeText:
          'We need to replace the spreadsheet-based intake process and also consolidate the three internal dashboards into a unified view.',
      },
    },
  ]),
  assistant_parts: null,
  created_at: '2025-06-01T10:00:00Z',
  options: [
    {
      id: 101,
      position: 0,
      content: 'Replace an existing manual workflow with an automated system',
      is_recommended: true,
      is_selected: true,
    },
    {
      id: 102,
      position: 1,
      content: 'Build a new product for an underserved market segment',
      is_recommended: false,
      is_selected: false,
    },
    {
      id: 103,
      position: 2,
      content: 'Consolidate several internal tools into a single platform',
      is_recommended: false,
      is_selected: true,
    },
    {
      id: 104,
      position: 3,
      content: 'Extend an existing product with a major new capability',
      is_recommended: false,
      is_selected: false,
    },
  ],
  captured_items: [
    {
      collection: 'knowledge_item',
      kind: 'goal',
      id: 1,
      content: 'Automate the manual intake workflow',
      referenceCode: code('goal', 1),
    },
    {
      collection: 'knowledge_item',
      kind: 'goal',
      id: 2,
      content: 'Unify internal dashboards into a single platform',
      referenceCode: code('goal', 2),
    },
    {
      collection: 'knowledge_item',
      kind: 'context',
      id: 1,
      content: 'Current process relies on spreadsheets shared via email',
      referenceCode: code('context', 1),
    },
  ],
};

// ── Story ────────────────────────────────────────────────────────────

export function GroundingStory() {
  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto max-w-5xl p-8">
        <h1 className="text-[22px] leading-none font-medium tracking-[-0.015em] text-ink">
          Turn Block — Grounding Phase
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-sub">
          Question cards with grounding-phase fixture data. The grounding phase asks about project goals,
          context, and foundational decisions.
        </p>

        <Separator className="my-8" />

        {/* ── Active grounding question ─────────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Active Grounding Question</h2>
          <p className="mt-1 text-sm text-sub">High-impact question about project direction.</p>

          <div className="mt-6 max-w-2xl">
            <ActiveQuestionCard
              id="grounding-1"
              questionCode="G1"
              question="What is the primary purpose of this project?"
              why="Understanding the core motivation helps scope all downstream decisions — architecture, constraints, and success criteria flow from this answer."
              impact="high"
              options={groundingOptions}
              persistedSelectedPositions={[]}
              persistedFreeText=""
              hasPersistedResponse={false}
              disabled={false}
              state="active"
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Answered grounding question ───────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Answered Grounding Question</h2>
          <p className="mt-1 text-sm text-sub">
            Completed grounding turn with captured goals and context items.
          </p>

          <div className="mt-6 max-w-2xl">
            <AnsweredQuestionCard turn={answeredGroundingTurn} questionCode="G1" />
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Skeleton ──────────────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Skeleton</h2>
          <p className="mt-1 text-sm text-sub">Loading placeholder while a turn is being generated.</p>

          <div className="mt-6 max-w-2xl">
            <QuestionCardSkeleton />
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}

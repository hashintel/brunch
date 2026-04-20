/**
 * Turn block: Elicitation-phase (design) question cards — active, answered variants
 * with full capture, trailing capture, and empty capture states.
 *
 * The elicitation phase asks about technical design trade-offs.
 */
import { ActiveQuestionCard, AnsweredQuestionCard } from '@/client/components/question-cards';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import { Separator } from '@/client/components/ui/separator';
import { createKnowledgeReferenceCode } from '@/shared/knowledge.js';
import type { SpecificationTurn as ProjectStateTurn } from '@/shared/specification.js';

// ── Fixture data ─────────────────────────────────────────────────────

const code = createKnowledgeReferenceCode;

const elicitationOptions = [
  {
    position: 0,
    content: 'Flag conflicts for human resolution with a priority-ranked queue',
    is_recommended: false,
  },
  { position: 1, content: 'Auto-resolve using stakeholder priority weights', is_recommended: true },
  {
    position: 2,
    content: 'Present trade-off analysis and defer to a designated decision-maker',
    is_recommended: false,
  },
  {
    position: 3,
    content: 'Split conflicting requirements into separate feature variants',
    is_recommended: false,
  },
];

function makeAnsweredTurn(overrides: Partial<ProjectStateTurn>): ProjectStateTurn {
  return {
    id: 10,
    project_id: 1,
    parent_turn_id: 5,
    phase: 'design',
    question: 'How should the system handle conflicting requirements from different stakeholder groups?',
    why: 'Conflict resolution strategy affects the entire requirements graph. Choosing the wrong approach early creates cascading rework later.',
    impact: 'medium',
    answer: null,
    is_resolution: false,
    user_parts: JSON.stringify([
      {
        type: 'data-turn-response',
        data: {
          turnId: 10,
          selectedOptionIds: [201, 203],
          freeText: 'Prefer human resolution for high-impact conflicts but auto-resolve low-priority ones.',
        },
      },
    ]),
    assistant_parts: null,
    created_at: '2025-06-02T14:30:00Z',
    options: [
      {
        id: 201,
        position: 0,
        content: 'Flag conflicts for human resolution with a priority-ranked queue',
        is_recommended: false,
        is_selected: true,
      },
      {
        id: 202,
        position: 1,
        content: 'Auto-resolve using stakeholder priority weights',
        is_recommended: true,
        is_selected: false,
      },
      {
        id: 203,
        position: 2,
        content: 'Present trade-off analysis and defer to a designated decision-maker',
        is_recommended: false,
        is_selected: true,
      },
      {
        id: 204,
        position: 3,
        content: 'Split conflicting requirements into separate feature variants',
        is_recommended: false,
        is_selected: false,
      },
    ],
    captured_items: [
      {
        collection: 'knowledge_item',
        kind: 'decision',
        id: 3,
        content: 'Hybrid conflict resolution — human for high-impact, automated for low',
        referenceCode: code('decision', 3),
      },
      {
        collection: 'knowledge_item',
        kind: 'assumption',
        id: 7,
        content: 'Stakeholder priority weights are maintained and kept current',
        referenceCode: code('assumption', 7),
      },
      {
        collection: 'knowledge_item',
        kind: 'constraint',
        id: 5,
        content: 'Conflict queue must surface within 24h of detection',
        referenceCode: code('constraint', 5),
      },
    ],
    ...overrides,
  };
}

const answeredFullCapture = makeAnsweredTurn({});

const answeredTrailing = makeAnsweredTurn({
  id: 11,
  captured_items: [],
});

const answeredNoCaptures = makeAnsweredTurn({
  id: 12,
  captured_items: [],
});

// ── Story ────────────────────────────────────────────────────────────

export function ElicitationStory() {
  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto max-w-5xl p-8">
        <h1 className="text-[22px] leading-none font-medium tracking-[-0.015em] text-ink">
          Turn Block — Elicitation Phase
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-sub">
          Question cards with design-phase fixture data. The elicitation phase asks about technical design
          trade-offs and captures decisions, assumptions, and constraints.
        </p>

        <Separator className="my-8" />

        {/* ── Active elicitation question ───────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Active Elicitation Question</h2>
          <p className="mt-1 text-sm text-sub">Medium-impact question about design trade-offs.</p>

          <div className="mt-6 max-w-2xl">
            <ActiveQuestionCard
              id="elicitation-3"
              questionCode="Q3"
              question="How should the system handle conflicting requirements from different stakeholder groups?"
              why="Conflict resolution strategy affects the entire requirements graph. Choosing the wrong approach early creates cascading rework later."
              impact="medium"
              options={elicitationOptions}
              persistedSelectedPositions={[]}
              persistedFreeText=""
              hasPersistedResponse={false}
              disabled={false}
              state="active"
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Answered — full capture ──────────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Answered — Full Capture</h2>
          <p className="mt-1 text-sm text-sub">
            Completed with captured decisions, assumptions, and constraints.
          </p>

          <div className="mt-6 max-w-2xl">
            <AnsweredQuestionCard turn={answeredFullCapture} questionCode="Q3" />
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Answered — trailing capture ──────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Answered — Trailing Capture</h2>
          <p className="mt-1 text-sm text-sub">
            Observer is still processing — capture status shows trailing.
          </p>

          <div className="mt-6 max-w-2xl">
            <AnsweredQuestionCard turn={answeredTrailing} questionCode="Q3" captureStatus="applying" />
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Answered — no captures ───────────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Answered — No Captures</h2>
          <p className="mt-1 text-sm text-sub">
            Completed turn where the observer produced no captured items.
          </p>

          <div className="mt-6 max-w-2xl">
            <AnsweredQuestionCard turn={answeredNoCaptures} questionCode="Q3" />
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}

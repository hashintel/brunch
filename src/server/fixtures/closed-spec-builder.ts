// Content-agnostic builder: seed a fully-closed four-phase specification from a knowledge graph.
//
// The all-phases-closed scenarios in scenarios.ts (seedIssueTrackerAllPhasesClosed and friends)
// hardwire issue-tracker content. This helper is the parameterized version: give it a knowledge
// graph (items keyed by a string + edges) and it replays the real interview ladder —
// grounding → design → requirements → criteria — with proposal/confirmation turns, review turns
// with options, phase_outcome closures, and captured/reviewed provenance, built on the same db
// primitives. Items route to phases by kind:
//   goal/term/context/constraint → captured in grounding
//   decision/assumption          → captured in design
//   requirement                  → presented + accepted in the requirements review
//   criterion                    → presented + accepted in the criteria review
//
// Edges are validated against the relationship policy so a bad mapping fails loudly at seed time.

import type { EdgeRelation, Impact } from '@/shared/api-types.js';
import { createKnowledgeReferenceCode, type KnowledgeKind } from '@/shared/knowledge.js';

import {
  addKnowledgeRelationship,
  advanceHead,
  applyTurnResponseSelections,
  confirmPhaseOutcome,
  createConfirmedPhaseOutcome,
  createKnowledgeItem,
  createOption,
  createPhaseOutcome,
  createTurn,
  linkKnowledgeItemToTurn,
  updateTurn,
  type DB,
} from '../db.js';
import { supportsKnowledgeRelationship } from '../knowledge-relationship-policy.js';
import {
  createFixtureReviewQuestionInput,
  serializeFixtureAcceptedReviewUserParts,
  serializeFixturePhaseConfirmationUserParts,
  serializeFixturePhaseProposalAssistantParts,
  serializeFixtureQuestionAssistantParts,
} from './helpers.js';

const code = createKnowledgeReferenceCode;

export interface ClosedSpecItem {
  key: string;
  kind: KnowledgeKind;
  content: string;
  rationale?: string;
  /**
   * Per-turn interviewer consequence hint for the grounding/design turn that elicits this item
   * (`turn.impact`). Defaults by kind via `defaultImpactForKind` — the spread is the signal, so
   * set the strategic forks to `high` explicitly and leave localized items on their default.
   */
  impact?: Impact;
  /** The eliciting question for this item's turn; defaults to a kind-appropriate prompt. */
  question?: string;
}

export interface ClosedSpecEdge {
  from: string;
  to: string;
  relation: EdgeRelation;
}

export interface ClosedSpecPlan {
  /** Opening grounding question + answer that frames the spec. */
  grounding: { question: string; answer: string };
  /** The design-phase commitment line (the tradeoff this spec settles). */
  designAnswer: string;
  /** All knowledge items; routed to phases by kind. */
  items: readonly ClosedSpecItem[];
  /** Policy-validated edges between items, by key. */
  edges: readonly ClosedSpecEdge[];
  /** Optional per-phase closure summaries; sensible defaults are used otherwise. */
  summaries?: {
    grounding?: string;
    design?: string;
    requirements?: string;
    criteria?: string;
  };
}

const GROUNDING_KINDS: ReadonlySet<KnowledgeKind> = new Set(['goal', 'term', 'context', 'constraint']);
const DESIGN_KINDS: ReadonlySet<KnowledgeKind> = new Set(['decision', 'assumption']);

// Impact rubric (src/server/prompts/interviewer-grounding.md): how much the answer shapes
// downstream choices. The core goal and binding constraints are `high`; surrounding context and
// design commitments are `medium`; vocabulary and assumptions-to-validate are `low`. These are
// kind-defaults — an item may override with its own `impact` to mark a strategic fork as `high`.
const DEFAULT_IMPACT_BY_KIND: Partial<Record<KnowledgeKind, Impact>> = {
  goal: 'high',
  constraint: 'high',
  context: 'medium',
  decision: 'medium',
  term: 'low',
  assumption: 'low',
};

function impactForItem(item: ClosedSpecItem): Impact {
  return item.impact ?? DEFAULT_IMPACT_BY_KIND[item.kind] ?? 'low';
}

const QUESTION_BY_KIND: Partial<Record<KnowledgeKind, string>> = {
  goal: 'What is the core goal here?',
  term: 'Which term should we pin down?',
  context: 'What surrounding context matters?',
  constraint: 'What constraint must hold?',
  decision: 'What did we decide here, and why?',
  assumption: 'What are we assuming for now?',
};

function questionForItem(item: ClosedSpecItem): string {
  return item.question ?? QUESTION_BY_KIND[item.kind] ?? 'Tell me more.';
}

/**
 * Seed a complete, all-phases-closed specification from an arbitrary knowledge graph.
 * Returns the map of item key → created knowledge_item id (useful for assertions/tests).
 */
export function seedClosedSpecFromKnowledge(
  db: DB,
  projectId: number,
  plan: ClosedSpecPlan,
): Record<string, number> {
  const summaries = {
    grounding:
      plan.summaries?.grounding ?? 'Goals, terms, context, and constraints are sufficiently captured.',
    design:
      plan.summaries?.design ??
      'The main architectural commitments are captured well enough to review requirements.',
    requirements:
      plan.summaries?.requirements ??
      'The reviewed requirement set is accepted and ready for acceptance criteria.',
    criteria:
      plan.summaries?.criteria ??
      'The reviewed criteria set is accepted and the specification is ready for output.',
  };

  const idByKey: Record<string, number> = {};
  const kindByKey: Record<string, KnowledgeKind> = {};

  const create = (item: ClosedSpecItem): number => {
    if (item.key in idByKey) {
      throw new Error(`Duplicate closed-spec item key: ${item.key}`);
    }
    const created = createKnowledgeItem(
      db,
      projectId,
      item.kind,
      item.content,
      item.rationale ? { rationale: item.rationale } : undefined,
    );
    idByKey[item.key] = created.id;
    kindByKey[item.key] = item.kind;
    return created.id;
  };

  const groundingItems = plan.items.filter((i) => GROUNDING_KINDS.has(i.kind));
  const designItems = plan.items.filter((i) => DESIGN_KINDS.has(i.kind));
  const requirementItems = plan.items.filter((i) => i.kind === 'requirement');
  const criterionItems = plan.items.filter((i) => i.kind === 'criterion');

  // --- Grounding (closed) ---
  // Opening framing turn — the high-impact "sketch in one breath".
  const groundingTurn = createTurn(db, projectId, {
    phase: 'grounding',
    question: plan.grounding.question,
    answer: plan.grounding.answer,
    impact: 'high',
  });
  advanceHead(db, projectId, groundingTurn.id);
  // One elicitation turn per grounding item, each carrying its OWN impact and capturing the
  // item it elicits — so the per-turn impact spread is the signal, not one flat capture turn.
  let groundingHead = groundingTurn.id;
  for (const item of groundingItems) {
    const turn = createTurn(db, projectId, {
      phase: 'grounding',
      parent_turn_id: groundingHead,
      question: questionForItem(item),
      answer: item.content,
      impact: impactForItem(item),
    });
    advanceHead(db, projectId, turn.id);
    linkKnowledgeItemToTurn(db, create(item), turn.id, 'captured');
    groundingHead = turn.id;
  }

  const groundingProposalTurn = createTurn(db, projectId, {
    phase: 'grounding',
    parent_turn_id: groundingHead,
    question: '',
    answer: 'We have enough grounding context',
  });
  updateTurn(db, groundingProposalTurn.id, {
    assistant_parts: serializeFixturePhaseProposalAssistantParts({
      turnId: groundingProposalTurn.id,
      phase: 'grounding',
      summary: summaries.grounding,
    }),
  });
  advanceHead(db, projectId, groundingProposalTurn.id);
  const groundingOutcome = createPhaseOutcome(db, {
    specificationId: projectId,
    phase: 'grounding',
    proposal_turn_id: groundingProposalTurn.id,
    summary: summaries.grounding,
  });
  const groundingConfirmationTurn = createTurn(db, projectId, {
    phase: 'grounding',
    parent_turn_id: groundingProposalTurn.id,
    question: '',
    answer: 'Confirm grounding closure',
    user_parts: serializeFixturePhaseConfirmationUserParts({
      phase: 'grounding',
      proposalTurnId: groundingProposalTurn.id,
    }),
  });
  confirmPhaseOutcome(db, groundingOutcome.id, groundingConfirmationTurn.id);
  advanceHead(db, projectId, groundingConfirmationTurn.id);

  // --- Design (closed) ---
  // Opening commitment turn — the high-impact tradeoff this spec settles.
  const designTurn = createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: groundingConfirmationTurn.id,
    question: 'Which tradeoff matters most?',
    answer: plan.designAnswer,
    impact: 'high',
  });
  advanceHead(db, projectId, designTurn.id);
  // One elicitation turn per design item (decision/assumption), each with its own impact.
  let designHead = designTurn.id;
  for (const item of designItems) {
    const turn = createTurn(db, projectId, {
      phase: 'design',
      parent_turn_id: designHead,
      question: questionForItem(item),
      answer: item.content,
      impact: impactForItem(item),
    });
    advanceHead(db, projectId, turn.id);
    linkKnowledgeItemToTurn(db, create(item), turn.id, 'captured');
    designHead = turn.id;
  }
  const designProposalTurn = createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: designHead,
    question: '',
    answer: 'We have enough design context',
  });
  updateTurn(db, designProposalTurn.id, {
    assistant_parts: serializeFixturePhaseProposalAssistantParts({
      turnId: designProposalTurn.id,
      phase: 'design',
      summary: summaries.design,
    }),
  });
  advanceHead(db, projectId, designProposalTurn.id);
  const designOutcome = createPhaseOutcome(db, {
    specificationId: projectId,
    phase: 'design',
    proposal_turn_id: designProposalTurn.id,
    summary: summaries.design,
  });
  const designConfirmationTurn = createTurn(db, projectId, {
    phase: 'design',
    parent_turn_id: designProposalTurn.id,
    question: '',
    answer: 'Confirm elicitation closure',
    user_parts: serializeFixturePhaseConfirmationUserParts({
      phase: 'design',
      proposalTurnId: designProposalTurn.id,
    }),
  });
  confirmPhaseOutcome(db, designOutcome.id, designConfirmationTurn.id);
  advanceHead(db, projectId, designConfirmationTurn.id);

  // --- Requirements (reviewed + accepted) ---
  const requirementsReviewTurn = seedAcceptedReview(db, projectId, {
    phase: 'requirements',
    title: 'Requirements',
    parentTurnId: designConfirmationTurn.id,
    toolCallId: 'fixture-requirements-review',
    summary: summaries.requirements,
    items: requirementItems,
    create,
  });

  // --- Criteria (reviewed + accepted) ---
  seedAcceptedReview(db, projectId, {
    phase: 'criteria',
    title: 'Acceptance Criteria',
    parentTurnId: requirementsReviewTurn,
    toolCallId: 'fixture-criteria-review',
    summary: summaries.criteria,
    items: criterionItems,
    create,
  });

  // --- Edges (validated) ---
  for (const edge of plan.edges) {
    const fromId = idByKey[edge.from];
    const toId = idByKey[edge.to];
    if (fromId === undefined || toId === undefined) {
      throw new Error(`Closed-spec edge references unknown key: ${edge.from} -> ${edge.to}`);
    }
    if (!supportsKnowledgeRelationship(edge.relation, kindByKey[edge.from]!, kindByKey[edge.to]!)) {
      throw new Error(
        `Closed-spec edge violates relation policy: ${kindByKey[edge.from]} -[${edge.relation}]-> ${kindByKey[edge.to]} (${edge.from} -> ${edge.to})`,
      );
    }
    addKnowledgeRelationship(db, fromId, toId, edge.relation);
  }

  return idByKey;
}

/**
 * Build one accepted review turn for a phase: create its items, present them as a review set,
 * select the accept option, link items as `reviewed`, and confirm the phase outcome.
 * Returns the review turn id (the new head / parent for the next phase).
 */
function seedAcceptedReview(
  db: DB,
  projectId: number,
  args: {
    phase: 'requirements' | 'criteria';
    title: string;
    parentTurnId: number;
    toolCallId: string;
    summary: string;
    items: readonly ClosedSpecItem[];
    create: (item: ClosedSpecItem) => number;
  },
): number {
  const referenceKind: KnowledgeKind = args.phase === 'requirements' ? 'requirement' : 'criterion';
  const prompt = `Please review the current ${args.phase === 'requirements' ? 'requirement' : 'criterion'} set.`;
  const why = `Review the whole ${args.phase === 'requirements' ? 'requirement' : 'criterion'} set before moving forward.`;

  const createdIds = args.items.map((item) => args.create(item));

  const reviewTurn = createTurn(db, projectId, {
    phase: args.phase,
    parent_turn_id: args.parentTurnId,
    question: prompt,
    why,
    impact: 'high',
    answer: 'Accept review',
    assistant_parts: serializeFixtureQuestionAssistantParts({
      turnId: 0,
      toolCallId: args.toolCallId,
      input: createFixtureReviewQuestionInput({
        phase: args.phase,
        title: args.title,
        prompt,
        why,
        items: args.items.map((item, index) => ({
          reviewItemId: `${args.phase}:${index + 1}`,
          referenceCode: code(referenceKind, index + 1),
          content: item.content,
          rationale: item.rationale ?? 'Captured from the reversed cook-fixture spec.',
          grounding: [{ code: code('goal', 1) }],
        })),
      }),
    }),
  });

  const acceptOption = createOption(db, reviewTurn.id, {
    position: 0,
    content: 'Accept review',
    is_recommended: true,
  });
  createOption(db, reviewTurn.id, { position: 1, content: 'Request changes', is_recommended: false });
  applyTurnResponseSelections(db, reviewTurn.id, [0]);
  updateTurn(db, reviewTurn.id, {
    user_parts: serializeFixtureAcceptedReviewUserParts({
      turnId: reviewTurn.id,
      selectedOptionIds: [acceptOption.id],
    }),
  });
  for (const itemId of createdIds) {
    linkKnowledgeItemToTurn(db, itemId, reviewTurn.id, 'reviewed');
  }
  createConfirmedPhaseOutcome(db, {
    specificationId: projectId,
    phase: args.phase,
    proposal_turn_id: reviewTurn.id,
    confirmation_turn_id: reviewTurn.id,
    summary: args.summary,
  });
  advanceHead(db, projectId, reviewTurn.id);

  return reviewTurn.id;
}

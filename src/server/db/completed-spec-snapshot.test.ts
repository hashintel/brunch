// FE-800 slice 6: unit tests for `buildCompletedSpecSnapshot`.
//
// Seeds a minimal completed-spec scenario in an in-memory DB:
//   - one specification with confirmed grounding + design phases
//   - two requirements; one accepted, one captured-only
//   - two criteria; one accepted, one captured-only
//   - one `verifies` edge whose source AND target are both accepted
//   - one `verifies` edge whose source is not accepted (must be filtered)
//   - one `depends_on` edge between two accepted requirements
//
// Then asserts the resulting `CompletedSpecSnapshot` contains only the
// accepted items, drops edges that reference non-accepted items, and
// preserves the edge relation enum verbatim.

import { beforeEach, afterEach, describe, expect, it } from 'vitest';

import {
  addKnowledgeRelationship,
  advanceHead,
  createConfirmedPhaseOutcome,
  createDb,
  createKnowledgeItem,
  createTurn,
  getOrCreateSpecification,
  linkKnowledgeItemToTurn,
  updateSpecificationMode,
  type DB,
} from '../db.js';
import {
  assertCompletedSpecReadyForPlanning,
  buildCompletedSpecSnapshot,
} from './completed-spec-snapshot.js';

let db: DB;

beforeEach(() => {
  db = createDb();
});

afterEach(() => {
  db.$client.close();
});

function seedCompletedSpec() {
  const specification = getOrCreateSpecification(db);

  const groundingTurn = createTurn(db, specification.id, {
    phase: 'grounding',
    question: 'What is the goal?',
    answer: 'A demo spec',
  });
  advanceHead(db, specification.id, groundingTurn.id);
  createConfirmedPhaseOutcome(db, {
    specificationId: specification.id,
    phase: 'grounding',
    proposal_turn_id: groundingTurn.id,
    confirmation_turn_id: groundingTurn.id,
    summary: 'Grounding captured.',
  });

  const designTurn = createTurn(db, specification.id, {
    phase: 'design',
    parent_turn_id: groundingTurn.id,
    question: 'Any design notes?',
    answer: 'None.',
  });
  advanceHead(db, specification.id, designTurn.id);
  createConfirmedPhaseOutcome(db, {
    specificationId: specification.id,
    phase: 'design',
    proposal_turn_id: designTurn.id,
    confirmation_turn_id: designTurn.id,
    summary: 'Design captured.',
  });

  // Two requirements; only the first one is accepted in the reviewed set.
  const acceptedReq1 = createKnowledgeItem(db, specification.id, 'requirement', 'Requirement one');
  const acceptedReq2 = createKnowledgeItem(db, specification.id, 'requirement', 'Requirement two');
  const draftReq = createKnowledgeItem(db, specification.id, 'requirement', 'Draft requirement');
  linkKnowledgeItemToTurn(db, acceptedReq1.id, designTurn.id, 'captured');
  linkKnowledgeItemToTurn(db, acceptedReq2.id, designTurn.id, 'captured');
  linkKnowledgeItemToTurn(db, draftReq.id, designTurn.id, 'captured');

  const requirementsReviewTurn = createTurn(db, specification.id, {
    phase: 'requirements',
    parent_turn_id: designTurn.id,
    question: 'Please review the current requirement set.',
    answer: 'Accept review',
  });
  linkKnowledgeItemToTurn(db, acceptedReq1.id, requirementsReviewTurn.id, 'reviewed');
  linkKnowledgeItemToTurn(db, acceptedReq2.id, requirementsReviewTurn.id, 'reviewed');
  // draftReq intentionally NOT reviewed → stays out of the accepted set.
  advanceHead(db, specification.id, requirementsReviewTurn.id);
  createConfirmedPhaseOutcome(db, {
    specificationId: specification.id,
    phase: 'requirements',
    proposal_turn_id: requirementsReviewTurn.id,
    confirmation_turn_id: requirementsReviewTurn.id,
    summary: 'Requirements accepted.',
  });

  const acceptedCrit = createKnowledgeItem(db, specification.id, 'criterion', 'Verifying criterion');
  const draftCrit = createKnowledgeItem(db, specification.id, 'criterion', 'Draft criterion');
  linkKnowledgeItemToTurn(db, acceptedCrit.id, requirementsReviewTurn.id, 'captured');
  linkKnowledgeItemToTurn(db, draftCrit.id, requirementsReviewTurn.id, 'captured');

  const criteriaReviewTurn = createTurn(db, specification.id, {
    phase: 'criteria',
    parent_turn_id: requirementsReviewTurn.id,
    question: 'Please review the current criterion set.',
    answer: 'Accept review',
  });
  linkKnowledgeItemToTurn(db, acceptedCrit.id, criteriaReviewTurn.id, 'reviewed');
  advanceHead(db, specification.id, criteriaReviewTurn.id);
  createConfirmedPhaseOutcome(db, {
    specificationId: specification.id,
    phase: 'criteria',
    proposal_turn_id: criteriaReviewTurn.id,
    confirmation_turn_id: criteriaReviewTurn.id,
    summary: 'Criteria accepted.',
  });

  // Edges:
  //   accepted criterion `verifies` accepted requirement 1  → keep
  //   draft criterion    `verifies` accepted requirement 1  → drop (source not accepted)
  //   accepted req 2     `depends_on` accepted req 1        → keep
  addKnowledgeRelationship(db, acceptedCrit.id, acceptedReq1.id, 'verifies');
  addKnowledgeRelationship(db, draftCrit.id, acceptedReq1.id, 'verifies');
  addKnowledgeRelationship(db, acceptedReq2.id, acceptedReq1.id, 'depends_on');

  return {
    specificationId: specification.id,
    acceptedReq1,
    acceptedReq2,
    acceptedCrit,
    draftReq,
    draftCrit,
  };
}

describe('buildCompletedSpecSnapshot', () => {
  it('includes only accepted requirements and criteria with stable kindOrdinal mapping', () => {
    const { specificationId, acceptedReq1, acceptedReq2, acceptedCrit } = seedCompletedSpec();

    const snapshot = buildCompletedSpecSnapshot(db, specificationId);

    expect(snapshot.requirements).toEqual([
      { id: acceptedReq1.id, content: 'Requirement one', kindOrdinal: 1 },
      { id: acceptedReq2.id, content: 'Requirement two', kindOrdinal: 2 },
    ]);
    expect(snapshot.criteria).toEqual([
      { id: acceptedCrit.id, content: 'Verifying criterion', kindOrdinal: 1 },
    ]);
  });

  it('drops edges whose endpoints reference non-accepted items and preserves the relation enum', () => {
    const { specificationId, acceptedReq1, acceptedReq2, acceptedCrit } = seedCompletedSpec();

    const snapshot = buildCompletedSpecSnapshot(db, specificationId);

    expect(snapshot.edges).toEqual(
      expect.arrayContaining([
        { fromItemId: acceptedCrit.id, toItemId: acceptedReq1.id, relation: 'verifies' },
        { fromItemId: acceptedReq2.id, toItemId: acceptedReq1.id, relation: 'depends_on' },
      ]),
    );
    expect(snapshot.edges).toHaveLength(2);
  });

  it('returns an empty snapshot when no items are accepted for the specification', () => {
    const specification = getOrCreateSpecification(db);

    const snapshot = buildCompletedSpecSnapshot(db, specification.id);

    expect(snapshot).toEqual({ mode: 'greenfield', requirements: [], criteria: [], edges: [] });
  });

  it('carries the specification mode onto the snapshot (greenfield by default)', () => {
    const { specificationId } = seedCompletedSpec();

    expect(buildCompletedSpecSnapshot(db, specificationId).mode).toBe('greenfield');
  });

  it('carries a brownfield specification mode onto the snapshot', () => {
    const { specificationId } = seedCompletedSpec();
    updateSpecificationMode(db, specificationId, 'brownfield');

    expect(buildCompletedSpecSnapshot(db, specificationId).mode).toBe('brownfield');
  });

  it('rejects planning when the criteria phase has not been confirmed', () => {
    const specification = getOrCreateSpecification(db);
    const snapshot = {
      requirements: [{ id: 10, content: 'Requirement one', kindOrdinal: 1 }],
      criteria: [{ id: 20, content: 'Criterion one', kindOrdinal: 1 }],
      edges: [],
    };

    expect(() => assertCompletedSpecReadyForPlanning(db, specification.id, snapshot)).toThrow(
      /confirm the criteria phase before planning/,
    );
  });

  it('rejects planning when confirmed criteria contain no accepted criteria', () => {
    const specification = getOrCreateSpecification(db);
    const turn = createTurn(db, specification.id, {
      phase: 'criteria',
      question: 'Please review the current criterion set.',
      answer: 'Accept review',
    });
    advanceHead(db, specification.id, turn.id);
    createConfirmedPhaseOutcome(db, {
      specificationId: specification.id,
      phase: 'criteria',
      proposal_turn_id: turn.id,
      confirmation_turn_id: turn.id,
      summary: 'Criteria accepted.',
    });

    const snapshot = {
      requirements: [{ id: 10, content: 'Requirement one', kindOrdinal: 1 }],
      criteria: [],
      edges: [],
    };

    expect(() => assertCompletedSpecReadyForPlanning(db, specification.id, snapshot)).toThrow(
      /has no accepted criteria/,
    );
  });
});

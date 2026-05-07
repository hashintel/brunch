import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from './app.js';
import {
  addKnowledgeRelationship,
  createKnowledgeItem,
  createPhaseOutcome,
  createSpecification,
  createTurn,
  getDownstreamItems,
  isItemInActiveReviewSet,
  linkKnowledgeItemToTurn,
  type DB,
} from './db.js';
import { classifyEditImpact } from './edit-impact.js';

let db: DB;

function createSpec(): number {
  return createSpecification(db, 'test').id;
}

beforeEach(() => {
  const created = createApp();
  db = created.db;
});

afterEach(() => {
  db.$client.close();
});

describe('classifyEditImpact', () => {
  it('returns none when downstreamCount is 0', () => {
    expect(classifyEditImpact(0, false)).toBe('none');
    expect(classifyEditImpact(0, true)).toBe('none');
  });

  it('returns soft when downstreamCount is 1-2 and no active review set membership', () => {
    expect(classifyEditImpact(1, false)).toBe('soft');
    expect(classifyEditImpact(2, false)).toBe('soft');
  });

  it('returns hard when downstreamCount is 1-2 but item is in active review set', () => {
    expect(classifyEditImpact(1, true)).toBe('hard');
    expect(classifyEditImpact(2, true)).toBe('hard');
  });

  it('returns hard when downstreamCount is 3+', () => {
    expect(classifyEditImpact(3, false)).toBe('hard');
    expect(classifyEditImpact(5, true)).toBe('hard');
  });
});

describe('getDownstreamItems', () => {
  it('returns items whose edges point TO the given item', () => {
    const specId = createSpec();
    const goal = createKnowledgeItem(db, specId, 'goal', 'Build a widget');
    const req1 = createKnowledgeItem(db, specId, 'requirement', 'Must support X');
    const req2 = createKnowledgeItem(db, specId, 'requirement', 'Must support Y');

    // req1 depends_on goal, req2 derived_from goal
    addKnowledgeRelationship(db, req1.id, goal.id, 'depends_on');
    addKnowledgeRelationship(db, req2.id, goal.id, 'derived_from');

    const downstream = getDownstreamItems(db, specId, goal.id);
    expect(downstream).toHaveLength(2);
    expect(downstream.map((d) => d.id).sort((a, b) => a - b)).toEqual(
      [req1.id, req2.id].sort((a, b) => a - b),
    );
  });

  it('returns empty array when no downstream items exist', () => {
    const specId = createSpec();
    const goal = createKnowledgeItem(db, specId, 'goal', 'Isolated goal');

    expect(getDownstreamItems(db, specId, goal.id)).toHaveLength(0);
  });

  it('does not return items from other specifications', () => {
    const specId1 = createSpec();
    const specId2 = createSpec();
    const goal = createKnowledgeItem(db, specId1, 'goal', 'Goal in spec 1');
    const req = createKnowledgeItem(db, specId2, 'requirement', 'Req in spec 2');

    addKnowledgeRelationship(db, req.id, goal.id, 'depends_on');

    // Query from spec1 perspective — req belongs to spec2 so shouldn't appear
    expect(getDownstreamItems(db, specId1, goal.id)).toHaveLength(0);
  });
});

describe('isItemInActiveReviewSet', () => {
  it('returns false when no phase outcomes exist', () => {
    const specId = createSpec();
    const item = createKnowledgeItem(db, specId, 'requirement', 'Some req');
    expect(isItemInActiveReviewSet(db, specId, item.id)).toBe(false);
  });

  it('returns true when item is linked to a proposed phase outcome via reviewed', () => {
    const specId = createSpec();
    const item = createKnowledgeItem(db, specId, 'requirement', 'A requirement');
    const turn = createTurn(db, specId, { phase: 'requirements', question: 'review' });

    createPhaseOutcome(db, {
      specificationId: specId,
      phase: 'requirements',
      proposal_turn_id: turn.id,
      summary: 'Review proposed',
    });

    linkKnowledgeItemToTurn(db, item.id, turn.id, 'reviewed');

    expect(isItemInActiveReviewSet(db, specId, item.id)).toBe(true);
  });

  it('returns false when phase outcome is confirmed (not proposed)', () => {
    const specId = createSpec();
    const item = createKnowledgeItem(db, specId, 'requirement', 'A requirement');
    const turn = createTurn(db, specId, { phase: 'requirements', question: 'review' });

    const outcome = createPhaseOutcome(db, {
      specificationId: specId,
      phase: 'requirements',
      proposal_turn_id: turn.id,
      summary: 'Review confirmed',
    });

    // Confirm the outcome
    db.run(sql`UPDATE phase_outcome SET status = 'confirmed' WHERE id = ${outcome.id}`);

    linkKnowledgeItemToTurn(db, item.id, turn.id, 'reviewed');

    expect(isItemInActiveReviewSet(db, specId, item.id)).toBe(false);
  });

  it('returns false when item is linked with captured instead of reviewed', () => {
    const specId = createSpec();
    const item = createKnowledgeItem(db, specId, 'requirement', 'A requirement');
    const turn = createTurn(db, specId, { phase: 'requirements', question: 'review' });

    createPhaseOutcome(db, {
      specificationId: specId,
      phase: 'requirements',
      proposal_turn_id: turn.id,
      summary: 'Review proposed',
    });

    linkKnowledgeItemToTurn(db, item.id, turn.id, 'captured');

    expect(isItemInActiveReviewSet(db, specId, item.id)).toBe(false);
  });
});

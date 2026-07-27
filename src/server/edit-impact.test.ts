import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from './app.js';
import {
  createKnowledgeItem,
  createPhaseOutcome,
  createSpecification,
  createTurn,
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
  it('returns none when affected item count is 0', () => {
    expect(classifyEditImpact(0, false)).toBe('none');
    expect(classifyEditImpact(0, true)).toBe('none');
  });

  it('returns soft when affected item count is 1-2 and no active review set membership', () => {
    expect(classifyEditImpact(1, false)).toBe('soft');
    expect(classifyEditImpact(2, false)).toBe('soft');
  });

  it('returns hard when affected item count is 1-2 but an item is in active review set', () => {
    expect(classifyEditImpact(1, true)).toBe('hard');
    expect(classifyEditImpact(2, true)).toBe('hard');
  });

  it('returns hard when affected item count is 3+', () => {
    expect(classifyEditImpact(3, false)).toBe('hard');
    expect(classifyEditImpact(5, true)).toBe('hard');
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

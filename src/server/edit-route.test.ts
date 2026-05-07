import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from './app.js';
import {
  addKnowledgeRelationship,
  createKnowledgeItem,
  createPhaseOutcome,
  createTurn,
  getKnowledgeItem,
  linkKnowledgeItemToTurn,
} from './db.js';

let app: ReturnType<typeof createApp>['app'];
let db: ReturnType<typeof createApp>['db'];

async function createSpec(name = 'Edit test spec'): Promise<number> {
  const res = await request(app).post('/api/specifications').send({ name }).expect(201);
  return res.body.id;
}

beforeEach(() => {
  const created = createApp();
  app = created.app;
  db = created.db;
});

afterEach(() => {
  db.$client.close();
});

describe('PATCH /api/specifications/:id/knowledge-items/:itemId', () => {
  it('applies a none-impact edit and returns updated: true', async () => {
    const specId = await createSpec();
    const goal = createKnowledgeItem(db, specId, 'goal', 'Original content');

    const res = await request(app)
      .patch(`/api/specifications/${specId}/knowledge-items/${goal.id}`)
      .send({ content: 'Updated content' })
      .expect(200);

    expect(res.body).toMatchObject({
      impact: 'none',
      affectedItems: [],
      updated: true,
    });

    const updated = getKnowledgeItem(db, goal.id);
    expect(updated?.content).toBe('Updated content');
  });

  it('applies a soft-impact edit with 1-2 downstream items', async () => {
    const specId = await createSpec();
    const goal = createKnowledgeItem(db, specId, 'goal', 'Original goal');
    const req1 = createKnowledgeItem(db, specId, 'requirement', 'Req depending on goal');
    addKnowledgeRelationship(db, req1.id, goal.id, 'depends_on');

    const res = await request(app)
      .patch(`/api/specifications/${specId}/knowledge-items/${goal.id}`)
      .send({ content: 'Updated goal' })
      .expect(200);

    expect(res.body.impact).toBe('soft');
    expect(res.body.updated).toBe(true);
    expect(res.body.affectedItems).toHaveLength(1);
    expect(res.body.affectedItems[0]).toMatchObject({
      id: req1.id,
      kind: 'requirement',
    });

    const updated = getKnowledgeItem(db, goal.id);
    expect(updated?.content).toBe('Updated goal');
  });

  it('rejects a hard-impact edit with updated: false', async () => {
    const specId = await createSpec();
    const goal = createKnowledgeItem(db, specId, 'goal', 'Central goal');
    const r1 = createKnowledgeItem(db, specId, 'requirement', 'R1');
    const r2 = createKnowledgeItem(db, specId, 'requirement', 'R2');
    const r3 = createKnowledgeItem(db, specId, 'requirement', 'R3');
    addKnowledgeRelationship(db, r1.id, goal.id, 'depends_on');
    addKnowledgeRelationship(db, r2.id, goal.id, 'depends_on');
    addKnowledgeRelationship(db, r3.id, goal.id, 'depends_on');

    const res = await request(app)
      .patch(`/api/specifications/${specId}/knowledge-items/${goal.id}`)
      .send({ content: 'Should not apply' })
      .expect(200);

    expect(res.body.impact).toBe('hard');
    expect(res.body.updated).toBe(false);
    expect(res.body.affectedItems).toHaveLength(3);

    // Content should NOT be changed
    const unchanged = getKnowledgeItem(db, goal.id);
    expect(unchanged?.content).toBe('Central goal');
  });

  it('rejects edit as hard when item is in active review set', async () => {
    const specId = await createSpec();
    const item = createKnowledgeItem(db, specId, 'requirement', 'A req');
    const dep = createKnowledgeItem(db, specId, 'criterion', 'A criterion');
    addKnowledgeRelationship(db, dep.id, item.id, 'verifies');

    // Create a proposed phase outcome and link item
    const turn = createTurn(db, specId, { phase: 'requirements', question: 'review' });
    createPhaseOutcome(db, {
      specificationId: specId,
      phase: 'requirements',
      proposal_turn_id: turn.id,
      summary: 'Review',
    });
    linkKnowledgeItemToTurn(db, item.id, turn.id, 'reviewed');

    const res = await request(app)
      .patch(`/api/specifications/${specId}/knowledge-items/${item.id}`)
      .send({ content: 'Updated req' })
      .expect(200);

    expect(res.body.impact).toBe('hard');
    expect(res.body.updated).toBe(false);
  });

  it('returns 404 when specification does not exist', async () => {
    await request(app)
      .patch('/api/specifications/99999/knowledge-items/1')
      .send({ content: 'test' })
      .expect(404);
  });

  it('returns 404 when knowledge item does not exist', async () => {
    const specId = await createSpec();
    await request(app)
      .patch(`/api/specifications/${specId}/knowledge-items/99999`)
      .send({ content: 'test' })
      .expect(404);
  });

  it('returns 400 when content is missing', async () => {
    const specId = await createSpec();
    const goal = createKnowledgeItem(db, specId, 'goal', 'A goal');
    await request(app).patch(`/api/specifications/${specId}/knowledge-items/${goal.id}`).send({}).expect(400);
  });

  it('updates rationale when provided', async () => {
    const specId = await createSpec();
    const goal = createKnowledgeItem(db, specId, 'goal', 'A goal', { rationale: 'Old rationale' });

    await request(app)
      .patch(`/api/specifications/${specId}/knowledge-items/${goal.id}`)
      .send({ content: 'New goal', rationale: 'New rationale' })
      .expect(200);

    const updated = getKnowledgeItem(db, goal.id);
    expect(updated?.content).toBe('New goal');
    expect(updated?.rationale).toBe('New rationale');
  });

  it('preserves existing rationale when the edit omits rationale', async () => {
    const specId = await createSpec();
    const goal = createKnowledgeItem(db, specId, 'goal', 'A goal', { rationale: 'Keep this rationale' });

    await request(app)
      .patch(`/api/specifications/${specId}/knowledge-items/${goal.id}`)
      .send({ content: 'New goal' })
      .expect(200);

    const updated = getKnowledgeItem(db, goal.id);
    expect(updated?.content).toBe('New goal');
    expect(updated?.rationale).toBe('Keep this rationale');
  });
});

describe('POST /api/specifications/:id/knowledge-edges/validate', () => {
  it('returns valid: true for allowed relationship', async () => {
    const specId = await createSpec();
    const criterion = createKnowledgeItem(db, specId, 'criterion', 'AC-1');
    const requirement = createKnowledgeItem(db, specId, 'requirement', 'REQ-1');

    const res = await request(app)
      .post(`/api/specifications/${specId}/knowledge-edges/validate`)
      .send({ fromItemId: criterion.id, toItemId: requirement.id, relation: 'verifies' })
      .expect(200);

    expect(res.body).toEqual({ valid: true });
  });

  it('returns valid: false for disallowed relationship', async () => {
    const specId = await createSpec();
    const goal = createKnowledgeItem(db, specId, 'goal', 'G-1');
    const requirement = createKnowledgeItem(db, specId, 'requirement', 'REQ-1');

    // goal cannot verify requirement
    const res = await request(app)
      .post(`/api/specifications/${specId}/knowledge-edges/validate`)
      .send({ fromItemId: goal.id, toItemId: requirement.id, relation: 'verifies' })
      .expect(200);

    expect(res.body.valid).toBe(false);
    expect(res.body.reason).toBeDefined();
  });

  it('returns valid: false when source item not found', async () => {
    const specId = await createSpec();
    const requirement = createKnowledgeItem(db, specId, 'requirement', 'REQ-1');

    const res = await request(app)
      .post(`/api/specifications/${specId}/knowledge-edges/validate`)
      .send({ fromItemId: 99999, toItemId: requirement.id, relation: 'depends_on' })
      .expect(200);

    expect(res.body.valid).toBe(false);
  });

  it('returns 404 when specification does not exist', async () => {
    await request(app)
      .post('/api/specifications/99999/knowledge-edges/validate')
      .send({ fromItemId: 1, toItemId: 2, relation: 'depends_on' })
      .expect(404);
  });
});

describe('POST /api/specifications/:id/knowledge-edges', () => {
  it('creates a valid edge and returns 201', async () => {
    const specId = await createSpec();
    const criterion = createKnowledgeItem(db, specId, 'criterion', 'AC-1');
    const requirement = createKnowledgeItem(db, specId, 'requirement', 'REQ-1');

    const res = await request(app)
      .post(`/api/specifications/${specId}/knowledge-edges`)
      .send({ fromItemId: criterion.id, toItemId: requirement.id, relation: 'verifies' })
      .expect(201);

    expect(res.body).toEqual({ created: true });
  });

  it('reports an existing edge without claiming it was newly created', async () => {
    const specId = await createSpec();
    const criterion = createKnowledgeItem(db, specId, 'criterion', 'AC-1');
    const requirement = createKnowledgeItem(db, specId, 'requirement', 'REQ-1');
    addKnowledgeRelationship(db, criterion.id, requirement.id, 'verifies');

    const res = await request(app)
      .post(`/api/specifications/${specId}/knowledge-edges`)
      .send({ fromItemId: criterion.id, toItemId: requirement.id, relation: 'verifies' })
      .expect(200);

    expect(res.body).toEqual({ created: false, alreadyExisted: true });
  });

  it('returns created: false for disallowed relationship', async () => {
    const specId = await createSpec();
    const goal = createKnowledgeItem(db, specId, 'goal', 'G-1');
    const requirement = createKnowledgeItem(db, specId, 'requirement', 'REQ-1');

    const res = await request(app)
      .post(`/api/specifications/${specId}/knowledge-edges`)
      .send({ fromItemId: goal.id, toItemId: requirement.id, relation: 'verifies' })
      .expect(200);

    expect(res.body.created).toBe(false);
    expect(res.body.reason).toBeDefined();
  });

  it('returns 404 when specification does not exist', async () => {
    await request(app)
      .post('/api/specifications/99999/knowledge-edges')
      .send({ fromItemId: 1, toItemId: 2, relation: 'depends_on' })
      .expect(404);
  });

  it('returns created: false when source item not found', async () => {
    const specId = await createSpec();
    const req = createKnowledgeItem(db, specId, 'requirement', 'REQ-1');

    const res = await request(app)
      .post(`/api/specifications/${specId}/knowledge-edges`)
      .send({ fromItemId: 99999, toItemId: req.id, relation: 'depends_on' })
      .expect(200);

    expect(res.body.created).toBe(false);
  });
});

describe('PATCH /api/specifications/:id/knowledge-items/:itemId — previous values for undo', () => {
  it('includes previousContent and previousRationale on a successful update', async () => {
    const specId = await createSpec();
    const goal = createKnowledgeItem(db, specId, 'goal', 'Original content', {
      rationale: 'Original rationale',
    });

    const res = await request(app)
      .patch(`/api/specifications/${specId}/knowledge-items/${goal.id}`)
      .send({ content: 'Updated content', rationale: 'Updated rationale' })
      .expect(200);

    expect(res.body).toMatchObject({
      updated: true,
      previousContent: 'Original content',
      previousRationale: 'Original rationale',
    });
  });

  it('omits previous values on a hard-impact deferral (no update happened)', async () => {
    const specId = await createSpec();
    const goal = createKnowledgeItem(db, specId, 'goal', 'Original content');
    // Three downstream → hard
    for (let i = 0; i < 3; i++) {
      const req = createKnowledgeItem(db, specId, 'requirement', `REQ-${i}`);
      addKnowledgeRelationship(db, req.id, goal.id, 'depends_on');
    }

    const res = await request(app)
      .patch(`/api/specifications/${specId}/knowledge-items/${goal.id}`)
      .send({ content: 'Updated content' })
      .expect(200);

    expect(res.body.impact).toBe('hard');
    expect(res.body.updated).toBe(false);
    expect(res.body.previousContent).toBeUndefined();
    expect(res.body.previousRationale).toBeUndefined();
  });

  it('round-trip: PATCH then PATCH back with previousContent restores original state', async () => {
    const specId = await createSpec();
    const goal = createKnowledgeItem(db, specId, 'goal', 'Original content', {
      rationale: 'Original rationale',
    });

    const apply = await request(app)
      .patch(`/api/specifications/${specId}/knowledge-items/${goal.id}`)
      .send({ content: 'Updated content', rationale: 'Updated rationale' })
      .expect(200);

    expect(apply.body.previousContent).toBe('Original content');
    expect(apply.body.previousRationale).toBe('Original rationale');

    await request(app)
      .patch(`/api/specifications/${specId}/knowledge-items/${goal.id}`)
      .send({ content: apply.body.previousContent, rationale: apply.body.previousRationale })
      .expect(200);

    const restored = getKnowledgeItem(db, goal.id);
    expect(restored?.content).toBe('Original content');
    expect(restored?.rationale).toBe('Original rationale');
  });
});

describe('DELETE /api/specifications/:id/knowledge-edges', () => {
  it('removes an existing edge and returns deleted: true', async () => {
    const specId = await createSpec();
    const criterion = createKnowledgeItem(db, specId, 'criterion', 'AC-1');
    const requirement = createKnowledgeItem(db, specId, 'requirement', 'REQ-1');
    addKnowledgeRelationship(db, criterion.id, requirement.id, 'verifies');

    const res = await request(app)
      .delete(`/api/specifications/${specId}/knowledge-edges`)
      .send({ fromItemId: criterion.id, toItemId: requirement.id, relation: 'verifies' })
      .expect(200);

    expect(res.body).toEqual({ deleted: true });
  });

  it('round-trip: POST then DELETE leaves no edge in the DB', async () => {
    const specId = await createSpec();
    const criterion = createKnowledgeItem(db, specId, 'criterion', 'AC-1');
    const requirement = createKnowledgeItem(db, specId, 'requirement', 'REQ-1');

    await request(app)
      .post(`/api/specifications/${specId}/knowledge-edges`)
      .send({ fromItemId: criterion.id, toItemId: requirement.id, relation: 'verifies' })
      .expect(201);

    await request(app)
      .delete(`/api/specifications/${specId}/knowledge-edges`)
      .send({ fromItemId: criterion.id, toItemId: requirement.id, relation: 'verifies' })
      .expect(200);

    const edges = db.$client
      .prepare('SELECT 1 FROM knowledge_edge WHERE from_item_id = ? AND to_item_id = ? AND relation = ?')
      .all(criterion.id, requirement.id, 'verifies');
    expect(edges).toHaveLength(0);
  });

  it('reports deleted: false when a scoped edge does not exist', async () => {
    const specId = await createSpec();
    const criterion = createKnowledgeItem(db, specId, 'criterion', 'AC-1');
    const requirement = createKnowledgeItem(db, specId, 'requirement', 'REQ-1');

    const res = await request(app)
      .delete(`/api/specifications/${specId}/knowledge-edges`)
      .send({ fromItemId: criterion.id, toItemId: requirement.id, relation: 'verifies' })
      .expect(200);

    expect(res.body).toEqual({ deleted: false });
  });

  it('returns 404 when specification does not exist', async () => {
    await request(app)
      .delete('/api/specifications/99999/knowledge-edges')
      .send({ fromItemId: 1, toItemId: 2, relation: 'depends_on' })
      .expect(404);
  });

  it('does not delete an edge whose items belong to another specification', async () => {
    const ownerSpecId = await createSpec('Owner spec');
    const requestSpecId = await createSpec('Request spec');
    const criterion = createKnowledgeItem(db, ownerSpecId, 'criterion', 'AC-1');
    const requirement = createKnowledgeItem(db, ownerSpecId, 'requirement', 'REQ-1');
    addKnowledgeRelationship(db, criterion.id, requirement.id, 'verifies');

    const res = await request(app)
      .delete(`/api/specifications/${requestSpecId}/knowledge-edges`)
      .send({ fromItemId: criterion.id, toItemId: requirement.id, relation: 'verifies' })
      .expect(200);

    expect(res.body).toMatchObject({ deleted: false });

    const edges = db.$client
      .prepare('SELECT 1 FROM knowledge_edge WHERE from_item_id = ? AND to_item_id = ? AND relation = ?')
      .all(criterion.id, requirement.id, 'verifies');
    expect(edges).toHaveLength(1);
  });
});

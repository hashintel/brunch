import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from './app.js';
import {
  addKnowledgeRelationship,
  createKnowledgeItem,
  openReconciliationNeed,
  resolveReconciliationNeed,
} from './db.js';

let app: ReturnType<typeof createApp>['app'];
let db: ReturnType<typeof createApp>['db'];

async function createSpec(name = 'Reconciliation needs spec'): Promise<number> {
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

describe('GET /api/specifications/:id/reconciliation-needs', () => {
  it('returns an empty list when no needs exist for the specification', async () => {
    const specId = await createSpec();

    const res = await request(app).get(`/api/specifications/${specId}/reconciliation-needs`).expect(200);

    expect(res.body).toEqual({ openNeeds: [] });
  });

  it('returns open reconciliation_need rows scoped to the specification', async () => {
    const specId = await createSpec();
    const goal = createKnowledgeItem(db, specId, 'goal', 'Central goal');
    const r1 = createKnowledgeItem(db, specId, 'requirement', 'R1');
    const r2 = createKnowledgeItem(db, specId, 'requirement', 'R2');
    addKnowledgeRelationship(db, r1.id, goal.id, 'depends_on');
    addKnowledgeRelationship(db, r2.id, goal.id, 'derived_from');
    openReconciliationNeed(db, {
      specificationId: specId,
      sourceItemId: goal.id,
      targetItemId: r1.id,
      kind: 'needs_confirmation',
      sourcePreviousContent: 'Central goal',
      sourceCurrentContent: 'Central goal (revised)',
    });
    openReconciliationNeed(db, {
      specificationId: specId,
      sourceItemId: goal.id,
      targetItemId: r2.id,
      kind: 'supersedes',
    });

    const res = await request(app).get(`/api/specifications/${specId}/reconciliation-needs`).expect(200);

    expect(res.body.openNeeds).toHaveLength(2);
    const byTarget = new Map<
      number,
      {
        kind: string;
        source_item_id: number;
        source_previous_content: string | null;
        source_current_content: string | null;
      }
    >(
      (
        res.body.openNeeds as Array<{
          id: number;
          source_item_id: number;
          target_item_id: number;
          kind: string;
          source_previous_content: string | null;
          source_current_content: string | null;
        }>
      ).map((n) => [
        n.target_item_id,
        {
          kind: n.kind,
          source_item_id: n.source_item_id,
          source_previous_content: n.source_previous_content,
          source_current_content: n.source_current_content,
        },
      ]),
    );
    expect(byTarget.get(r1.id)?.kind).toBe('needs_confirmation');
    expect(byTarget.get(r2.id)?.kind).toBe('supersedes');
    // Card 1: snapshot fields are exposed on the wire so the client can
    // render the source diff inline. Needs opened without snapshots (legacy
    // or test seeds) round-trip as nulls.
    expect(byTarget.get(r1.id)?.source_previous_content).toBe('Central goal');
    expect(byTarget.get(r1.id)?.source_current_content).toBe('Central goal (revised)');
    expect(byTarget.get(r2.id)?.source_previous_content).toBeNull();
    expect(byTarget.get(r2.id)?.source_current_content).toBeNull();
    for (const need of res.body.openNeeds) {
      expect(need.source_item_id).toBe(goal.id);
    }
  });

  it('excludes resolved reconciliation_need rows', async () => {
    const specId = await createSpec();
    const a = createKnowledgeItem(db, specId, 'goal', 'A');
    const b = createKnowledgeItem(db, specId, 'requirement', 'B');
    const need = openReconciliationNeed(db, {
      specificationId: specId,
      sourceItemId: a.id,
      targetItemId: b.id,
      kind: 'needs_confirmation',
    });

    resolveReconciliationNeed(db, need.id);

    const res = await request(app).get(`/api/specifications/${specId}/reconciliation-needs`).expect(200);

    expect(res.body.openNeeds).toEqual([]);
  });

  it('does not leak needs from other specifications', async () => {
    const ownerSpecId = await createSpec('Owner spec');
    const otherSpecId = await createSpec('Other spec');
    const a = createKnowledgeItem(db, ownerSpecId, 'goal', 'A');
    const b = createKnowledgeItem(db, ownerSpecId, 'requirement', 'B');
    openReconciliationNeed(db, {
      specificationId: ownerSpecId,
      sourceItemId: a.id,
      targetItemId: b.id,
      kind: 'needs_confirmation',
    });

    const res = await request(app).get(`/api/specifications/${otherSpecId}/reconciliation-needs`).expect(200);

    expect(res.body.openNeeds).toEqual([]);
  });

  it('returns 404 when the specification does not exist', async () => {
    await request(app).get('/api/specifications/99999/reconciliation-needs').expect(404);
  });

  it('returns 400 on a non-numeric specification id', async () => {
    await request(app).get('/api/specifications/abc/reconciliation-needs').expect(400);
  });
});

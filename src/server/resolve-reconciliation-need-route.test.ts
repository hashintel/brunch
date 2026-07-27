import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from './app.js';
import { createKnowledgeItem, listOpenReconciliationNeeds, openReconciliationNeed } from './db.js';

let app: ReturnType<typeof createApp>['app'];
let db: ReturnType<typeof createApp>['db'];

async function createSpec(name = 'Resolve test spec'): Promise<number> {
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

describe('POST /api/specifications/:id/reconciliation-needs/:needId/resolve', () => {
  it('transitions an open need to resolved with a resolved_at timestamp', async () => {
    const specId = await createSpec();
    const a = createKnowledgeItem(db, specId, 'goal', 'A');
    const b = createKnowledgeItem(db, specId, 'requirement', 'B');
    const need = openReconciliationNeed(db, {
      specificationId: specId,
      sourceItemId: a.id,
      targetItemId: b.id,
      kind: 'needs_confirmation',
    });

    const res = await request(app)
      .post(`/api/specifications/${specId}/reconciliation-needs/${need.id}/resolve`)
      .expect(200);

    expect(res.body).toEqual({ resolved: true });
    // Subsequent list excludes the resolved row
    expect(listOpenReconciliationNeeds(db, specId)).toEqual([]);
  });

  it('is idempotent — re-resolving an already-resolved need returns 200 and stays resolved', async () => {
    const specId = await createSpec();
    const a = createKnowledgeItem(db, specId, 'goal', 'A');
    const b = createKnowledgeItem(db, specId, 'requirement', 'B');
    const need = openReconciliationNeed(db, {
      specificationId: specId,
      sourceItemId: a.id,
      targetItemId: b.id,
      kind: 'needs_confirmation',
    });

    await request(app)
      .post(`/api/specifications/${specId}/reconciliation-needs/${need.id}/resolve`)
      .expect(200);

    const second = await request(app)
      .post(`/api/specifications/${specId}/reconciliation-needs/${need.id}/resolve`)
      .expect(200);

    expect(second.body).toEqual({ resolved: true });
    expect(listOpenReconciliationNeeds(db, specId)).toEqual([]);
  });

  it('returns 404 when the need does not exist', async () => {
    const specId = await createSpec();
    await request(app).post(`/api/specifications/${specId}/reconciliation-needs/99999/resolve`).expect(404);
  });

  it('returns 404 when the need belongs to a different specification', async () => {
    const ownerSpecId = await createSpec('Owner');
    const otherSpecId = await createSpec('Other');
    const a = createKnowledgeItem(db, ownerSpecId, 'goal', 'A');
    const b = createKnowledgeItem(db, ownerSpecId, 'requirement', 'B');
    const need = openReconciliationNeed(db, {
      specificationId: ownerSpecId,
      sourceItemId: a.id,
      targetItemId: b.id,
      kind: 'needs_confirmation',
    });

    await request(app)
      .post(`/api/specifications/${otherSpecId}/reconciliation-needs/${need.id}/resolve`)
      .expect(404);

    // The need must remain open for its rightful owner spec
    expect(listOpenReconciliationNeeds(db, ownerSpecId)).toHaveLength(1);
  });

  it('returns 400 on a non-numeric needId', async () => {
    const specId = await createSpec();
    await request(app).post(`/api/specifications/${specId}/reconciliation-needs/abc/resolve`).expect(400);
  });

  it('returns 400 on a non-numeric specId', async () => {
    await request(app).post(`/api/specifications/xyz/reconciliation-needs/1/resolve`).expect(400);
  });
});

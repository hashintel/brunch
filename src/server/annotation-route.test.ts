import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from './app.js';
import * as dbModule from './db.js';
import { knowledgeItem } from './schema.js';

let app: ReturnType<typeof createApp>['app'];
let db: ReturnType<typeof createApp>['db'];

async function createSpec(name = 'Annotation test spec'): Promise<number> {
  const res = await request(app).post('/api/specifications').send({ name }).expect(201);
  return res.body.id;
}

function seedKnowledgeItem(
  specId: number,
  kind: 'goal' | 'term' | 'context' | 'constraint' | 'requirement' | 'criterion' | 'decision' | 'assumption',
  content: string,
  rationale: string | null = null,
) {
  return dbModule.createKnowledgeItem(db, specId, kind, content, { rationale });
}

beforeEach(() => {
  const created = createApp();
  app = created.app;
  db = created.db;
});

afterEach(() => {
  db.$client.close();
});

describe('POST /api/specifications/:id/annotations', () => {
  it('returns 201 with the created annotation when payload is valid', async () => {
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.');

    const res = await request(app)
      .post(`/api/specifications/${specId}/annotations`)
      .send({
        itemKind: 'decision',
        itemId: decision.id,
        summary: 'Re-evaluate when scale demands.',
        body: 'SQLite is great for V1, but the embedded model will likely be a bottleneck past 10k specs.',
      })
      .expect(201);

    expect(res.body).toMatchObject({
      id: expect.any(Number),
      specification_id: specId,
      knowledge_item_id: decision.id,
      summary: 'Re-evaluate when scale demands.',
      body: expect.stringContaining('embedded model'),
      selection_start: null,
      selection_end: null,
      created_at: expect.any(String),
    });
  });

  it('returns 400 when the specification id is not numeric', async () => {
    await request(app)
      .post('/api/specifications/not-a-number/annotations')
      .send({ itemKind: 'decision', itemId: 1, summary: 's', body: 'b' })
      .expect(400);
  });

  it('returns 404 when the specification does not exist', async () => {
    await request(app)
      .post('/api/specifications/99999/annotations')
      .send({ itemKind: 'decision', itemId: 1, summary: 's', body: 'b' })
      .expect(404);
  });

  it('returns 400 when the request body is malformed', async () => {
    const specId = await createSpec();
    await request(app)
      .post(`/api/specifications/${specId}/annotations`)
      .send({ itemKind: 'not-a-kind', itemId: 1, summary: 's', body: 'b' })
      .expect(400);
  });

  it('returns 400 when summary is empty or whitespace-only', async () => {
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.');
    await request(app)
      .post(`/api/specifications/${specId}/annotations`)
      .send({ itemKind: 'decision', itemId: decision.id, summary: '   ', body: 'b' })
      .expect(400);
  });

  it('accepts whitespace-only body (trims to empty, which is now allowed)', async () => {
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.');

    const res = await request(app)
      .post(`/api/specifications/${specId}/annotations`)
      .send({
        itemKind: 'decision',
        itemId: decision.id,
        summary: 's',
        body: '   ',
      })
      .expect(201);

    expect(res.body.body).toBe('');
  });

  it('rejects payloads with no body field at all', async () => {
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.');

    await request(app)
      .post(`/api/specifications/${specId}/annotations`)
      .send({
        itemKind: 'decision',
        itemId: decision.id,
        summary: 's',
      })
      .expect(400);
  });

  it('returns 404 when (itemKind, itemId) does not resolve to an item in the spec', async () => {
    const specId = await createSpec();
    seedKnowledgeItem(specId, 'decision', 'Use SQLite.');
    await request(app)
      .post(`/api/specifications/${specId}/annotations`)
      .send({ itemKind: 'decision', itemId: 99999, summary: 's', body: 'b' })
      .expect(404);
  });

  it('returns 404 when the (itemKind, itemId) belongs to a different spec', async () => {
    const specA = await createSpec('Spec A');
    const specB = await createSpec('Spec B');
    const decisionInSpecA = seedKnowledgeItem(specA, 'decision', 'Spec A decision');
    await request(app)
      .post(`/api/specifications/${specB}/annotations`)
      .send({ itemKind: 'decision', itemId: decisionInSpecA.id, summary: 's', body: 'b' })
      .expect(404);
  });

  it('accepts annotations on every knowledge kind', async () => {
    const specId = await createSpec();
    const items = [
      seedKnowledgeItem(specId, 'goal', 'Ship V1.2'),
      seedKnowledgeItem(specId, 'term', 'Annotation: a durable note'),
      seedKnowledgeItem(specId, 'context', 'Single-user CLI tool'),
      seedKnowledgeItem(specId, 'constraint', 'No external services'),
      seedKnowledgeItem(specId, 'decision', 'Use SQLite'),
      seedKnowledgeItem(specId, 'assumption', 'Users have node installed'),
      seedKnowledgeItem(specId, 'requirement', 'Annotations persist'),
      seedKnowledgeItem(specId, 'criterion', 'Annotations survive restart'),
    ] as const;

    for (const item of items) {
      await request(app)
        .post(`/api/specifications/${specId}/annotations`)
        .send({ itemKind: item.kind, itemId: item.id, summary: 's', body: 'b' })
        .expect(201);
    }
  });

  it('persists selection_start/selection_end when provided', async () => {
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.');

    const res = await request(app)
      .post(`/api/specifications/${specId}/annotations`)
      .send({
        itemKind: 'decision',
        itemId: decision.id,
        summary: 'Use SQLite.',
        body: '',
        selectionStart: 4,
        selectionEnd: 10,
      })
      .expect(201);

    expect(res.body).toMatchObject({
      selection_start: 4,
      selection_end: 10,
    });
  });

  it('rejects payloads where selectionStart > selectionEnd', async () => {
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.');

    await request(app)
      .post(`/api/specifications/${specId}/annotations`)
      .send({
        itemKind: 'decision',
        itemId: decision.id,
        summary: 's',
        body: 'b',
        selectionStart: 10,
        selectionEnd: 4,
      })
      .expect(400);
  });
});

describe('GET /api/specifications/:id/annotations', () => {
  it('returns an empty array for a spec with no annotations', async () => {
    const specId = await createSpec();
    const res = await request(app).get(`/api/specifications/${specId}/annotations`).expect(200);
    expect(res.body).toEqual([]);
  });

  it('returns a chronological list of annotations for a spec', async () => {
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.');

    const first = await request(app)
      .post(`/api/specifications/${specId}/annotations`)
      .send({ itemKind: 'decision', itemId: decision.id, summary: 'first', body: 'first body' })
      .expect(201);
    const second = await request(app)
      .post(`/api/specifications/${specId}/annotations`)
      .send({ itemKind: 'decision', itemId: decision.id, summary: 'second', body: 'second body' })
      .expect(201);

    const res = await request(app).get(`/api/specifications/${specId}/annotations`).expect(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe(first.body.id);
    expect(res.body[1].id).toBe(second.body.id);
  });

  it('does not surface annotations from other specs', async () => {
    const specA = await createSpec('Spec A');
    const specB = await createSpec('Spec B');
    const decisionA = seedKnowledgeItem(specA, 'decision', 'A decision');
    const decisionB = seedKnowledgeItem(specB, 'decision', 'B decision');

    await request(app)
      .post(`/api/specifications/${specA}/annotations`)
      .send({ itemKind: 'decision', itemId: decisionA.id, summary: 'a', body: 'a' })
      .expect(201);
    await request(app)
      .post(`/api/specifications/${specB}/annotations`)
      .send({ itemKind: 'decision', itemId: decisionB.id, summary: 'b', body: 'b' })
      .expect(201);

    const resA = await request(app).get(`/api/specifications/${specA}/annotations`).expect(200);
    const resB = await request(app).get(`/api/specifications/${specB}/annotations`).expect(200);
    expect(resA.body).toHaveLength(1);
    expect(resB.body).toHaveLength(1);
    expect(resA.body[0].summary).toBe('a');
    expect(resB.body[0].summary).toBe('b');
  });

  it('returns 404 when the specification does not exist', async () => {
    await request(app).get('/api/specifications/99999/annotations').expect(404);
  });
});

describe('DELETE /api/annotations/:annotationId', () => {
  it('returns 204 and removes the annotation from subsequent listings', async () => {
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.');
    const created = await request(app)
      .post(`/api/specifications/${specId}/annotations`)
      .send({ itemKind: 'decision', itemId: decision.id, summary: 's', body: 'b' })
      .expect(201);

    await request(app).delete(`/api/annotations/${created.body.id}`).expect(204);

    const res = await request(app).get(`/api/specifications/${specId}/annotations`).expect(200);
    expect(res.body).toEqual([]);
  });

  it('is idempotent — DELETE on a missing annotation still returns 204', async () => {
    await request(app).delete('/api/annotations/99999').expect(204);
  });

  it('returns 400 when the annotation id is not numeric', async () => {
    await request(app).delete('/api/annotations/not-a-number').expect(400);
  });
});

describe('Annotation cascade behavior', () => {
  it('deletes annotations when their anchor knowledge_item is deleted', async () => {
    const specId = await createSpec();
    const decision = seedKnowledgeItem(specId, 'decision', 'Use SQLite.');
    await request(app)
      .post(`/api/specifications/${specId}/annotations`)
      .send({ itemKind: 'decision', itemId: decision.id, summary: 's', body: 'b' })
      .expect(201);

    db.delete(knowledgeItem).where(eq(knowledgeItem.id, decision.id)).run();

    const res = await request(app).get(`/api/specifications/${specId}/annotations`).expect(200);
    expect(res.body).toEqual([]);
  });
});

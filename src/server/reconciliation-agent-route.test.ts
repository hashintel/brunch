import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGenerateText, mockAnthropic } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockAnthropic: vi.fn(() => 'mock-model'),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: mockAnthropic,
}));

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    generateText: mockGenerateText,
  };
});

const { createApp } = await import('./app.js');
const {
  addKnowledgeRelationship,
  createKnowledgeItem,
  getReconciliationNeed,
  openReconciliationNeed,
  updateReconciliationNeedAgentFields,
} = await import('./db.js');

let app: ReturnType<typeof createApp>['app'];
let db: ReturnType<typeof createApp>['db'];

async function createSpec(name = 'Reconciliation agent spec'): Promise<number> {
  const res = await request(app).post('/api/specifications').send({ name }).expect(201);
  return res.body.id;
}

beforeEach(() => {
  mockGenerateText.mockReset();
  const created = createApp();
  app = created.app;
  db = created.db;
});

afterEach(() => {
  db.$client.close();
});

describe('POST /api/specifications/:id/reconciliation-needs/run-agent', () => {
  it('returns 200 with classifiedCount=0 / failedCount=0 on a spec with no awaiting needs', async () => {
    const specId = await createSpec();

    const res = await request(app)
      .post(`/api/specifications/${specId}/reconciliation-needs/run-agent`)
      .expect(200);

    expect(res.body.specId).toBe(specId);
    expect(res.body.classifiedCount).toBe(0);
    expect(res.body.failedCount).toBe(0);
    expect(typeof res.body.ranAt).toBe('string');
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('classifies every awaiting open need and walks the lifecycle through classified', async () => {
    const specId = await createSpec();
    const goal = createKnowledgeItem(db, specId, 'goal', 'Central goal');
    const r1 = createKnowledgeItem(db, specId, 'requirement', 'R1');
    const r2 = createKnowledgeItem(db, specId, 'requirement', 'R2');
    addKnowledgeRelationship(db, r1.id, goal.id, 'depends_on');
    addKnowledgeRelationship(db, r2.id, goal.id, 'derived_from');
    const n1 = openReconciliationNeed(db, {
      specificationId: specId,
      sourceItemId: goal.id,
      targetItemId: r1.id,
      kind: 'needs_confirmation',
      sourcePreviousContent: 'Central goal',
      sourceCurrentContent: 'Central goal (revised)',
    });
    const n2 = openReconciliationNeed(db, {
      specificationId: specId,
      sourceItemId: goal.id,
      targetItemId: r2.id,
      kind: 'supersedes',
    });

    mockGenerateText
      .mockResolvedValueOnce({ output: { classification: 'auto-confirm', proposal: null } })
      .mockResolvedValueOnce({
        output: { classification: 'auto-edit', proposal: 'Replace "goal" with "objective"' },
      });

    const res = await request(app)
      .post(`/api/specifications/${specId}/reconciliation-needs/run-agent`)
      .expect(200);

    expect(res.body.classifiedCount).toBe(2);
    expect(res.body.failedCount).toBe(0);

    const after1 = getReconciliationNeed(db, n1.id);
    expect(after1?.agent_status).toBe('classified');
    expect(after1?.agent_classification).toBe('auto-confirm');
    expect(after1?.agent_proposal).toBeNull();

    const after2 = getReconciliationNeed(db, n2.id);
    expect(after2?.agent_status).toBe('classified');
    expect(after2?.agent_classification).toBe('auto-edit');
    expect(after2?.agent_proposal).toBe('Replace "goal" with "objective"');
  });

  it('marks rows failed when the model throws and counts them in failedCount', async () => {
    const specId = await createSpec();
    const goal = createKnowledgeItem(db, specId, 'goal', 'G');
    const r1 = createKnowledgeItem(db, specId, 'requirement', 'R1');
    addKnowledgeRelationship(db, r1.id, goal.id, 'depends_on');
    const need = openReconciliationNeed(db, {
      specificationId: specId,
      sourceItemId: goal.id,
      targetItemId: r1.id,
      kind: 'needs_confirmation',
    });

    mockGenerateText.mockRejectedValueOnce(new Error('LLM unavailable'));

    const res = await request(app)
      .post(`/api/specifications/${specId}/reconciliation-needs/run-agent`)
      .expect(200);

    expect(res.body.classifiedCount).toBe(0);
    expect(res.body.failedCount).toBe(1);

    const after = getReconciliationNeed(db, need.id);
    expect(after?.agent_status).toBe('failed');
    expect(after?.agent_classification).toBeNull();
    expect(after?.agent_proposal).toBe('LLM unavailable');
  });

  it('marks rows failed with a Parse error proposal when the model returns an invalid label', async () => {
    const specId = await createSpec();
    const goal = createKnowledgeItem(db, specId, 'goal', 'G');
    const r1 = createKnowledgeItem(db, specId, 'requirement', 'R1');
    addKnowledgeRelationship(db, r1.id, goal.id, 'depends_on');
    const need = openReconciliationNeed(db, {
      specificationId: specId,
      sourceItemId: goal.id,
      targetItemId: r1.id,
      kind: 'needs_confirmation',
    });

    mockGenerateText.mockResolvedValueOnce({
      output: { classification: 'maybe-confirm', proposal: null },
    });

    const res = await request(app)
      .post(`/api/specifications/${specId}/reconciliation-needs/run-agent`)
      .expect(200);

    expect(res.body.classifiedCount).toBe(0);
    expect(res.body.failedCount).toBe(1);

    const after = getReconciliationNeed(db, need.id);
    expect(after?.agent_status).toBe('failed');
    expect(after?.agent_classification).toBeNull();
    expect(after?.agent_proposal).toMatch(/^Parse error: /);
  });

  it('skips rows that are already classified (agent_status not null)', async () => {
    const specId = await createSpec();
    const goal = createKnowledgeItem(db, specId, 'goal', 'G');
    const r1 = createKnowledgeItem(db, specId, 'requirement', 'R1');
    const r2 = createKnowledgeItem(db, specId, 'requirement', 'R2');
    addKnowledgeRelationship(db, r1.id, goal.id, 'depends_on');
    addKnowledgeRelationship(db, r2.id, goal.id, 'depends_on');
    const skipped = openReconciliationNeed(db, {
      specificationId: specId,
      sourceItemId: goal.id,
      targetItemId: r1.id,
      kind: 'needs_confirmation',
    });
    const fresh = openReconciliationNeed(db, {
      specificationId: specId,
      sourceItemId: goal.id,
      targetItemId: r2.id,
      kind: 'needs_confirmation',
    });
    updateReconciliationNeedAgentFields(db, skipped.id, {
      agent_status: 'classified',
      agent_classification: 'substantive',
      agent_proposal: 'pre-existing note',
    });

    mockGenerateText.mockResolvedValueOnce({
      output: { classification: 'auto-confirm', proposal: null },
    });

    const res = await request(app)
      .post(`/api/specifications/${specId}/reconciliation-needs/run-agent`)
      .expect(200);

    expect(res.body.classifiedCount).toBe(1);
    expect(res.body.failedCount).toBe(0);
    expect(mockGenerateText).toHaveBeenCalledTimes(1);

    const skippedAfter = getReconciliationNeed(db, skipped.id);
    expect(skippedAfter?.agent_classification).toBe('substantive');
    expect(skippedAfter?.agent_proposal).toBe('pre-existing note');

    const freshAfter = getReconciliationNeed(db, fresh.id);
    expect(freshAfter?.agent_status).toBe('classified');
    expect(freshAfter?.agent_classification).toBe('auto-confirm');
  });

  it('returns 404 when the specification does not exist', async () => {
    await request(app).post('/api/specifications/99999/reconciliation-needs/run-agent').expect(404);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('returns 400 when the specification id is non-numeric', async () => {
    await request(app).post('/api/specifications/abc/reconciliation-needs/run-agent').expect(400);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });
});

import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkflowPhase } from '@/shared/api-types.js';
import { type StructuredQuestion } from '@/shared/chat.js';
import { createKnowledgeReferenceCode } from '@/shared/knowledge.js';
import { getPhaseClosureCommandText } from '@/shared/phase-close.js';
import { getSpecificationRecord, type SpecificationState } from '@/shared/specification.js';

import { buildInterviewerContext } from './context.js';
import type { DB } from './db.js';
import {
  seedActiveDesign as _seedActiveDesign,
  seedAllPhasesClosed as _seedAllPhasesClosed,
  seedClosedGrounding as _seedClosedGrounding,
  seedCriteriaReady as _seedCriteriaReady,
  seedRequirementsReady as _seedRequirementsReady,
} from './fixtures/scenarios.js';

const { mockStreamInterviewer, mockRunObserver } = vi.hoisted(() => ({
  mockStreamInterviewer: vi.fn(),
  mockRunObserver: vi.fn(),
}));

vi.mock('./interview.js', async () => {
  const actual = await vi.importActual<typeof import('./interview.js')>('./interview.js');
  return {
    ...actual,
    streamInterviewer: mockStreamInterviewer,
  };
});

vi.mock('./observer.js', () => ({
  runObserver: mockRunObserver,
}));

const { createApp } = await import('./app.js');

let app: ReturnType<typeof createApp>['app'];
let db: DB;

function createMockObserverResult(overrides?: {
  entityIds?: Partial<
    Record<
      | 'goals'
      | 'terms'
      | 'contexts'
      | 'constraints'
      | 'requirements'
      | 'criteria'
      | 'decisions'
      | 'assumptions',
      number[]
    >
  >;
}) {
  return {
    entityIds: {
      goals: [],
      terms: [],
      contexts: [],
      constraints: [],
      requirements: [],
      criteria: [],
      decisions: [],
      assumptions: [],
      ...overrides?.entityIds,
    },
  };
}

const structuredQuestion: StructuredQuestion = {
  question: 'What platform should we support first?',
  why: 'Platform choice determines the first UI and deployment constraints.',
  impact: 'high',
  options: [
    { content: 'Web', is_recommended: true },
    { content: 'Desktop', is_recommended: false },
  ],
};

function createRuntimeReviewQuestion({
  phase,
  title,
  question,
  why,
  items,
}: {
  phase: 'requirements' | 'criteria';
  title: string;
  question: string;
  why: string;
  items: Array<{ reviewItemId: string; content: string; rationale?: string | null; referenceCode?: string }>;
}): StructuredQuestion {
  return {
    question,
    why,
    impact: 'high',
    options: [
      { content: 'Accept review', is_recommended: true },
      { content: 'Request changes', is_recommended: false },
    ],
    reviewActions: [
      { action: 'accept', optionPosition: 0 },
      { action: 'request-changes', optionPosition: 1 },
    ],
    reviewSet: {
      phase,
      title,
      items,
    },
  };
}

function createReviewSetAssistantParts({
  phase,
  title,
  question,
  why,
  items,
}: {
  phase: 'requirements' | 'criteria';
  title: string;
  question: string;
  why: string;
  items: Array<{ reviewItemId: string; content: string; rationale?: string | null; referenceCode?: string }>;
}) {
  return JSON.stringify([
    {
      type: 'tool-ask_question',
      toolCallId: `tool-${phase}-review`,
      state: 'output-available',
      input: {
        question,
        why,
        impact: 'high',
        options: [
          { content: 'Accept review', is_recommended: true },
          { content: 'Request changes', is_recommended: false },
        ],
        reviewActions: [
          { action: 'accept', optionPosition: 0 },
          { action: 'request-changes', optionPosition: 1 },
        ],
        reviewSet: {
          phase,
          title,
          items,
        },
      },
      output: { ok: true, turnId: 0, optionCount: 2 },
    },
    {
      type: 'data-review-set',
      data: {
        phase,
        title,
        items,
      },
    },
  ]);
}

function makeUIChunkStream(chunks: Array<Record<string, unknown>>) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

function makeTextInterviewer(text = 'Hi') {
  return {
    toUIMessageStream: () =>
      makeUIChunkStream([
        { type: 'start', messageId: 'msg-1' },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
      ]),
    finishReason: Promise.resolve('stop'),
  };
}

async function makeStructuredQuestionInterviewer(
  dbArg: DB,
  turnId: number,
  input: StructuredQuestion = structuredQuestion,
) {
  const { updateTurn, createOption } = await import('./db.js');

  updateTurn(dbArg, turnId, {
    question: input.question,
    why: input.why,
    impact: input.impact,
  });

  input.options.forEach((option, index) => {
    createOption(dbArg, turnId, {
      position: index,
      content: option.content,
      is_recommended: option.is_recommended,
    });
  });

  return {
    toUIMessageStream: () =>
      makeUIChunkStream([
        { type: 'start', messageId: 'msg-structured' },
        { type: 'tool-input-start', toolCallId: 'tool-1', toolName: 'ask_question' },
        {
          type: 'tool-input-available',
          toolCallId: 'tool-1',
          toolName: 'ask_question',
          input,
        },
        {
          type: 'tool-output-available',
          toolCallId: 'tool-1',
          output: { ok: true, turnId, optionCount: input.options.length },
        },
      ]),
    finishReason: Promise.resolve('tool-calls'),
  };
}

async function makePrefaceInterviewer(
  dbArg: DB,
  turnId: number,
  preface = {
    observation: 'The repo already uses SQLite-backed local persistence and a routed interview surface.',
    elaboration: 'This is provisional context before the first substantive grounding question.',
  },
  question: StructuredQuestion = {
    question: 'What is the primary feature area you want to specify?',
    why: 'Narrows the grounding scope to a concrete surface.',
    impact: 'high' as const,
    options: [
      { content: 'Workspace replay', is_recommended: true },
      { content: 'Export pipeline', is_recommended: false },
    ],
  },
) {
  const { updateTurn, createOption } = await import('./db.js');

  updateTurn(dbArg, turnId, {
    question: question.question,
    why: question.why,
    impact: question.impact,
  });

  question.options.forEach((option, index) => {
    createOption(dbArg, turnId, {
      position: index,
      content: option.content,
      is_recommended: option.is_recommended,
    });
  });

  return {
    toUIMessageStream: () =>
      makeUIChunkStream([
        { type: 'start', messageId: 'msg-preface' },
        { type: 'tool-input-start', toolCallId: 'tool-preface-1', toolName: 'present_preface' },
        {
          type: 'tool-input-available',
          toolCallId: 'tool-preface-1',
          toolName: 'present_preface',
          input: preface,
        },
        {
          type: 'tool-output-available',
          toolCallId: 'tool-preface-1',
          toolName: 'present_preface',
          output: { ok: true, turnId },
        },
        { type: 'tool-input-start', toolCallId: 'tool-q-1', toolName: 'ask_question' },
        {
          type: 'tool-input-available',
          toolCallId: 'tool-q-1',
          toolName: 'ask_question',
          input: question,
        },
        {
          type: 'tool-output-available',
          toolCallId: 'tool-q-1',
          output: { ok: true, turnId, optionCount: question.options.length },
        },
      ]),
    finishReason: Promise.resolve('tool-calls'),
  };
}

async function makePhaseClosureInterviewer(
  dbArg: DB,
  specificationId: number,
  turnId: number,
  phase: WorkflowPhase = 'grounding',
  summary = 'Goals, terms, context, and constraints are sufficiently captured.',
) {
  const { createPhaseOutcome } = await import('./db.js');

  createPhaseOutcome(dbArg, {
    specificationId,
    phase,
    proposal_turn_id: turnId,
    summary,
  });

  return {
    toUIMessageStream: () =>
      makeUIChunkStream([
        { type: 'start', messageId: 'msg-phase-summary' },
        { type: 'tool-input-start', toolCallId: 'tool-phase-1', toolName: 'propose_phase_closure' },
        {
          type: 'tool-input-available',
          toolCallId: 'tool-phase-1',
          toolName: 'propose_phase_closure',
          input: {
            phase,
            summary,
          },
        },
        {
          type: 'tool-output-available',
          toolCallId: 'tool-phase-1',
          toolName: 'propose_phase_closure',
          output: { ok: true, turnId, phase },
        },
      ]),
    finishReason: Promise.resolve('tool-calls'),
  };
}

function collectSSE(res: request.Response): string {
  return res.text;
}

function parseSSELines(body: string): Array<Record<string, unknown> | '[DONE]'> {
  return body
    .split('\n\n')
    .filter(Boolean)
    .map((chunk) => {
      const line = chunk.replace(/^data: /, '');
      if (line === '[DONE]') return '[DONE]';
      return JSON.parse(line) as Record<string, unknown>;
    });
}

async function createTestSpecification(name = 'Test Specification'): Promise<number> {
  const res = await request(app).post('/api/specifications').send({ name });
  return res.body.id;
}

async function getSpecificationSnapshot(specificationId: number) {
  const res = await request(app).get(`/api/specifications/${specificationId}`).expect(200);
  return res.body as SpecificationState;
}

function seedClosedGrounding(specificationId: number) {
  return _seedClosedGrounding(db, specificationId);
}

function seedActiveDesign(specificationId: number) {
  return _seedActiveDesign(db, specificationId);
}

function seedRequirementsReady(specificationId: number) {
  return _seedRequirementsReady(db, specificationId);
}

function seedCriteriaReady(specificationId: number) {
  return _seedCriteriaReady(db, specificationId);
}

function seedAllPhasesClosed(specificationId: number) {
  return _seedAllPhasesClosed(db, specificationId);
}

beforeEach(() => {
  mockStreamInterviewer.mockReset();
  mockRunObserver.mockReset();
  mockStreamInterviewer.mockImplementation(async () => makeTextInterviewer('Hi'));
  mockRunObserver.mockResolvedValue(createMockObserverResult());

  const result = createApp();
  app = result.app;
  db = result.db;
});

afterEach(() => {
  db.$client.close();
});

describe('json body parsing', () => {
  it('accepts chat-sized JSON payloads above the Express default parser limit', async () => {
    const largeMessage = 'x'.repeat(150 * 1024);

    const res = await request(app)
      .post('/api/specifications/not-a-number/chat')
      .send({ messages: [{ role: 'user', parts: [{ type: 'text', text: largeMessage }] }] })
      .expect(400);

    expect(res.body).toEqual({ error: 'Invalid specification ID' });
  });

  it('returns a JSON 413 response when the JSON payload exceeds the app limit', async () => {
    const oversizedMessage = 'x'.repeat(6 * 1024 * 1024);

    const res = await request(app)
      .post('/api/specifications/not-a-number/chat')
      .send({ messages: [{ role: 'user', parts: [{ type: 'text', text: oversizedMessage }] }] })
      .expect(413);

    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body).toEqual({ error: 'Request payload too large' });
  });
});

describe('GET /api/specifications', () => {
  it('returns an empty array when no projects exist', async () => {
    const res = await request(app).get('/api/specifications').expect(200);
    expect(res.body).toEqual([]);
  });

  it('returns workflow summary with grounding in-progress for a new project', async () => {
    await createTestSpecification('Fresh project');
    const res = await request(app).get('/api/specifications').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      name: 'Fresh project',
      workflowSummary: {
        grounding: 'in_progress',
        design: 'unstarted',
        requirements: 'unstarted',
        criteria: 'unstarted',
      },
    });
  });

  it('returns workflow summary reflecting closed grounding and in-progress design', async () => {
    const projectId = await createTestSpecification('Active project');
    seedActiveDesign(projectId);
    const res = await request(app).get('/api/specifications').expect(200);
    expect(res.body[0]).toMatchObject({
      workflowSummary: {
        grounding: 'closed',
        design: 'in_progress',
        requirements: 'unstarted',
        criteria: 'unstarted',
      },
    });
  });

  it('returns workflow summary with all phases closed for a completed project', async () => {
    const projectId = await createTestSpecification('Done project');
    seedAllPhasesClosed(projectId);
    const res = await request(app).get('/api/specifications').expect(200);
    expect(res.body[0]).toMatchObject({
      workflowSummary: {
        grounding: 'closed',
        design: 'closed',
        requirements: 'closed',
        criteria: 'closed',
      },
    });
  });
});

describe('GET /api/specifications/:id/export', () => {
  it('returns not ready when not all phases are closed', async () => {
    const projectId = await createTestSpecification('In Progress');
    seedRequirementsReady(projectId);
    const res = await request(app).get(`/api/specifications/${projectId}/export`).expect(200);
    expect(res.body).toEqual({ ready: false });
  });

  it('returns ready with markdown when all phases are closed', async () => {
    const projectId = await createTestSpecification('Done');
    seedAllPhasesClosed(projectId);
    const res = await request(app).get(`/api/specifications/${projectId}/export`).expect(200);
    expect(res.body.ready).toBe(true);
    expect(res.body.markdown).toContain('# Done');
    expect(res.body.markdown).toContain('Resume the interview from SQLite after restart');
    expect(res.body.markdown).toContain('Verify SQLite resume');
    expect(res.body.markdown).not.toContain('Support exporting the spec as a PDF');
  });
});

describe('POST /api/specifications', () => {
  it('creates a greenfield project by default', async () => {
    const res = await request(app).post('/api/specifications').send({ name: 'Greenfield' }).expect(201);
    expect(res.body.mode).toBe('greenfield');
    expect(res.body).not.toHaveProperty('cwd');
  });

  it('leaves kickoff projected until the user explicitly enters the interview', async () => {
    const createRes = await request(app)
      .post('/api/specifications')
      .send({ name: 'Projected kickoff' })
      .expect(201);

    const stateRes = await request(app).get(`/api/specifications/${createRes.body.id}`).expect(200);
    expect(stateRes.body.specification.active_turn_id).toBeNull();
    expect(stateRes.body.landing).toEqual({ kind: 'kickoff', phase: 'grounding', mode: 'start' });
    expect(stateRes.body.turns).toEqual([]);
  });

  it('creates a brownfield project with mode but no persisted workspace path', async () => {
    const res = await request(app)
      .post('/api/specifications')
      .send({ name: 'Brownfield', mode: 'brownfield' })
      .expect(201);
    expect(res.body.mode).toBe('brownfield');
    expect(res.body).not.toHaveProperty('cwd');
  });

  it('rejects client-supplied cwd data on project creation', async () => {
    await request(app)
      .post('/api/specifications')
      .send({ name: 'Brownfield', mode: 'brownfield', cwd: '/tmp/repo' })
      .expect(400);
  });

  it('persists mode in project state without exposing a specification cwd field', async () => {
    const createRes = await request(app)
      .post('/api/specifications')
      .send({ name: 'BF', mode: 'brownfield' })
      .expect(201);
    const stateRes = await request(app).get(`/api/specifications/${createRes.body.id}`).expect(200);
    expect(stateRes.body.specification.mode).toBe('brownfield');
    expect(stateRes.body.specification).not.toHaveProperty('cwd');
  });
});

describe('POST /api/specifications/:id/chat', () => {
  it('requires typed UI messages', async () => {
    const projectId = await createTestSpecification();

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({ messages: [{ role: 'user', content: 'hello' }] })
      .expect(400);
  });

  it('accepts follow-up chat history containing echoed workspace tool parts', async () => {
    const projectId = await createTestSpecification();

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] },
          {
            id: 'a1',
            role: 'assistant',
            parts: [
              { type: 'reasoning', text: 'Inspecting the workspace', state: 'done' },
              {
                type: 'dynamic-tool',
                toolName: 'list_directory',
                toolCallId: 'toolu_018J24NXxYXGSgxx6pMdPvgx',
                state: 'output-available',
                input: { path: '.' },
                output: {
                  entries: './:\n.brunch\nsrc/',
                  count: 2,
                },
              },
              {
                type: 'tool-ask_question',
                toolCallId: 'toolu_ask_question',
                state: 'output-available',
                input: {
                  question: 'What should we focus on first?',
                  why: 'This narrows the initial slice.',
                  impact: 'high',
                  options: [],
                },
                output: { ok: true, turnId: 2, optionCount: 0 },
              },
            ],
          },
          { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'Focus on export flow' }] },
        ],
      })
      .expect('Content-Type', /text\/event-stream/)
      .expect(200);

    expect(mockStreamInterviewer).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      expect.any(Array),
      'Focus on export flow',
      'grounding',
      undefined,
    );
  });

  it('returns an AI SDK UI message stream and persists the turn', async () => {
    const projectId = await createTestSpecification();

    const res = await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect('Content-Type', /text\/event-stream/)
      .expect(200);

    const events = parseSSELines(collectSSE(res));
    expect(events.some((event) => event !== '[DONE]' && event.type === 'text-delta')).toBe(true);
    expect(events.at(-1)).toBe('[DONE]');

    const { getActivePath } = await import('./db.js');
    const turns = getActivePath(db, projectId);
    expect(turns).toHaveLength(2);
    expect(turns[0].answer).toBe('hello');
    expect(turns[1].question).toBe('Hi');
    expect(turns[1].assistant_parts).not.toBeNull();
  });

  it('passes brownfield kickoff mode options into the interviewer stream after the projected kickoff selects existing codebase', async () => {
    const { createSpecification, getActivePath, getSpecification } = await import('./db.js');
    const projectId = createSpecification(db, 'Brownfield kickoff').id;

    expect(getActivePath(db, projectId)).toHaveLength(0);

    await request(app)
      .post(`/api/specifications/${projectId}/phase-intent`)
      .send({ kind: 'phase-entry', phase: 'grounding', mode: 'brownfield' })
      .expect(200, { ok: true });

    expect(getSpecification(db, projectId)).toMatchObject({
      mode: 'brownfield',
    });

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u1',
            role: 'user',
            parts: [
              {
                type: 'data-phase-intent',
                data: { kind: 'phase-entry', phase: 'grounding', mode: 'brownfield' },
              },
            ],
          },
        ],
      })
      .expect(200);

    expect(mockStreamInterviewer).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.any(Array),
      'Feature within existing codebase',
      'grounding',
      { mode: 'brownfield', cwd: process.cwd() },
    );
  });

  it('persists a preface first turn after brownfield kickoff instead of a repo-summary question handoff', async () => {
    const { createSpecification, getActivePath, getOptionsForTurn } = await import('./db.js');
    const projectId = createSpecification(db, 'Brownfield preface card').id;

    await request(app)
      .post(`/api/specifications/${projectId}/phase-intent`)
      .send({ kind: 'phase-entry', phase: 'grounding', mode: 'brownfield' })
      .expect(200, { ok: true });

    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makePrefaceInterviewer(dbArg as DB, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u-brownfield-grounding',
            role: 'user',
            parts: [
              {
                type: 'data-phase-intent',
                data: { kind: 'phase-entry', phase: 'grounding', mode: 'brownfield' },
              },
            ],
          },
        ],
      })
      .expect(200);

    const groundingTurn = getActivePath(db, projectId).at(-1)!;
    expect(groundingTurn.question).toBe('What is the primary feature area you want to specify?');
    expect(getOptionsForTurn(db, groundingTurn.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ position: 0, content: 'Workspace replay', is_recommended: true }),
        expect.objectContaining({ position: 1, content: 'Export pipeline', is_recommended: false }),
      ]),
    );
    const assistantParts = JSON.parse(groundingTurn.assistant_parts ?? '[]');
    expect(assistantParts).toEqual(
      expect.arrayContaining([
        {
          type: 'data-preface',
          data: {
            observation:
              'The repo already uses SQLite-backed local persistence and a routed interview surface.',
            elaboration: 'This is provisional context before the first substantive grounding question.',
          },
        },
      ]),
    );
    expect(assistantParts).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'tool-present_preface' })]),
    );
  });

  it('persists a reusable prefaced grounding turn during ongoing brownfield grounding', async () => {
    const { advanceHead, createSpecification, createTurn, getActivePath, getOptionsForTurn } =
      await import('./db.js');
    const project = createSpecification(db, 'Brownfield reusable grounding', { mode: 'brownfield' });
    const priorTurn = createTurn(db, project.id, {
      phase: 'grounding',
      question: 'Which seam still needs more grounding?',
      answer: 'The replay handoff.',
    });
    advanceHead(db, project.id, priorTurn.id);

    const followUpQuestion: StructuredQuestion = {
      question: 'What about the replay handoff is still unclear?',
      why: 'Turns the new context into one follow-up grounding move.',
      impact: 'medium',
      options: [],
    };

    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makePrefaceInterviewer(
        dbArg as DB,
        (turn as { id: number }).id,
        {
          observation: 'The replay path already persists turn-owned activity summaries.',
          elaboration: 'This later grounding pass narrows the next move to replay handoff details.',
        },
        followUpQuestion,
      ),
    );

    await request(app)
      .post(`/api/specifications/${project.id}/chat`)
      .send({
        messages: [
          {
            id: 'u-brownfield-ongoing',
            role: 'user',
            parts: [{ type: 'text', text: 'The replay handoff still feels risky.' }],
          },
        ],
      })
      .expect(200);

    expect(mockStreamInterviewer).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.arrayContaining([expect.objectContaining({ id: priorTurn.id })]),
      'The replay handoff still feels risky.',
      'grounding',
      { mode: 'brownfield', cwd: process.cwd() },
    );

    const activePath = getActivePath(db, project.id);
    expect(activePath).toHaveLength(2);

    const followUpTurn = activePath[1]!;
    expect(followUpTurn.question).toBe('What about the replay handoff is still unclear?');
    expect(followUpTurn.why).toBe('Turns the new context into one follow-up grounding move.');
    expect(followUpTurn.impact).toBe('medium');
    expect(getOptionsForTurn(db, followUpTurn.id)).toEqual([]);

    const assistantParts = JSON.parse(followUpTurn.assistant_parts ?? '[]');
    expect(assistantParts).toEqual([
      {
        type: 'data-preface',
        data: {
          observation: 'The replay path already persists turn-owned activity summaries.',
          elaboration: 'This later grounding pass narrows the next move to replay handoff details.',
        },
      },
    ]);
    expect(assistantParts).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'tool-present_preface' })]),
    );
  });

  it('emits canonical grounding-kind observer results and persists them through the entities API', async () => {
    const projectId = await createTestSpecification();
    mockRunObserver.mockImplementation(async (dbArg, turnArg, projectIdArg) => {
      const { createKnowledgeItem, linkKnowledgeItemToTurn } = await import('./db.js');
      const goal = createKnowledgeItem(
        dbArg as DB,
        projectIdArg as number,
        'goal',
        'Produce a clean implementation brief',
        {
          rationale: 'The interview should end in a trustworthy handoff',
        },
      );
      const term = createKnowledgeItem(dbArg as DB, projectIdArg as number, 'term', 'implementation brief', {
        rationale: 'The turn named the artifact the project is trying to produce',
      });
      const context = createKnowledgeItem(
        dbArg as DB,
        projectIdArg as number,
        'context',
        'The project starts from a fuzzy brief',
        {
          rationale: 'The user is still establishing the problem context',
        },
      );
      const constraint = createKnowledgeItem(
        dbArg as DB,
        projectIdArg as number,
        'constraint',
        'Keep setup instant',
        {
          subtype: 'non-goal',
          rationale: 'The launcher should stay lightweight',
        },
      );
      for (const itemId of [goal.id, term.id, context.id, constraint.id]) {
        linkKnowledgeItemToTurn(dbArg as DB, itemId, (turnArg as { id: number }).id);
      }
      return createMockObserverResult({
        entityIds: {
          goals: [goal.id],
          terms: [term.id],
          contexts: [context.id],
          constraints: [constraint.id],
        },
      });
    });

    const res = await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const events = parseSSELines(collectSSE(res)).filter((event) => event !== '[DONE]');
    const observerEvent = events.find((event) => event.type === 'data-observer-result');

    expect(observerEvent).toEqual({
      type: 'data-observer-result',
      data: {
        turnId: 1,
        entityIds: {
          goals: [1],
          terms: [2],
          contexts: [3],
          constraints: [4],
          requirements: [],
          criteria: [],
          decisions: [],
          assumptions: [],
        },
      },
    });

    const { getActivePath } = await import('./db.js');
    const turns = getActivePath(db, projectId);
    expect(turns).toHaveLength(2);
    expect(JSON.parse(turns[0]!.assistant_parts ?? '[]')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'data-observer-result',
          data: expect.objectContaining({ turnId: turns[0]!.id }),
        }),
      ]),
    );
    expect(JSON.parse(turns[1]!.assistant_parts ?? '[]')).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'data-observer-result' })]),
    );

    const entitiesRes = await request(app).get(`/api/specifications/${projectId}/entities`).expect(200);
    expect(entitiesRes.body.goals).toEqual([
      expect.objectContaining({
        id: 1,
        specification_id: projectId,
        kind: 'goal',
        subtype: null,
        content: 'Produce a clean implementation brief',
        rationale: 'The interview should end in a trustworthy handoff',
        referenceCode: createKnowledgeReferenceCode('goal', 1),
      }),
    ]);
    expect(entitiesRes.body.terms).toEqual([
      expect.objectContaining({
        id: 2,
        specification_id: projectId,
        kind: 'term',
        subtype: null,
        content: 'implementation brief',
        rationale: 'The turn named the artifact the project is trying to produce',
        referenceCode: createKnowledgeReferenceCode('term', 1),
      }),
    ]);
    expect(entitiesRes.body.contexts).toEqual([
      expect.objectContaining({
        id: 3,
        specification_id: projectId,
        kind: 'context',
        subtype: null,
        content: 'The project starts from a fuzzy brief',
        rationale: 'The user is still establishing the problem context',
        referenceCode: createKnowledgeReferenceCode('context', 1),
      }),
    ]);
    expect(entitiesRes.body.constraints).toEqual([
      expect.objectContaining({
        id: 4,
        specification_id: projectId,
        kind: 'constraint',
        subtype: 'non-goal',
        content: 'Keep setup instant',
        rationale: 'The launcher should stay lightweight',
        referenceCode: createKnowledgeReferenceCode('constraint', 1),
      }),
    ]);
  });

  it('defers structured-response observer capture to the turn-owned endpoint even when stale observer data belongs to a different turn', async () => {
    const projectId = await createTestSpecification();
    const { advanceHead, createTurn, getTurn } = await import('./db.js');
    const activeTurn = createTurn(db, projectId, {
      phase: 'grounding',
      question: 'Which interface matters most?',
      answer: null,
      assistant_parts: JSON.stringify([
        {
          type: 'data-observer-result',
          data: {
            turnId: 999,
            entityIds: {
              goals: [],
              terms: [],
              contexts: [],
              constraints: [],
              requirements: [],
              criteria: [],
              decisions: [],
              assumptions: [],
            },
          },
        },
      ]),
    });
    advanceHead(db, projectId, activeTurn.id);

    await request(app)
      .post(`/api/specifications/${projectId}/turns/${activeTurn.id}/response`)
      .send({
        kind: 'free-text',
        freeText: 'Terminal UI first',
      })
      .expect(200);

    mockRunObserver.mockResolvedValue(createMockObserverResult());
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makeStructuredQuestionInterviewer(dbArg as DB, (turn as { id: number }).id),
    );

    const chatRes = await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u-follow-up',
            role: 'user',
            parts: [{ type: 'text', text: 'Terminal UI first' }],
          },
        ],
      })
      .expect(200);

    expect(parseSSELines(collectSSE(chatRes)).filter((event) => event !== '[DONE]')).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'data-observer-result' })]),
    );
    expect(mockRunObserver).not.toHaveBeenCalled();

    await request(app)
      .post(`/api/specifications/${projectId}/turns/${activeTurn.id}/observer-capture`)
      .expect(200, { ok: true, turnId: activeTurn.id, status: 'captured' });

    expect(mockRunObserver).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ id: activeTurn.id }),
      projectId,
      expect.any(String),
    );
    expect(JSON.parse(getTurn(db, activeTurn.id)?.assistant_parts ?? '[]')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'data-observer-result',
          data: expect.objectContaining({ turnId: activeTurn.id }),
        }),
      ]),
    );
  });

  it('emits mixed observer results and persists generic design entities through the entities API', async () => {
    const projectId = await createTestSpecification();
    let createdIds: {
      context: number;
      constraint: number;
      assumption: number;
      decision: number;
    } | null = null;

    mockRunObserver.mockImplementation(async (dbArg, turnArg, projectIdArg) => {
      const {
        createKnowledgeItem,
        createDecision,
        createAssumption,
        addDecisionParentAssumption,
        linkKnowledgeItemToTurn,
        linkDecisionToTurn,
        linkAssumptionToTurn,
      } = await import('./db.js');
      const contextItem = createKnowledgeItem(
        dbArg as DB,
        projectIdArg as number,
        'context',
        'The first release still targets solo builders',
        {
          rationale: 'The turn clarified the intended audience',
        },
      );
      const constraint = createKnowledgeItem(
        dbArg as DB,
        projectIdArg as number,
        'constraint',
        'Do not add a plugin system yet',
        {
          subtype: 'non-goal',
          rationale: 'The first release should stay narrow',
        },
      );
      const assumption = createAssumption(dbArg as DB, projectIdArg as number, 'Users can work in a browser');
      const decision = createDecision(
        dbArg as DB,
        projectIdArg as number,
        'Start with the web app',
        'It is the fastest path to feedback',
      );
      addDecisionParentAssumption(dbArg as DB, decision.id, assumption.id);
      linkKnowledgeItemToTurn(dbArg as DB, contextItem.id, (turnArg as { id: number }).id);
      linkKnowledgeItemToTurn(dbArg as DB, constraint.id, (turnArg as { id: number }).id);
      linkAssumptionToTurn(dbArg as DB, assumption.id, (turnArg as { id: number }).id);
      linkDecisionToTurn(dbArg as DB, decision.id, (turnArg as { id: number }).id);
      createdIds = {
        context: contextItem.id,
        constraint: constraint.id,
        assumption: assumption.id,
        decision: decision.id,
      };
      return createMockObserverResult({
        entityIds: {
          contexts: [contextItem.id],
          constraints: [constraint.id],
          decisions: [decision.id],
          assumptions: [assumption.id],
        },
      });
    });

    const res = await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const events = parseSSELines(collectSSE(res)).filter((event) => event !== '[DONE]');
    const observerEvent = events.find((event) => event.type === 'data-observer-result');

    expect(createdIds).not.toBeNull();
    expect(observerEvent).toEqual({
      type: 'data-observer-result',
      data: {
        turnId: 1,
        entityIds: {
          goals: [],
          terms: [],
          contexts: [createdIds!.context],
          constraints: [createdIds!.constraint],
          requirements: [],
          criteria: [],
          decisions: [createdIds!.decision],
          assumptions: [createdIds!.assumption],
        },
      },
    });

    const entitiesRes = await request(app).get(`/api/specifications/${projectId}/entities`).expect(200);
    expect(entitiesRes.body.contexts).toEqual([
      expect.objectContaining({
        id: createdIds!.context,
        specification_id: projectId,
        kind: 'context',
        subtype: null,
        content: 'The first release still targets solo builders',
        rationale: 'The turn clarified the intended audience',
        referenceCode: createKnowledgeReferenceCode('context', 1),
      }),
    ]);
    expect(entitiesRes.body.constraints).toEqual([
      expect.objectContaining({
        id: createdIds!.constraint,
        specification_id: projectId,
        kind: 'constraint',
        subtype: 'non-goal',
        content: 'Do not add a plugin system yet',
        rationale: 'The first release should stay narrow',
        referenceCode: createKnowledgeReferenceCode('constraint', 1),
      }),
    ]);
    expect(entitiesRes.body.decisions).toEqual([
      expect.objectContaining({
        id: createdIds!.decision,
        specification_id: projectId,
        content: 'Start with the web app',
        rationale: 'It is the fastest path to feedback',
        referenceCode: createKnowledgeReferenceCode('decision', 1),
      }),
    ]);
    expect(entitiesRes.body.assumptions).toEqual([
      expect.objectContaining({
        id: createdIds!.assumption,
        specification_id: projectId,
        content: 'Users can work in a browser',
        referenceCode: createKnowledgeReferenceCode('assumption', 1),
      }),
    ]);
    expect(entitiesRes.body.relationships).toEqual([
      {
        type: 'depends_on',
        source: { collection: 'knowledge_item', kind: 'decision', id: createdIds!.decision },
        target: { collection: 'knowledge_item', kind: 'assumption', id: createdIds!.assumption },
      },
    ]);
  });

  it('keeps requirements empty before review acceptance even when the review-phase observer runs', async () => {
    const projectId = await createTestSpecification();
    mockRunObserver.mockImplementation(async () => createMockObserverResult());

    const res = await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const events = parseSSELines(collectSSE(res)).filter((event) => event !== '[DONE]');
    const observerEvent = events.find((event) => event.type === 'data-observer-result');

    expect(observerEvent).toEqual({
      type: 'data-observer-result',
      data: {
        turnId: 1,
        entityIds: {
          goals: [],
          terms: [],
          contexts: [],
          constraints: [],
          requirements: [],
          criteria: [],
          decisions: [],
          assumptions: [],
        },
      },
    });

    const entitiesRes = await request(app).get(`/api/specifications/${projectId}/entities`).expect(200);
    expect(entitiesRes.body.requirements).toEqual([]);
  });

  it('keeps criteria empty before review acceptance even when the review-phase observer runs', async () => {
    const projectId = await createTestSpecification();
    mockRunObserver.mockImplementation(async () => createMockObserverResult());

    const res = await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const events = parseSSELines(collectSSE(res)).filter((event) => event !== '[DONE]');
    const observerEvent = events.find((event) => event.type === 'data-observer-result');

    expect(observerEvent).toEqual({
      type: 'data-observer-result',
      data: {
        turnId: 1,
        entityIds: {
          goals: [],
          terms: [],
          contexts: [],
          constraints: [],
          requirements: [],
          criteria: [],
          decisions: [],
          assumptions: [],
        },
      },
    });

    const entitiesRes = await request(app).get(`/api/specifications/${projectId}/entities`).expect(200);
    expect(entitiesRes.body.criteria).toEqual([]);
  });
});

describe('GET /api/specifications/:id/entities', () => {
  it('returns canonical generic knowledge kinds alongside decisions, assumptions, and relationships', async () => {
    const projectId = await createTestSpecification();
    const { createDecision, createAssumption, createKnowledgeItem, addDecisionParentAssumption } =
      await import('./db.js');

    createKnowledgeItem(db, projectId, 'context', 'The project starts from an ambiguous brief');
    createKnowledgeItem(db, projectId, 'constraint', 'Keep setup instant', {
      subtype: 'non-goal',
      rationale: 'The launcher should stay simple',
    });
    createKnowledgeItem(db, projectId, 'requirement', 'Resume interviews from SQLite', {
      rationale: 'Users will close the browser mid-session',
    });
    createKnowledgeItem(db, projectId, 'criterion', 'Resuming restores the active path', {
      subtype: 'acceptance',
      rationale: 'Protects the persistence seam',
    });
    const decision = createDecision(db, projectId, 'Start with the web app');
    const assumption = createAssumption(db, projectId, 'Users arrive with a concrete goal');
    addDecisionParentAssumption(db, decision.id, assumption.id);

    const res = await request(app)
      .get(`/api/specifications/${projectId}/entities?mode=project-wide`)
      .expect(200);

    expect(res.body).toMatchObject({
      goals: [],
      terms: [],
      contexts: [
        {
          kind: 'context',
          content: 'The project starts from an ambiguous brief',
        },
      ],
      constraints: [
        {
          kind: 'constraint',
          subtype: 'non-goal',
          content: 'Keep setup instant',
          rationale: 'The launcher should stay simple',
        },
      ],
      requirements: [
        {
          kind: 'requirement',
          content: 'Resume interviews from SQLite',
          rationale: 'Users will close the browser mid-session',
        },
      ],
      criteria: [
        {
          kind: 'criterion',
          subtype: 'acceptance',
          content: 'Resuming restores the active path',
          rationale: 'Protects the persistence seam',
        },
      ],
      decisions: [{ content: 'Start with the web app' }],
      assumptions: [{ content: 'Users arrive with a concrete goal' }],
      relationships: [
        {
          type: 'depends_on',
          source: { collection: 'knowledge_item', kind: 'decision', id: decision.id },
          target: { collection: 'knowledge_item', kind: 'assumption', id: assumption.id },
        },
      ],
    });
  });

  it('projects relation vocabulary through the entities api', async () => {
    const { advanceHead, createKnowledgeItem, createTurn, linkKnowledgeItemToTurn } = await import('./db.js');

    const projectId = await createTestSpecification('Relation characterization');
    const rootTurn = createTurn(db, projectId, {
      phase: 'grounding',
      question: 'What are we building?',
      answer: 'A lightweight issue tracker.',
    });
    advanceHead(db, projectId, rootTurn.id);

    const goal = createKnowledgeItem(db, projectId, 'goal', 'Track work from creation to completion');
    const context = createKnowledgeItem(
      db,
      projectId,
      'context',
      'The team currently works from a spreadsheet',
    );
    const constraint = createKnowledgeItem(
      db,
      projectId,
      'constraint',
      'Keep the first release simpler than Jira',
    );
    const term = createKnowledgeItem(db, projectId, 'term', 'ticket');
    const requirement = createKnowledgeItem(
      db,
      projectId,
      'requirement',
      'Preserve relation semantics through the shared transport',
    );
    const criterion = createKnowledgeItem(
      db,
      projectId,
      'criterion',
      'The routed client receives the same relation kinds persisted in storage',
    );

    for (const item of [goal, context, constraint, term, requirement, criterion]) {
      linkKnowledgeItemToTurn(db, item.id, rootTurn.id);
    }

    for (const [fromItemId, toItemId, relation] of [
      [term.id, context.id, 'depends_on'],
      [constraint.id, goal.id, 'constrains'],
      [context.id, goal.id, 'derived_from'],
      [criterion.id, requirement.id, 'verifies'],
      [requirement.id, goal.id, 'refines'],
    ] as const) {
      db.$client
        .prepare('INSERT INTO knowledge_edge (from_item_id, to_item_id, relation) VALUES (?, ?, ?)')
        .run(fromItemId, toItemId, relation);
    }

    expect(
      db.$client
        .prepare('SELECT relation FROM knowledge_edge WHERE rowid IS NOT NULL ORDER BY relation')
        .all(),
    ).toEqual([
      { relation: 'constrains' },
      { relation: 'depends_on' },
      { relation: 'derived_from' },
      { relation: 'refines' },
      { relation: 'verifies' },
    ]);

    const res = await request(app).get(`/api/specifications/${projectId}/entities`).expect(200);

    expect(res.body.relationships).toEqual(
      expect.arrayContaining([
        {
          type: 'depends_on',
          source: { collection: 'knowledge_item', kind: 'term', id: term.id },
          target: { collection: 'knowledge_item', kind: 'context', id: context.id },
        },
        {
          type: 'constrains',
          source: { collection: 'knowledge_item', kind: 'constraint', id: constraint.id },
          target: { collection: 'knowledge_item', kind: 'goal', id: goal.id },
        },
        {
          type: 'derived_from',
          source: { collection: 'knowledge_item', kind: 'context', id: context.id },
          target: { collection: 'knowledge_item', kind: 'goal', id: goal.id },
        },
        {
          type: 'verifies',
          source: { collection: 'knowledge_item', kind: 'criterion', id: criterion.id },
          target: { collection: 'knowledge_item', kind: 'requirement', id: requirement.id },
        },
        {
          type: 'refines',
          source: { collection: 'knowledge_item', kind: 'requirement', id: requirement.id },
          target: { collection: 'knowledge_item', kind: 'goal', id: goal.id },
        },
      ]),
    );
  });

  it('keeps canonical entities on the active path while project-wide inventory stays explicit', async () => {
    const { advanceHead, createKnowledgeItem, createTurn, linkKnowledgeItemToTurn } = await import('./db.js');

    const projectId = await createTestSpecification('Branching Project');
    const rootTurn = createTurn(db, projectId, {
      phase: 'grounding',
      question: 'What kind of workflow is this project replacing?',
      answer: 'A spreadsheet-driven issue tracker process.',
    });
    advanceHead(db, projectId, rootTurn.id);

    const goal = createKnowledgeItem(
      db,
      projectId,
      'goal',
      'Replace spreadsheet issue tracking with a durable workflow',
    );
    linkKnowledgeItemToTurn(db, goal.id, rootTurn.id);

    const abandonedBranchTurn = createTurn(db, projectId, {
      phase: 'design',
      parent_turn_id: rootTurn.id,
      question: 'Which storage option should we take?',
      answer: 'Follow the SQLite branch.',
    });
    const activeBranchTurn = createTurn(db, projectId, {
      phase: 'design',
      parent_turn_id: rootTurn.id,
      question: 'Which storage option should we take?',
      answer: 'Follow the Postgres branch.',
    });
    advanceHead(db, projectId, activeBranchTurn.id);

    const abandonedDecision = createKnowledgeItem(db, projectId, 'decision', 'Use SQLite for persistence', {
      rationale: 'This belonged to the abandoned branch.',
    });
    const activeDecision = createKnowledgeItem(db, projectId, 'decision', 'Use Postgres for persistence', {
      rationale: 'This belongs to the active branch.',
    });
    linkKnowledgeItemToTurn(db, abandonedDecision.id, abandonedBranchTurn.id);
    linkKnowledgeItemToTurn(db, activeDecision.id, activeBranchTurn.id);

    const canonicalRes = await request(app).get(`/api/specifications/${projectId}/entities`).expect(200);
    expect(canonicalRes.body.decisions).toEqual([
      expect.objectContaining({ content: 'Use Postgres for persistence' }),
    ]);

    const projectWideRes = await request(app)
      .get(`/api/specifications/${projectId}/entities?mode=project-wide`)
      .expect(200);
    expect(projectWideRes.body.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ content: 'Use SQLite for persistence' }),
        expect.objectContaining({ content: 'Use Postgres for persistence' }),
      ]),
    );
  });
});

describe('phase outcomes + grounding closure', () => {
  it('streams a grounding phase summary proposal and projects workflow state from an explicit phase outcome', async () => {
    const projectId = await createTestSpecification();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makePhaseClosureInterviewer(dbArg as DB, projectId, (turn as { id: number }).id),
    );

    const chatRes = await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'We have enough grounding context' }] },
        ],
      })
      .expect(200);

    const events = parseSSELines(collectSSE(chatRes)).filter((event) => event !== '[DONE]');
    expect(events).toContainEqual({
      type: 'data-phase-summary',
      data: {
        turnId: 2,
        phase: 'grounding',
        summary: 'Goals, terms, context, and constraints are sufficiently captured.',
      },
    });

    const projectRes = await request(app).get(`/api/specifications/${projectId}`).expect(200);
    expect(projectRes.body.workflow.phases.grounding).toEqual({
      status: 'in_progress',
      closeability: false,
      readiness: 'low',
      closureBasis: null,
      proposalPending: true,
      turnId: 2,
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });
    expect(JSON.parse(projectRes.body.turns[1].assistant_parts ?? '[]')).toEqual(
      expect.arrayContaining([
        {
          type: 'data-phase-summary',
          data: {
            turnId: 2,
            phase: 'grounding',
            summary: 'Goals, terms, context, and constraints are sufficiently captured.',
          },
        },
      ]),
    );
  });

  it('confirms a proposed grounding phase outcome through /chat and persists confirmed workflow state', async () => {
    const projectId = await createTestSpecification();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makePhaseClosureInterviewer(dbArg as DB, projectId, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'We have enough grounding context' }] },
        ],
      })
      .expect(200);

    const scopeProposalState = await getSpecificationSnapshot(projectId);
    const scopeProposalTurnId = scopeProposalState.workflow.phases.grounding.turnId;

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u2',
            role: 'user',
            parts: [
              { type: 'text', text: 'Confirm grounding closure' },
              {
                type: 'data-confirmation',
                data: {
                  kind: 'confirm-proposed-phase-closure',
                  proposalTurnId: scopeProposalTurnId,
                  phase: 'grounding',
                },
              },
            ],
          },
        ],
      })
      .expect(200);

    const projectRes = await request(app).get(`/api/specifications/${projectId}`).expect(200);
    expect(projectRes.body.workflow.phases.grounding).toEqual(
      expect.objectContaining({
        status: 'closed',
        turnId: 2,
        summary: 'Goals, terms, context, and constraints are sufficiently captured.',
        closeability: false,
        readiness: 'low',
        closureBasis: 'interviewer_recommended',
        proposalPending: false,
      }),
    );
    const phaseOutcomes = db.$client
      .prepare('SELECT closure_basis FROM phase_outcome WHERE specification_id = ? ORDER BY id DESC')
      .all(projectId) as Array<{ closure_basis: string | null }>;
    expect(phaseOutcomes[0]).toEqual({ closure_basis: 'interviewer_recommended' });
    expect(projectRes.body.workflow.phases.design).toEqual(
      expect.objectContaining({
        status: 'in_progress',
        closeability: false,
        readiness: 'low',
        closureBasis: null,
        proposalPending: false,
      }),
    );
    expect(projectRes.body.specification.active_turn_id).toBe(scopeProposalTurnId);
    expect(projectRes.body.landing).toEqual({ kind: 'kickoff', phase: 'design', mode: 'start' });
    expect(projectRes.body.turns.at(-1)).toMatchObject({
      answer: 'Confirm grounding closure',
    });
    expect(JSON.parse(projectRes.body.turns.at(-1).user_parts ?? '[]')).toEqual([
      { type: 'text', text: 'Confirm grounding closure' },
      {
        type: 'data-confirmation',
        data: {
          kind: 'confirm-proposed-phase-closure',
          proposalTurnId: scopeProposalTurnId,
          phase: 'grounding',
        },
      },
    ]);
  });

  it('enters design mode on the next chat turn after grounding closure and runs the observer in design phase', async () => {
    const projectId = await createTestSpecification();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makePhaseClosureInterviewer(dbArg as DB, projectId, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'We have enough grounding context' }] },
        ],
      })
      .expect(200);

    const scopeProposalState = await getSpecificationSnapshot(projectId);
    const scopeProposalTurnId = scopeProposalState.workflow.phases.grounding.turnId;

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u2',
            role: 'user',
            parts: [
              { type: 'text', text: 'Confirm grounding closure' },
              {
                type: 'data-confirmation',
                data: {
                  kind: 'confirm-proposed-phase-closure',
                  proposalTurnId: scopeProposalTurnId,
                  phase: 'grounding',
                },
              },
            ],
          },
        ],
      })
      .expect(200);

    const observerCallCount = mockRunObserver.mock.calls.length;
    mockStreamInterviewer.mockImplementation(async () =>
      makeTextInterviewer('Which database tradeoff matters more?'),
    );

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u3',
            role: 'user',
            parts: [{ type: 'text', text: 'Let us compare SQLite and Postgres' }],
          },
        ],
      })
      .expect(200);

    expect(mockStreamInterviewer).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ phase: 'design' }),
      expect.any(Array),
      'Let us compare SQLite and Postgres',
      'design',
      undefined,
    );

    expect(mockRunObserver).toHaveBeenCalledTimes(observerCallCount + 1);
    expect(mockRunObserver).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ phase: 'grounding' }),
      projectId,
      expect.any(String),
    );
  });

  it('streams a design phase summary proposal and projects workflow state through the shared phase seam', async () => {
    const projectId = await createTestSpecification();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makePhaseClosureInterviewer(dbArg as DB, projectId, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'We have enough grounding context' }] },
        ],
      })
      .expect(200);

    const scopeProposalState = await getSpecificationSnapshot(projectId);
    const scopeProposalTurnId = scopeProposalState.workflow.phases.grounding.turnId;

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u2',
            role: 'user',
            parts: [
              { type: 'text', text: 'Confirm grounding closure' },
              {
                type: 'data-confirmation',
                data: {
                  kind: 'confirm-proposed-phase-closure',
                  proposalTurnId: scopeProposalTurnId,
                  phase: 'grounding',
                },
              },
            ],
          },
        ],
      })
      .expect(200);

    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makePhaseClosureInterviewer(
        dbArg as DB,
        projectId,
        (turn as { id: number }).id,
        'design',
        'The main architectural commitments are captured well enough to review requirements.',
      ),
    );

    const chatRes = await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u3',
            role: 'user',
            parts: [{ type: 'text', text: 'We have enough design direction now' }],
          },
        ],
      })
      .expect(200);

    const events = parseSSELines(collectSSE(chatRes)).filter((event) => event !== '[DONE]');
    expect(events).toContainEqual({
      type: 'data-phase-summary',
      data: {
        turnId: 3,
        phase: 'design',
        summary: 'The main architectural commitments are captured well enough to review requirements.',
      },
    });

    const projectRes = await request(app).get(`/api/specifications/${projectId}`).expect(200);
    expect(projectRes.body.workflow.phases.design).toEqual({
      status: 'in_progress',
      closeability: false,
      readiness: 'low',
      closureBasis: null,
      proposalPending: true,
      turnId: 3,
      summary: 'The main architectural commitments are captured well enough to review requirements.',
    });
    expect(projectRes.body.workflow.phases.requirements).toEqual(
      expect.objectContaining({
        status: 'unstarted',
        closeability: false,
        readiness: 'low',
        closureBasis: null,
        proposalPending: false,
      }),
    );
    expect(JSON.parse(projectRes.body.turns.at(-1).assistant_parts ?? '[]')).toEqual(
      expect.arrayContaining([
        {
          type: 'data-phase-summary',
          data: {
            turnId: 3,
            phase: 'design',
            summary: 'The main architectural commitments are captured well enough to review requirements.',
          },
        },
      ]),
    );
  });

  it('confirms a proposed design phase outcome and enters requirements mode on the next turn', async () => {
    const projectId = await createTestSpecification();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makePhaseClosureInterviewer(dbArg as DB, projectId, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'We have enough grounding context' }] },
        ],
      })
      .expect(200);

    const scopeProposalState = await getSpecificationSnapshot(projectId);
    const scopeProposalTurnId = scopeProposalState.workflow.phases.grounding.turnId;

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u2',
            role: 'user',
            parts: [
              { type: 'text', text: 'Confirm grounding closure' },
              {
                type: 'data-confirmation',
                data: {
                  kind: 'confirm-proposed-phase-closure',
                  proposalTurnId: scopeProposalTurnId,
                  phase: 'grounding',
                },
              },
            ],
          },
        ],
      })
      .expect(200);

    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makePhaseClosureInterviewer(
        dbArg as DB,
        projectId,
        (turn as { id: number }).id,
        'design',
        'The main architectural commitments are captured well enough to review requirements.',
      ),
    );

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u3',
            role: 'user',
            parts: [{ type: 'text', text: 'We have enough design direction now' }],
          },
        ],
      })
      .expect(200);

    const designProposalState = await getSpecificationSnapshot(projectId);
    const designProposalTurnId = designProposalState.workflow.phases.design.turnId;

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u4',
            role: 'user',
            parts: [
              { type: 'text', text: 'Confirm elicitation closure' },
              {
                type: 'data-confirmation',
                data: {
                  kind: 'confirm-proposed-phase-closure',
                  proposalTurnId: designProposalTurnId,
                  phase: 'design',
                },
              },
            ],
          },
        ],
      })
      .expect(200);

    const projectRes = await request(app).get(`/api/specifications/${projectId}`).expect(200);
    expect(projectRes.body.workflow.phases.design).toEqual(
      expect.objectContaining({
        status: 'closed',
        turnId: 3,
        summary: 'The main architectural commitments are captured well enough to review requirements.',
        closeability: false,
        readiness: 'low',
        closureBasis: 'interviewer_recommended',
        proposalPending: false,
      }),
    );
    expect(projectRes.body.workflow.phases.requirements).toEqual(
      expect.objectContaining({
        status: 'in_progress',
        closeability: false,
        readiness: 'low',
        closureBasis: null,
        proposalPending: false,
      }),
    );

    const observerCallCount = mockRunObserver.mock.calls.length;
    mockStreamInterviewer.mockImplementation(async () =>
      makeTextInterviewer('Which requirement is must-have?'),
    );

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u5',
            role: 'user',
            parts: [{ type: 'text', text: 'Let us review the must-have capabilities' }],
          },
        ],
      })
      .expect(200);

    expect(mockStreamInterviewer).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ phase: 'requirements' }),
      expect.any(Array),
      'Let us review the must-have capabilities',
      'requirements',
      undefined,
    );

    expect(mockRunObserver).toHaveBeenCalledTimes(observerCallCount + 1);
    expect(mockRunObserver).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ phase: 'design' }),
      projectId,
      expect.any(String),
    );
  });

  it('does not synthesize a replacement requirement review set through the response loop and keeps requirements not yet closeable', async () => {
    const projectId = await createTestSpecification();
    const seededRequirements = seedRequirementsReady(projectId);
    const { advanceHead, createOption, createTurn, getTurn } = await import('./db.js');

    const reviewTurn = createTurn(db, projectId, {
      phase: 'requirements',
      parent_turn_id: seededRequirements.designConfirmationTurn.id,
      question: 'Which requirements are still missing?',
      why: 'Review the current requirement set before closing requirements.',
      impact: 'high',
      answer: '',
    });
    createOption(db, reviewTurn.id, {
      position: 0,
      content: 'The current requirement set is complete',
      is_recommended: true,
    });
    createOption(db, reviewTurn.id, {
      position: 1,
      content: 'One requirement needs correction',
      is_recommended: false,
    });
    createOption(db, reviewTurn.id, {
      position: 2,
      content: 'A requirement is missing',
      is_recommended: false,
    });
    advanceHead(db, projectId, reviewTurn.id);

    await request(app)
      .post(`/api/specifications/${projectId}/turns/${reviewTurn.id}/response`)
      .send({
        kind: 'select-options',
        positions: [2],
        freeText: 'Export the reviewed spec as markdown',
      })
      .expect(200);

    mockStreamInterviewer.mockImplementation(async () =>
      makeTextInterviewer('Thanks, what else is missing?'),
    );
    mockRunObserver.mockImplementation(async (_dbArg, turnArg, observedProjectId) => {
      const turn = turnArg as { phase: string; answer: string | null };
      expect(turn.phase).toBe('requirements');
      expect(observedProjectId).toBe(projectId);

      if (!turn.answer?.includes('Export the reviewed spec as markdown')) {
        return createMockObserverResult();
      }

      return createMockObserverResult();
    });

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u-review',
            role: 'user',
            parts: [
              {
                type: 'text',
                text: 'A requirement is missing — Export the reviewed spec as markdown',
              },
            ],
          },
        ],
      })
      .expect(200);

    const projectRes = await request(app).get(`/api/specifications/${projectId}`).expect(200);
    expect(projectRes.body.workflow.phases.requirements).toEqual(
      expect.objectContaining({
        status: 'in_progress',
        closeability: false,
        proposalPending: false,
      }),
    );

    const entitiesRes = await request(app)
      .get(`/api/specifications/${projectId}/entities?mode=project-wide`)
      .expect(200);
    expect(entitiesRes.body.requirements).toEqual([]);

    const refreshedSpecificationState = await getSpecificationSnapshot(projectId);
    const frontierTurn = getTurn(db, getSpecificationRecord(refreshedSpecificationState).active_turn_id!);
    expect(JSON.parse(frontierTurn?.assistant_parts ?? '[]')).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'data-review-set',
        }),
      ]),
    );
  });

  it('emits a requirements phase-summary proposal once every requirement is explicitly reviewed', async () => {
    const projectId = await createTestSpecification();
    const seededRequirements = seedRequirementsReady(projectId);
    const { advanceHead, createKnowledgeItem, createTurn, linkKnowledgeItemToTurn } = await import('./db.js');

    const approvedRequirement = createKnowledgeItem(db, projectId, 'requirement', 'Export the reviewed spec');
    const rejectedRequirement = createKnowledgeItem(
      db,
      projectId,
      'requirement',
      'Support exporting the spec as a PDF',
    );

    const reviewTurn = createTurn(db, projectId, {
      phase: 'requirements',
      parent_turn_id: seededRequirements.designConfirmationTurn.id,
      question: 'Are these requirements all reviewed now?',
      answer: 'Yes — approve export and reject PDF export',
    });
    linkKnowledgeItemToTurn(db, approvedRequirement.id, reviewTurn.id, 'reviewed');
    linkKnowledgeItemToTurn(db, rejectedRequirement.id, reviewTurn.id, 'rejected');
    advanceHead(db, projectId, reviewTurn.id);

    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makePhaseClosureInterviewer(
        dbArg as DB,
        projectId,
        (turn as { id: number }).id,
        'requirements',
        'The requirement set has explicit review coverage and is ready to move into criteria.',
      ),
    );

    const chatRes = await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u-req-close',
            role: 'user',
            parts: [{ type: 'text', text: 'I think the requirement set is fully reviewed now' }],
          },
        ],
      })
      .expect(200);

    const projectRes = await request(app).get(`/api/specifications/${projectId}`).expect(200);
    const requirementsProposalTurnId = projectRes.body.workflow.phases.requirements.turnId;

    const events = parseSSELines(collectSSE(chatRes)).filter((event) => event !== '[DONE]');
    expect(events).toContainEqual({
      type: 'data-phase-summary',
      data: {
        turnId: requirementsProposalTurnId,
        phase: 'requirements',
        summary: 'The requirement set has explicit review coverage and is ready to move into criteria.',
      },
    });

    expect(projectRes.body.workflow.phases.requirements).toEqual(
      expect.objectContaining({
        status: 'in_progress',
        closeability: false,
        proposalPending: true,
        turnId: requirementsProposalTurnId,
        summary: 'The requirement set has explicit review coverage and is ready to move into criteria.',
      }),
    );
    expect(projectRes.body.workflow.phases.criteria).toEqual(
      expect.objectContaining({
        status: 'unstarted',
        proposalPending: false,
      }),
    );
  });

  it('confirms a proposed requirements phase outcome, closes requirements, and uses criteria on the next turn', async () => {
    const projectId = await createTestSpecification();
    const seededRequirements = seedRequirementsReady(projectId);
    const { advanceHead, createKnowledgeItem, createPhaseOutcome, createTurn, linkKnowledgeItemToTurn } =
      await import('./db.js');

    const approvedRequirement = createKnowledgeItem(db, projectId, 'requirement', 'Export the reviewed spec');
    const rejectedRequirement = createKnowledgeItem(
      db,
      projectId,
      'requirement',
      'Support exporting the spec as a PDF',
    );

    const reviewTurn = createTurn(db, projectId, {
      phase: 'requirements',
      parent_turn_id: seededRequirements.designConfirmationTurn.id,
      question: 'Are these requirements all reviewed now?',
      answer: 'Yes — approve export and reject PDF export',
    });
    linkKnowledgeItemToTurn(db, approvedRequirement.id, reviewTurn.id, 'reviewed');
    linkKnowledgeItemToTurn(db, rejectedRequirement.id, reviewTurn.id, 'rejected');
    advanceHead(db, projectId, reviewTurn.id);

    const proposalTurn = createTurn(db, projectId, {
      phase: 'requirements',
      parent_turn_id: reviewTurn.id,
      question: '',
      answer: 'The requirement set has explicit review coverage and is ready to move into criteria.',
    });
    advanceHead(db, projectId, proposalTurn.id);

    createPhaseOutcome(db, {
      specificationId: projectId,
      phase: 'requirements',
      proposal_turn_id: proposalTurn.id,
      summary: 'The requirement set has explicit review coverage and is ready to move into criteria.',
    });

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u-req-confirm',
            role: 'user',
            parts: [
              { type: 'text', text: 'Confirm requirements closure' },
              {
                type: 'data-confirmation',
                data: {
                  kind: 'confirm-proposed-phase-closure',
                  proposalTurnId: proposalTurn.id,
                  phase: 'requirements',
                },
              },
            ],
          },
        ],
      })
      .expect(200);

    const projectRes = await request(app).get(`/api/specifications/${projectId}`).expect(200);
    expect(projectRes.body.workflow.phases.requirements).toEqual(
      expect.objectContaining({
        status: 'closed',
        closeability: false,
        readiness: 'medium',
        closureBasis: 'interviewer_recommended',
        proposalPending: false,
        turnId: proposalTurn.id,
        summary: 'The requirement set has explicit review coverage and is ready to move into criteria.',
      }),
    );
    expect(projectRes.body.workflow.phases.criteria).toEqual(
      expect.objectContaining({
        status: 'in_progress',
        closeability: false,
        readiness: 'low',
        closureBasis: null,
        proposalPending: false,
      }),
    );

    const observerCallCount = mockRunObserver.mock.calls.length;
    mockStreamInterviewer.mockImplementation(async () =>
      makeTextInterviewer('Which acceptance criterion proves export works?'),
    );

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u-criteria-1',
            role: 'user',
            parts: [{ type: 'text', text: 'Let us define the first acceptance criterion' }],
          },
        ],
      })
      .expect(200);

    expect(mockStreamInterviewer).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ phase: 'criteria' }),
      expect.any(Array),
      'Let us define the first acceptance criterion',
      'criteria',
      undefined,
    );

    expect(mockRunObserver).toHaveBeenCalledTimes(observerCallCount + 1);
    expect(mockRunObserver).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ phase: 'requirements' }),
      projectId,
      expect.any(String),
    );

    const refreshedProjectRes = await request(app).get(`/api/specifications/${projectId}`).expect(200);
    expect(refreshedProjectRes.body.workflow.phases.requirements).toEqual(
      expect.objectContaining({
        status: 'closed',
        proposalPending: false,
      }),
    );
    expect(refreshedProjectRes.body.turns.at(-1).phase).toBe('criteria');
  });

  it('grounds the first criteria turn in approved requirements while keeping criteria draft-only before acceptance', async () => {
    const projectId = await createTestSpecification();
    seedCriteriaReady(projectId);

    mockStreamInterviewer.mockImplementation(async () =>
      makeTextInterviewer('What would prove the resume flow is complete?'),
    );
    mockRunObserver.mockImplementation(async () => createMockObserverResult());

    const observerCallCount = mockRunObserver.mock.calls.length;

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u-criteria-grounding',
            role: 'user',
            parts: [{ type: 'text', text: 'Let us define the first acceptance criterion' }],
          },
        ],
      })
      .expect(200);

    expect(mockStreamInterviewer).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ phase: 'criteria' }),
      expect.any(Array),
      expect.any(String),
      'criteria',
      undefined,
    );

    expect(mockRunObserver).toHaveBeenCalledTimes(observerCallCount + 1);
    expect(mockRunObserver).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ phase: 'requirements' }),
      projectId,
      expect.any(String),
    );

    const projectRes = await request(app).get(`/api/specifications/${projectId}`).expect(200);
    expect(projectRes.body.workflow.phases.criteria).toEqual(
      expect.objectContaining({
        status: 'in_progress',
        closeability: false,
      }),
    );

    const entitiesRes = await request(app)
      .get(`/api/specifications/${projectId}/entities?mode=project-wide`)
      .expect(200);
    expect(entitiesRes.body.criteria).toEqual([]);
  });

  it('emits a criteria phase-summary proposal once every criterion is explicitly reviewed', async () => {
    const projectId = await createTestSpecification();
    const seededCriteria = seedCriteriaReady(projectId);
    const { advanceHead, createKnowledgeItem, createTurn, linkKnowledgeItemToTurn } = await import('./db.js');

    const approvedCriterion = createKnowledgeItem(
      db,
      projectId,
      'criterion',
      'Markdown preview renders the reviewed requirements',
    );
    const rejectedCriterion = createKnowledgeItem(
      db,
      projectId,
      'criterion',
      'PDF export renders the reviewed requirements',
    );

    const reviewTurn = createTurn(db, projectId, {
      phase: 'criteria',
      parent_turn_id: seededCriteria.requirementsConfirmationTurn.id,
      question: 'Are these criteria all reviewed now?',
      answer: 'Yes — approve markdown and reject PDF export',
    });
    linkKnowledgeItemToTurn(db, approvedCriterion.id, reviewTurn.id, 'reviewed');
    linkKnowledgeItemToTurn(db, rejectedCriterion.id, reviewTurn.id, 'rejected');
    advanceHead(db, projectId, reviewTurn.id);

    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makePhaseClosureInterviewer(
        dbArg as DB,
        projectId,
        (turn as { id: number }).id,
        'criteria',
        'All criteria have been explicitly reviewed and the criteria set is ready to close.',
      ),
    );

    const chatRes = await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u-criteria-close',
            role: 'user',
            parts: [{ type: 'text', text: 'I think the criteria set is fully reviewed now' }],
          },
        ],
      })
      .expect(200);

    const projectRes = await request(app).get(`/api/specifications/${projectId}`).expect(200);
    const criteriaProposalTurnId = projectRes.body.workflow.phases.criteria.turnId;

    const events = parseSSELines(collectSSE(chatRes)).filter((event) => event !== '[DONE]');
    expect(events).toContainEqual({
      type: 'data-phase-summary',
      data: {
        turnId: criteriaProposalTurnId,
        phase: 'criteria',
        summary: 'All criteria have been explicitly reviewed and the criteria set is ready to close.',
      },
    });

    expect(projectRes.body.workflow.phases.criteria).toEqual(
      expect.objectContaining({
        status: 'in_progress',
        closeability: false,
        proposalPending: true,
        turnId: criteriaProposalTurnId,
        summary: 'All criteria have been explicitly reviewed and the criteria set is ready to close.',
      }),
    );
  });

  it('confirms a proposed criteria outcome, closes criteria, and projects all workflow phases as closed', async () => {
    const projectId = await createTestSpecification();
    const seededCriteria = seedCriteriaReady(projectId);
    const { advanceHead, createKnowledgeItem, createPhaseOutcome, createTurn, linkKnowledgeItemToTurn } =
      await import('./db.js');

    const approvedCriterion = createKnowledgeItem(
      db,
      projectId,
      'criterion',
      'Markdown preview renders the reviewed requirements',
    );
    const rejectedCriterion = createKnowledgeItem(
      db,
      projectId,
      'criterion',
      'PDF export renders the reviewed requirements',
    );

    const reviewTurn = createTurn(db, projectId, {
      phase: 'criteria',
      parent_turn_id: seededCriteria.requirementsConfirmationTurn.id,
      question: 'Are these criteria all reviewed now?',
      answer: 'Yes — approve markdown and reject PDF export',
    });
    linkKnowledgeItemToTurn(db, approvedCriterion.id, reviewTurn.id, 'reviewed');
    linkKnowledgeItemToTurn(db, rejectedCriterion.id, reviewTurn.id, 'rejected');
    advanceHead(db, projectId, reviewTurn.id);

    const proposalTurn = createTurn(db, projectId, {
      phase: 'criteria',
      parent_turn_id: reviewTurn.id,
      question: '',
      answer: 'All criteria have been explicitly reviewed and the criteria set is ready to close.',
    });
    advanceHead(db, projectId, proposalTurn.id);

    createPhaseOutcome(db, {
      specificationId: projectId,
      phase: 'criteria',
      proposal_turn_id: proposalTurn.id,
      summary: 'All criteria have been explicitly reviewed and the criteria set is ready to close.',
    });

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u-criteria-confirm',
            role: 'user',
            parts: [
              { type: 'text', text: 'Confirm acceptance criteria closure' },
              {
                type: 'data-confirmation',
                data: {
                  kind: 'confirm-proposed-phase-closure',
                  proposalTurnId: proposalTurn.id,
                  phase: 'criteria',
                },
              },
            ],
          },
        ],
      })
      .expect(200);

    const projectRes = await request(app).get(`/api/specifications/${projectId}`).expect(200);
    expect(projectRes.body.workflow.phases.criteria).toEqual(
      expect.objectContaining({
        status: 'closed',
        closeability: false,
        readiness: 'medium',
        closureBasis: 'interviewer_recommended',
        proposalPending: false,
        turnId: proposalTurn.id,
        summary: 'All criteria have been explicitly reviewed and the criteria set is ready to close.',
      }),
    );

    for (const phase of ['grounding', 'design', 'requirements', 'criteria'] as const) {
      expect(projectRes.body.workflow.phases[phase].status).toBe('closed');
    }

    const phaseOutcomes = db.$client
      .prepare(
        'SELECT phase, closure_basis FROM phase_outcome WHERE specification_id = ? AND status = ? ORDER BY id',
      )
      .all(projectId, 'confirmed') as Array<{ phase: string; closure_basis: string | null }>;
    expect(phaseOutcomes.map((o) => o.phase)).toEqual(['grounding', 'design', 'requirements', 'criteria']);
    expect(phaseOutcomes.at(-1)).toEqual({
      phase: 'criteria',
      closure_basis: 'interviewer_recommended',
    });
  });

  it('projects no stale active interviewer phase after criteria closure confirmation', async () => {
    const projectId = await createTestSpecification();
    const seededCriteria = seedCriteriaReady(projectId);
    const { advanceHead, createKnowledgeItem, createPhaseOutcome, createTurn, linkKnowledgeItemToTurn } =
      await import('./db.js');

    const criterion = createKnowledgeItem(
      db,
      projectId,
      'criterion',
      'Markdown preview renders the reviewed requirements',
    );

    const reviewTurn = createTurn(db, projectId, {
      phase: 'criteria',
      parent_turn_id: seededCriteria.requirementsConfirmationTurn.id,
      question: 'Review this criterion?',
      answer: 'Approve',
    });
    linkKnowledgeItemToTurn(db, criterion.id, reviewTurn.id, 'reviewed');
    advanceHead(db, projectId, reviewTurn.id);

    const proposalTurn = createTurn(db, projectId, {
      phase: 'criteria',
      parent_turn_id: reviewTurn.id,
      question: '',
      answer: 'Close criteria',
    });
    advanceHead(db, projectId, proposalTurn.id);

    createPhaseOutcome(db, {
      specificationId: projectId,
      phase: 'criteria',
      proposal_turn_id: proposalTurn.id,
      summary: 'Criteria reviewed.',
    });

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u-criteria-final-confirm',
            role: 'user',
            parts: [
              { type: 'text', text: 'Confirm acceptance criteria closure' },
              {
                type: 'data-confirmation',
                data: {
                  kind: 'confirm-proposed-phase-closure',
                  proposalTurnId: proposalTurn.id,
                  phase: 'criteria',
                },
              },
            ],
          },
        ],
      })
      .expect(200);

    const projectRes = await request(app).get(`/api/specifications/${projectId}`).expect(200);
    const allClosed = (['grounding', 'design', 'requirements', 'criteria'] as const).every(
      (phase) => projectRes.body.workflow.phases[phase].status === 'closed',
    );
    expect(allClosed).toBe(true);

    const activePhases = (['grounding', 'design', 'requirements', 'criteria'] as const).filter(
      (phase) => projectRes.body.workflow.phases[phase].status === 'in_progress',
    );
    expect(activePhases).toEqual([]);
  });

  it('force-closes design through the shared confirmation seam and enters requirements mode on the next turn', async () => {
    const projectId = await createTestSpecification();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makePhaseClosureInterviewer(dbArg as DB, projectId, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'We have enough grounding context' }] },
        ],
      })
      .expect(200);

    const scopeProposalState = await getSpecificationSnapshot(projectId);
    const scopeProposalTurnId = scopeProposalState.workflow.phases.grounding.turnId;

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u2',
            role: 'user',
            parts: [
              { type: 'text', text: 'Confirm grounding closure' },
              {
                type: 'data-confirmation',
                data: {
                  kind: 'confirm-proposed-phase-closure',
                  proposalTurnId: scopeProposalTurnId,
                  phase: 'grounding',
                },
              },
            ],
          },
        ],
      })
      .expect(200);

    mockStreamInterviewer.mockImplementation(async () =>
      makeTextInterviewer('Which database tradeoff matters more?'),
    );

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u3',
            role: 'user',
            parts: [{ type: 'text', text: 'Let us compare SQLite and Postgres' }],
          },
        ],
      })
      .expect(200);

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u4',
            role: 'user',
            parts: [
              { type: 'text', text: 'Force elicitation closure' },
              {
                type: 'data-confirmation',
                data: { kind: 'force-close-active-phase', phase: 'design' },
              },
            ],
          },
        ],
      })
      .expect(200);

    const projectRes = await request(app).get(`/api/specifications/${projectId}`).expect(200);
    expect(projectRes.body.workflow.phases.design).toEqual(
      expect.objectContaining({
        status: 'closed',
        closeability: false,
        readiness: 'low',
        closureBasis: 'user_forced',
        proposalPending: false,
      }),
    );
    const phaseOutcomes = db.$client
      .prepare('SELECT closure_basis FROM phase_outcome WHERE specification_id = ? ORDER BY id DESC')
      .all(projectId) as Array<{ closure_basis: string | null }>;
    expect(phaseOutcomes[0]).toEqual({ closure_basis: 'user_forced' });
    expect(projectRes.body.workflow.phases.requirements).toEqual(
      expect.objectContaining({
        status: 'in_progress',
        closeability: false,
        readiness: 'low',
        closureBasis: null,
        proposalPending: false,
      }),
    );
    expect(projectRes.body.specification.active_turn_id).toBe(projectRes.body.turns.at(-1).id);
    expect(projectRes.body.landing).toEqual({ kind: 'kickoff', phase: 'requirements', mode: 'start' });
    expect(projectRes.body.turns.at(-1)).toMatchObject({
      phase: 'design',
      answer: 'Force elicitation closure',
    });
    expect(JSON.parse(projectRes.body.turns.at(-1).user_parts ?? '[]')).toEqual([
      { type: 'text', text: 'Force elicitation closure' },
      {
        type: 'data-confirmation',
        data: { kind: 'force-close-active-phase', phase: 'design' },
      },
    ]);

    const observerCallCount = mockRunObserver.mock.calls.length;

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u5',
            role: 'user',
            parts: [{ type: 'text', text: 'Let us review the must-have capabilities' }],
          },
        ],
      })
      .expect(200);

    expect(mockStreamInterviewer).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ phase: 'requirements' }),
      expect.any(Array),
      'Let us review the must-have capabilities',
      'requirements',
      undefined,
    );

    expect(mockRunObserver).toHaveBeenCalledTimes(observerCallCount + 1);
    expect(mockRunObserver).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ phase: 'design' }),
      projectId,
      expect.any(String),
    );
  });

  it.each([
    {
      name: 'unsupported phases',
      seed: async (projectId: number) => {
        seedRequirementsReady(projectId);
      },
      phase: 'requirements',
      expectedError: 'Only grounding and elicitation support force-close in this slice',
    },
    {
      name: 'inactive phases',
      seed: async (projectId: number) => {
        seedRequirementsReady(projectId);
      },
      phase: 'design',
      expectedError: 'Only the active phase can be force-closed',
    },
    {
      name: 'design that is not closeable yet',
      seed: async (projectId: number) => {
        seedClosedGrounding(projectId);
      },
      phase: 'design',
      expectedError: 'Phase is not closeable yet',
    },
    {
      name: 'design with a pending proposal',
      seed: async (projectId: number) => {
        const { createPhaseOutcome } = await import('./db.js');
        const { designTurn } = seedActiveDesign(projectId);
        createPhaseOutcome(db, {
          specificationId: projectId,
          phase: 'design',
          proposal_turn_id: designTurn.id,
          summary: 'The main architectural commitments are captured well enough to review requirements.',
        });
      },
      phase: 'design',
      expectedError: 'Confirm the pending closure proposal instead of force-closing',
    },
  ] satisfies Array<{
    name: string;
    seed: (projectId: number) => Promise<void> | void;
    phase: WorkflowPhase;
    expectedError: string;
  }>)('preserves force-close validation errors for $name', async ({ seed, phase, expectedError }) => {
    const projectId = await createTestSpecification();
    await seed(projectId);

    const response = await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u1',
            role: 'user',
            parts: [
              { type: 'text', text: getPhaseClosureCommandText({ kind: 'force-close-active-phase', phase }) },
              {
                type: 'data-confirmation',
                data: { kind: 'force-close-active-phase', phase },
              },
            ],
          },
        ],
      })
      .expect(400);

    expect(response.body).toEqual({ error: expectedError });
  });

  it('rejects a confirm-proposed-phase-closure when the payload phase does not match the outcome phase', async () => {
    const projectId = await createTestSpecification();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makePhaseClosureInterviewer(dbArg as DB, projectId, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'We have enough grounding context' }] },
        ],
      })
      .expect(200);

    const { listPhaseOutcomesForSpecification } = await import('./db.js');
    const outcomes = listPhaseOutcomesForSpecification(db, projectId);
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].phase).toBe('grounding');

    const response = await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u2',
            role: 'user',
            parts: [
              { type: 'text', text: 'Confirm elicitation closure' },
              {
                type: 'data-confirmation',
                data: {
                  kind: 'confirm-proposed-phase-closure',
                  proposalTurnId: outcomes[0].proposal_turn_id,
                  phase: 'design',
                },
              },
            ],
          },
        ],
      })
      .expect(400);

    expect(response.body).toEqual({ error: 'Phase closure confirmation phase mismatch' });
  });
});

describe('GET /api/specifications/:id', () => {
  it('projects kickoff from durable workflow state without creating a kickoff row on read', async () => {
    const { createSpecification, getActivePath } = await import('./db.js');
    const project = createSpecification(db, 'Read-only kickoff projection');

    const res = await request(app).get(`/api/specifications/${project.id}`).expect(200);

    expect(res.body.landing).toEqual({ kind: 'kickoff', phase: 'grounding', mode: 'start' });
    expect(res.body.turns).toEqual([]);
    expect(getActivePath(db, project.id)).toEqual([]);
  });

  it('returns structured question state after a tool-driven turn', async () => {
    const projectId = await createTestSpecification();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makeStructuredQuestionInterviewer(dbArg as DB, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const res = await request(app).get(`/api/specifications/${projectId}`).expect(200);

    expect(res.body.turns).toHaveLength(2);
    expect(res.body.turns[1].question).toBe(structuredQuestion.question);
    expect(res.body.turns[1].options).toHaveLength(2);
    expect(res.body.turns[1].options[0].content).toBe('Web');
  });
});

describe('POST /api/specifications/:id/phase-intent', () => {
  it('persists brownfield mode from landing-only kickoff state without creating a kickoff row first', async () => {
    const { createSpecification, getActivePath, getSpecification } = await import('./db.js');
    const project = createSpecification(db, 'Landing-only kickoff');
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makeStructuredQuestionInterviewer(dbArg as DB, (turn as { id: number }).id),
    );

    expect(getActivePath(db, project.id)).toHaveLength(0);

    await request(app)
      .post(`/api/specifications/${project.id}/phase-intent`)
      .send({ kind: 'phase-entry', phase: 'grounding', mode: 'brownfield' })
      .expect(200, {
        ok: true,
      });

    expect(getSpecification(db, project.id)).toMatchObject({
      mode: 'brownfield',
    });
    expect(getActivePath(db, project.id)).toHaveLength(0);

    await request(app)
      .post(`/api/specifications/${project.id}/chat`)
      .send({
        messages: [
          {
            id: 'u-kickoff-brownfield',
            role: 'user',
            parts: [
              {
                type: 'data-phase-intent',
                data: { kind: 'phase-entry', phase: 'grounding', mode: 'brownfield' },
              },
            ],
          },
        ],
      })
      .expect(200);

    expect(mockStreamInterviewer).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.any(Array),
      'Feature within existing codebase',
      'grounding',
      { mode: 'brownfield', cwd: process.cwd() },
    );

    const activePath = getActivePath(db, project.id);
    expect(activePath).toHaveLength(1);
    expect(activePath.every((turn) => turn.turn_kind === 'question')).toBe(true);
  });

  it('submits a seeded kickoff row through the same phase-entry intent seam', async () => {
    const { createSpecification, getActivePath, getSpecification, getOptionsForTurn } =
      await import('./db.js');
    const { createLegacyKickoffTurnForTesting } = await import('./test-support/legacy-control-rows.js');
    const project = createSpecification(db, 'Seeded kickoff row');
    const kickoffTurn = createLegacyKickoffTurnForTesting(db, project.id);

    expect(kickoffTurn?.turn_kind).toBe('kickoff');

    await request(app)
      .post(`/api/specifications/${project.id}/phase-intent`)
      .send({ kind: 'phase-entry', phase: 'grounding', mode: 'brownfield' })
      .expect(200, {
        ok: true,
      });

    const updatedKickoffTurn = getActivePath(db, project.id)[0]!;
    const selectedOption = getOptionsForTurn(db, updatedKickoffTurn.id).find((option) => option.is_selected);

    expect(getSpecification(db, project.id)).toMatchObject({
      mode: 'brownfield',
    });
    expect(updatedKickoffTurn.answer).toBe('Feature within existing codebase');
    expect(selectedOption?.content).toBe('Feature within existing codebase');
  });

  it('submits recovery through chat without fabricating a recovery row', async () => {
    const { createSpecification, createTurn, getActivePath } = await import('./db.js');
    const { finalizeTurn } = await import('./core.js');
    const project = createSpecification(db, 'Recovery without control row');
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makeStructuredQuestionInterviewer(dbArg as DB, (turn as { id: number }).id),
    );

    const answeredTurn = createTurn(db, project.id, {
      phase: 'grounding',
      question: 'What are we building?',
      answer: 'A chat app',
    });
    finalizeTurn(db, project.id, answeredTurn.id);

    await request(app)
      .post(`/api/specifications/${project.id}/phase-intent`)
      .send({ kind: 'phase-continue', phase: 'grounding' })
      .expect(200, { ok: true });

    await request(app)
      .post(`/api/specifications/${project.id}/chat`)
      .send({
        messages: [
          {
            id: 'u-recovery-continue',
            role: 'user',
            parts: [{ type: 'data-phase-intent', data: { kind: 'phase-continue', phase: 'grounding' } }],
          },
        ],
      })
      .expect(200);

    expect(mockStreamInterviewer).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.any(Array),
      'Continue the grounding phase.',
      'grounding',
      undefined,
    );

    const activePath = getActivePath(db, project.id);
    expect(activePath).toHaveLength(2);
    expect(activePath[0]?.id).toBe(answeredTurn.id);
    expect(activePath.every((turn) => turn.turn_kind === 'question')).toBe(true);
  });

  it('selects the seeded kickoff option by typed intent instead of exact display copy', async () => {
    const { createSpecification, getActivePath, getOptionsForTurn } = await import('./db.js');
    const { createLegacyKickoffTurnForTesting } = await import('./test-support/legacy-control-rows.js');
    const project = createSpecification(db, 'Seeded kickoff copy drift');
    const kickoffTurn = createLegacyKickoffTurnForTesting(db, project.id);

    expect(kickoffTurn?.turn_kind).toBe('kickoff');
    db.$client
      .prepare('update option set content = ? where turn_id = ? and position = ?')
      .run('Legacy brownfield kickoff label', kickoffTurn?.id, 1);

    await request(app)
      .post(`/api/specifications/${project.id}/phase-intent`)
      .send({ kind: 'phase-entry', phase: 'grounding', mode: 'brownfield' })
      .expect(200, {
        ok: true,
      });

    const updatedKickoffTurn = getActivePath(db, project.id)[0]!;
    const brownfieldOption = getOptionsForTurn(db, updatedKickoffTurn.id).find(
      (option) => option.position === 1,
    );

    expect(updatedKickoffTurn.answer).toBe('Feature within existing codebase');
    expect(brownfieldOption).toMatchObject({
      content: 'Legacy brownfield kickoff label',
      is_selected: true,
    });
  });
});

describe('POST /api/specifications/:id/turns/:turnId/response', () => {
  it('persists the selected option and free-text turn response into answer and user parts', async () => {
    const projectId = await createTestSpecification();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makeStructuredQuestionInterviewer(dbArg as DB, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const { getActivePath, getTurn, getOptionsForTurn } = await import('./db.js');
    const turn = getActivePath(db, projectId)[1]!;

    await request(app)
      .post(`/api/specifications/${projectId}/turns/${turn.id}/response`)
      .send({
        kind: 'select-options',
        positions: [1],
        freeText: 'Best fit for our launch',
      })
      .expect(200);

    expect(getOptionsForTurn(db, turn.id)[1].is_selected).toBe(true);
    expect(getTurn(db, turn.id)?.answer).toBe('Desktop — Best fit for our launch');

    const userParts = JSON.parse(getTurn(db, turn.id)?.user_parts ?? '[]');
    expect(userParts).toEqual([
      { type: 'text', text: 'Desktop — Best fit for our launch' },
      {
        type: 'data-turn-response',
        data: {
          turnId: turn.id,
          selectedOptionIds: [getOptionsForTurn(db, turn.id)[1].id],
          freeText: 'Best fit for our launch',
        },
      },
    ]);
  });

  it('persists many selected options and free-text turn responses into answer and user parts', async () => {
    const projectId = await createTestSpecification();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makeStructuredQuestionInterviewer(dbArg as DB, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const { getActivePath, getTurn, getOptionsForTurn } = await import('./db.js');
    const turn = getActivePath(db, projectId)[1]!;

    await request(app)
      .post(`/api/specifications/${projectId}/turns/${turn.id}/response`)
      .send({
        kind: 'select-options',
        positions: [0, 1],
        freeText: 'Covers both launch paths',
      })
      .expect(200);

    const selectedOptions = getOptionsForTurn(db, turn.id).filter((option) => option.is_selected);
    expect(selectedOptions.map((option) => option.content)).toEqual(['Web', 'Desktop']);
    expect(getTurn(db, turn.id)?.answer).toBe('Web, Desktop — Covers both launch paths');

    const userParts = JSON.parse(getTurn(db, turn.id)?.user_parts ?? '[]');
    expect(userParts).toEqual([
      { type: 'text', text: 'Web, Desktop — Covers both launch paths' },
      {
        type: 'data-turn-response',
        data: {
          turnId: turn.id,
          selectedOptionIds: selectedOptions.map((option) => option.id),
          freeText: 'Covers both launch paths',
        },
      },
    ]);
  });

  it('reuses an already-answered active turn instead of creating a duplicate answered turn', async () => {
    const projectId = await createTestSpecification();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makeStructuredQuestionInterviewer(dbArg as DB, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const { getActivePath, getTurn, getOptionsForTurn } = await import('./db.js');
    const turn = getActivePath(db, projectId)[1]!;

    await request(app)
      .post(`/api/specifications/${projectId}/turns/${turn.id}/response`)
      .send({
        kind: 'select-options',
        positions: [0, 1],
        freeText: 'Covers both launch paths',
      })
      .expect(200);

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u2',
            role: 'user',
            parts: [{ type: 'text', text: 'Web, Desktop — Covers both launch paths' }],
          },
        ],
      })
      .expect(200);

    const turns = getActivePath(db, projectId);
    expect(turns).toHaveLength(3);
    expect(turns[1]).toMatchObject({
      id: turn.id,
      answer: 'Web, Desktop — Covers both launch paths',
    });
    expect(getOptionsForTurn(db, turn.id).filter((option) => option.is_selected)).toHaveLength(2);
    expect(getTurn(db, turn.id)?.user_parts).toContain('Covers both launch paths');
    expect(turns[2]).toMatchObject({
      parent_turn_id: turn.id,
      answer: null,
      question: structuredQuestion.question,
    });
  });

  it('skips observer capture for answered preface turns while still advancing to the next interviewer turn', async () => {
    const projectId = await createTestSpecification();
    const { advanceHead, createOption, createTurn, getActivePath } = await import('./db.js');
    const groundingTurn = createTurn(db, projectId, {
      phase: 'grounding',
      question: '',
      answer: null,
      assistant_parts: JSON.stringify([
        {
          type: 'data-preface',
          data: {
            observation: 'The repo already uses SQLite-backed local persistence.',
            elaboration: 'This is provisional context before the first substantive question.',
            continueLabel: 'Continue',
          },
        },
      ]),
    });
    createOption(db, groundingTurn.id, {
      position: 0,
      content: 'Continue',
      is_recommended: true,
    });
    advanceHead(db, projectId, groundingTurn.id);

    await request(app)
      .post(`/api/specifications/${projectId}/turns/${groundingTurn.id}/response`)
      .send({
        kind: 'select-options',
        positions: [0],
        freeText: 'Focus on the routed interview workspace.',
      })
      .expect(200);

    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makeStructuredQuestionInterviewer(dbArg as DB, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u-grounding-continue',
            role: 'user',
            parts: [{ type: 'text', text: 'Continue — Focus on the routed interview workspace.' }],
          },
        ],
      })
      .expect(200);

    expect(mockRunObserver).not.toHaveBeenCalled();
    expect(getActivePath(db, projectId).at(-1)).toMatchObject({
      phase: 'grounding',
      question: structuredQuestion.question,
    });
  });

  it('persists interviewer-owned requirement review metadata on runtime review turns and accepts from it', async () => {
    const projectId = await createTestSpecification();
    seedRequirementsReady(projectId);
    const { updateTurn } = await import('./db.js');

    const runtimeRequirementReview = createRuntimeReviewQuestion({
      phase: 'requirements',
      title: 'Requirements',
      question: 'Please review the current requirement set.',
      why: 'The first review turn should carry its own durable review metadata.',
      items: [
        {
          reviewItemId: 'requirements:1',
          content: 'Export the reviewed specification as markdown',
          rationale: 'Keeps the accepted review output portable for sharing.',
          referenceCode: createKnowledgeReferenceCode('requirement', 1),
        },
        {
          reviewItemId: 'requirements:2',
          content: 'Resume the interview from persisted local state',
          rationale: 'Lets users continue after a restart.',
          referenceCode: createKnowledgeReferenceCode('requirement', 2),
        },
      ],
    });

    const requirementSeedState = await getSpecificationSnapshot(projectId);
    const requirementSeedTurnId = requirementSeedState.turns.at(-1)?.id;
    updateTurn(db, requirementSeedTurnId!, {
      assistant_parts: JSON.stringify([
        {
          type: 'data-observer-result',
          data: {
            turnId: requirementSeedTurnId,
            entityIds: {
              goals: [],
              terms: [],
              contexts: [],
              constraints: [],
              requirements: [],
              criteria: [],
              decisions: [],
              assumptions: [],
            },
          },
        },
      ]),
    });

    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makeStructuredQuestionInterviewer(dbArg as DB, (turn as { id: number }).id, runtimeRequirementReview),
    );

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u-runtime-requirements',
            role: 'user',
            parts: [{ type: 'text', text: 'Review the current requirement set' }],
          },
        ],
      })
      .expect(200);

    const projectRes = await request(app).get(`/api/specifications/${projectId}`).expect(200);
    const reviewTurn = projectRes.body.turns.find(
      (turn: { phase: string; question: string }) =>
        turn.phase === 'requirements' && turn.question === runtimeRequirementReview.question,
    );
    expect(reviewTurn).toBeDefined();
    const assistantParts = JSON.parse(reviewTurn.assistant_parts ?? '[]');
    expect(assistantParts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'tool-ask_question',
          input: expect.objectContaining({
            reviewActions: runtimeRequirementReview.reviewActions,
            reviewSet: runtimeRequirementReview.reviewSet,
          }),
        }),
        {
          type: 'data-review-set',
          data: runtimeRequirementReview.reviewSet,
        },
      ]),
    );
    expect(JSON.stringify(assistantParts)).not.toContain(
      'Fallback requirement inventory should not become the persisted review set',
    );

    await request(app)
      .post(`/api/specifications/${projectId}/turns/${reviewTurn.id}/response`)
      .send({ kind: 'select-options', positions: [0], reviewAction: 'accept' })
      .expect(200, { ok: true, advancedToPhase: 'criteria' });

    const entitiesRes = await request(app)
      .get(`/api/specifications/${projectId}/entities?mode=project-wide`)
      .expect(200);
    expect(entitiesRes.body.requirements).toEqual(
      expect.arrayContaining(
        runtimeRequirementReview.reviewSet!.items.map((item) =>
          expect.objectContaining({ content: item.content }),
        ),
      ),
    );
    expect(
      entitiesRes.body.requirements.some(
        (requirement: { content: string }) =>
          requirement.content === 'Fallback requirement inventory should not become the persisted review set',
      ),
    ).toBe(false);
  });

  it('accepting the requirements full-set review uses explicit reviewAction instead of option copy', async () => {
    const projectId = await createTestSpecification();
    const seededRequirements = seedRequirementsReady(projectId);
    const { advanceHead, createKnowledgeItem, createOption, createTurn, getTurn } = await import('./db.js');

    const requirementOne = createKnowledgeItem(
      db,
      projectId,
      'requirement',
      'Export the reviewed specification as markdown',
    );
    const requirementTwo = createKnowledgeItem(
      db,
      projectId,
      'requirement',
      'Resume the interview from persisted local state',
    );

    const reviewItems = [
      { reviewItemId: 'requirements:1', content: 'Export the reviewed specification as markdown' },
      { reviewItemId: 'requirements:2', content: 'Resume the interview from persisted local state' },
    ];

    const reviewTurn = createTurn(db, projectId, {
      phase: 'requirements',
      parent_turn_id: seededRequirements.designConfirmationTurn.id,
      question: 'Please review the current requirement set.',
      why: 'Review the whole requirement set before moving forward.',
      impact: 'high',
      answer: '',
      assistant_parts: JSON.stringify([
        {
          type: 'tool-ask_question',
          toolCallId: 'tool-requirements-review',
          state: 'output-available',
          input: {
            question: 'Please review the current requirement set.',
            why: 'Review the whole requirement set before moving forward.',
            impact: 'high',
            options: [
              { content: 'Ship this set', is_recommended: true },
              { content: 'Revise this set', is_recommended: false },
            ],
            reviewActions: [
              { action: 'accept', optionPosition: 0 },
              { action: 'request-changes', optionPosition: 1 },
            ],
            reviewSet: { phase: 'requirements', title: 'Requirements', items: reviewItems },
          },
          output: { ok: true, turnId: 0, optionCount: 2 },
        },
        {
          type: 'data-review-set',
          data: { phase: 'requirements', title: 'Requirements', items: reviewItems },
        },
      ]),
    });
    createOption(db, reviewTurn.id, {
      position: 0,
      content: 'Ship this set',
      is_recommended: true,
    });
    createOption(db, reviewTurn.id, {
      position: 1,
      content: 'Revise this set',
      is_recommended: false,
    });
    advanceHead(db, projectId, reviewTurn.id);

    const response = await request(app)
      .post(`/api/specifications/${projectId}/turns/${reviewTurn.id}/response`)
      .send({ kind: 'select-options', positions: [0], reviewAction: 'accept' })
      .expect(200);

    expect(response.body).toEqual({ ok: true, advancedToPhase: 'criteria' });

    const projectRes = await request(app).get(`/api/specifications/${projectId}`).expect(200);
    expect(projectRes.body.workflow.phases.requirements).toEqual(
      expect.objectContaining({
        status: 'closed',
        closureBasis: 'interviewer_recommended',
        proposalPending: false,
        turnId: reviewTurn.id,
        summary: 'The reviewed requirement set is accepted and ready for acceptance criteria.',
      }),
    );
    expect(projectRes.body.workflow.phases.criteria).toEqual(
      expect.objectContaining({
        status: 'in_progress',
        proposalPending: false,
      }),
    );
    expect(projectRes.body.specification.active_turn_id).toBe(reviewTurn.id);
    expect(projectRes.body.landing).toEqual({ kind: 'kickoff', phase: 'criteria', mode: 'start' });
    expect(projectRes.body.turns.at(-1)).toEqual(
      expect.objectContaining({
        id: reviewTurn.id,
        phase: 'requirements',
      }),
    );

    const entitiesRes = await request(app)
      .get(`/api/specifications/${projectId}/entities?mode=project-wide`)
      .expect(200);
    expect(entitiesRes.body.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: requirementOne.id }),
        expect.objectContaining({ id: requirementTwo.id }),
      ]),
    );
    for (const requirement of entitiesRes.body.requirements) {
      expect(requirement).not.toHaveProperty('reviewStatus');
    }

    expect(JSON.parse(getTurn(db, reviewTurn.id)?.user_parts ?? '[]')).toEqual([
      { type: 'text', text: 'Ship this set' },
      {
        type: 'data-turn-response',
        data: {
          turnId: reviewTurn.id,
          selectedOptionIds: expect.any(Array),
          reviewAction: 'accept',
        },
      },
    ]);
  });
  it('enforces explicit reviewAction semantics even when review options are reordered', async () => {
    const projectId = await createTestSpecification();
    const seededRequirements = seedRequirementsReady(projectId);
    const { advanceHead, createOption, createTurn } = await import('./db.js');

    const reviewItems = [{ reviewItemId: 'requirements:1', content: 'A requirement to accept' }];

    const reviewTurn = createTurn(db, projectId, {
      phase: 'requirements',
      parent_turn_id: seededRequirements.designConfirmationTurn.id,
      question: 'Please review the current requirement set.',
      why: 'The reordered labels should not change the submitted review action semantics.',
      impact: 'high',
      answer: '',
      assistant_parts: JSON.stringify([
        {
          type: 'tool-ask_question',
          toolCallId: 'tool-reordered-requirements-review',
          state: 'output-available',
          input: {
            question: 'Please review the current requirement set.',
            why: 'The reordered labels should not change the submitted review action semantics.',
            impact: 'high',
            options: [
              { content: 'Revise this set', is_recommended: false },
              { content: 'Ship this set', is_recommended: true },
            ],
            reviewActions: [
              { action: 'request-changes', optionPosition: 0 },
              { action: 'accept', optionPosition: 1 },
            ],
            reviewSet: { phase: 'requirements', title: 'Requirements', items: reviewItems },
          },
          output: { ok: true, turnId: 0, optionCount: 2 },
        },
        {
          type: 'data-review-set',
          data: { phase: 'requirements', title: 'Requirements', items: reviewItems },
        },
      ]),
    });
    createOption(db, reviewTurn.id, {
      position: 0,
      content: 'Revise this set',
      is_recommended: false,
    });
    createOption(db, reviewTurn.id, {
      position: 1,
      content: 'Ship this set',
      is_recommended: true,
    });
    advanceHead(db, projectId, reviewTurn.id);

    await request(app)
      .post(`/api/specifications/${projectId}/turns/${reviewTurn.id}/response`)
      .send({ kind: 'select-options', positions: [1], reviewAction: 'request-changes' })
      .expect(400, {
        error: 'Review turns must submit the explicit reviewAction for the selected option',
      });

    const response = await request(app)
      .post(`/api/specifications/${projectId}/turns/${reviewTurn.id}/response`)
      .send({ kind: 'select-options', positions: [1], reviewAction: 'accept' })
      .expect(200);

    expect(response.body).toEqual({ ok: true, advancedToPhase: 'criteria' });
  });

  it('accepting the requirements review materializes only the persisted review-set items onto the active path', async () => {
    const projectId = await createTestSpecification();
    const seededRequirements = seedRequirementsReady(projectId);
    const { advanceHead, createKnowledgeItem, createOption, createTurn } = await import('./db.js');

    const acceptedExistingRequirement = createKnowledgeItem(
      db,
      projectId,
      'requirement',
      'Export the reviewed specification as markdown',
      {
        rationale: 'Keeps the accepted review output portable for sharing.',
      },
    );
    createKnowledgeItem(db, projectId, 'requirement', 'Support exporting the spec as a PDF');

    const reviewTurn = createTurn(db, projectId, {
      phase: 'requirements',
      parent_turn_id: seededRequirements.designConfirmationTurn.id,
      question: 'Please review the current requirement set.',
      why: 'Review the whole requirement set before moving forward.',
      impact: 'high',
      answer: '',
      assistant_parts: createReviewSetAssistantParts({
        phase: 'requirements',
        title: 'Requirements',
        question: 'Please review the current requirement set.',
        why: 'Review the whole requirement set before moving forward.',
        items: [
          {
            reviewItemId: 'requirements:1',
            referenceCode: createKnowledgeReferenceCode('requirement', 1),
            content: 'Export the reviewed specification as markdown',
            rationale: 'Keeps the accepted review output portable for sharing.',
          },
          {
            reviewItemId: 'requirements:2',
            referenceCode: createKnowledgeReferenceCode('requirement', 2),
            content: 'Resume the interview from persisted local state',
            rationale: 'Users should be able to continue after a restart.',
          },
        ],
      }),
    });
    createOption(db, reviewTurn.id, {
      position: 0,
      content: 'Accept review',
      is_recommended: true,
    });
    createOption(db, reviewTurn.id, {
      position: 1,
      content: 'Request changes',
      is_recommended: false,
    });
    advanceHead(db, projectId, reviewTurn.id);

    await request(app)
      .post(`/api/specifications/${projectId}/turns/${reviewTurn.id}/response`)
      .send({ kind: 'select-options', positions: [0], reviewAction: 'accept' })
      .expect(200);

    const activePathEntitiesRes = await request(app)
      .get(`/api/specifications/${projectId}/entities`)
      .expect(200);
    expect(activePathEntitiesRes.body.requirements).toEqual([
      expect.objectContaining({ id: acceptedExistingRequirement.id }),
      expect.objectContaining({ content: 'Resume the interview from persisted local state' }),
    ]);

    const projectWideEntitiesRes = await request(app)
      .get(`/api/specifications/${projectId}/entities?mode=project-wide`)
      .expect(200);
    expect(
      projectWideEntitiesRes.body.requirements.filter(
        (requirement: { content: string }) =>
          requirement.content === 'Export the reviewed specification as markdown',
      ),
    ).toHaveLength(1);
    expect(
      projectWideEntitiesRes.body.requirements.map((requirement: { content: string }) => requirement.content),
    ).toEqual(
      expect.arrayContaining([
        'Export the reviewed specification as markdown',
        'Resume the interview from persisted local state',
        'Support exporting the spec as a PDF',
      ]),
    );
  });

  it('accepting a regenerated requirements review preserves predecessor rationale on sparse successor items', async () => {
    const projectId = await createTestSpecification();
    const seededRequirements = seedRequirementsReady(projectId);
    const {
      advanceHead,
      applyTurnResponseSelections,
      createKnowledgeItem,
      createOption,
      createTurn,
      updateTurn,
    } = await import('./db.js');

    createKnowledgeItem(
      db,
      projectId,
      'requirement',
      'Fallback project-wide requirement that should stay out of the accepted set',
    );

    const predecessorReviewTurn = createTurn(db, projectId, {
      phase: 'requirements',
      parent_turn_id: seededRequirements.designConfirmationTurn.id,
      question: 'Please review the current requirement set.',
      why: 'Carry forward metadata from the previous reviewed set when revisions stay sparse.',
      impact: 'high',
      answer: 'Request changes',
      assistant_parts: createReviewSetAssistantParts({
        phase: 'requirements',
        title: 'Requirements',
        question: 'Please review the current requirement set.',
        why: 'Carry forward metadata from the previous reviewed set when revisions stay sparse.',
        items: [
          {
            reviewItemId: 'requirements:1',
            referenceCode: createKnowledgeReferenceCode('requirement', 1),
            content: 'Export the reviewed specification as markdown',
            rationale: 'Keeps the accepted review output portable for sharing.',
          },
          {
            reviewItemId: 'requirements:2',
            referenceCode: createKnowledgeReferenceCode('requirement', 2),
            content: 'Resume the interview from persisted local state',
            rationale: 'Users should be able to continue after a restart.',
          },
        ],
      }),
    });
    createOption(db, predecessorReviewTurn.id, {
      position: 0,
      content: 'Accept review',
      is_recommended: true,
    });
    const predecessorRequestChangesOption = createOption(db, predecessorReviewTurn.id, {
      position: 1,
      content: 'Request changes',
      is_recommended: false,
    });
    applyTurnResponseSelections(db, predecessorReviewTurn.id, [1]);
    updateTurn(db, predecessorReviewTurn.id, {
      user_parts: JSON.stringify([
        {
          type: 'data-turn-response',
          data: {
            turnId: predecessorReviewTurn.id,
            selectedOptionIds: [predecessorRequestChangesOption.id],
            reviewAction: 'request-changes',
            freeText: 'Keep the export requirement, but tighten the rest of the set.',
          },
        },
      ]),
    });

    const successorReviewTurn = createTurn(db, projectId, {
      phase: 'requirements',
      parent_turn_id: predecessorReviewTurn.id,
      question: 'Please review the revised requirement set.',
      why: 'The persisted successor set should stay authoritative even when it omits unchanged metadata.',
      impact: 'high',
      answer: '',
      assistant_parts: createReviewSetAssistantParts({
        phase: 'requirements',
        title: 'Requirements',
        question: 'Please review the revised requirement set.',
        why: 'The persisted successor set should stay authoritative even when it omits unchanged metadata.',
        items: [
          {
            reviewItemId: 'requirements:1',
            content: 'Export the reviewed specification as markdown',
          },
          {
            reviewItemId: 'requirements:3',
            content: 'Keep accepted review output scoped to the persisted review set only',
            rationale: 'Prevents stale project-wide inventory from leaking into the accepted path.',
          },
        ],
      }),
    });
    createOption(db, successorReviewTurn.id, {
      position: 0,
      content: 'Accept review',
      is_recommended: true,
    });
    createOption(db, successorReviewTurn.id, {
      position: 1,
      content: 'Request changes',
      is_recommended: false,
    });
    advanceHead(db, projectId, successorReviewTurn.id);

    await request(app)
      .post(`/api/specifications/${projectId}/turns/${successorReviewTurn.id}/response`)
      .send({ kind: 'select-options', positions: [0], reviewAction: 'accept' })
      .expect(200);

    const entitiesRes = await request(app).get(`/api/specifications/${projectId}/entities`).expect(200);
    expect(entitiesRes.body.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: 'Export the reviewed specification as markdown',
          rationale: 'Keeps the accepted review output portable for sharing.',
        }),
        expect.objectContaining({
          content: 'Keep accepted review output scoped to the persisted review set only',
          rationale: 'Prevents stale project-wide inventory from leaking into the accepted path.',
        }),
      ]),
    );
    expect(entitiesRes.body.requirements).toHaveLength(2);
    expect(
      entitiesRes.body.requirements.map((requirement: { content: string }) => requirement.content),
    ).not.toContain('Fallback project-wide requirement that should stay out of the accepted set');
  });

  it('requesting changes on the requirements full-set review keeps requirements open and does not advance to criteria', async () => {
    const projectId = await createTestSpecification();
    const seededRequirements = seedRequirementsReady(projectId);
    const { advanceHead, createKnowledgeItem, createOption, createTurn } = await import('./db.js');

    const requirement = createKnowledgeItem(
      db,
      projectId,
      'requirement',
      'Export the reviewed specification as markdown',
    );

    const reviewTurn = createTurn(db, projectId, {
      phase: 'requirements',
      parent_turn_id: seededRequirements.designConfirmationTurn.id,
      question: 'Please review the current requirement set.',
      why: 'Review the whole requirement set before moving forward.',
      impact: 'high',
      answer: '',
      assistant_parts: JSON.stringify([
        {
          type: 'tool-ask_question',
          toolCallId: 'tool-requirements-review',
          state: 'output-available',
          input: {
            question: 'Please review the current requirement set.',
            why: 'Review the whole requirement set before moving forward.',
            impact: 'high',
            options: [
              { content: 'Ship this set', is_recommended: true },
              { content: 'Revise this set', is_recommended: false },
            ],
            reviewActions: [
              { action: 'accept', optionPosition: 0 },
              { action: 'request-changes', optionPosition: 1 },
            ],
          },
          output: { ok: true, turnId: 0, optionCount: 2 },
        },
      ]),
    });
    createOption(db, reviewTurn.id, {
      position: 0,
      content: 'Ship this set',
      is_recommended: true,
    });
    createOption(db, reviewTurn.id, {
      position: 1,
      content: 'Revise this set',
      is_recommended: false,
    });
    advanceHead(db, projectId, reviewTurn.id);

    const response = await request(app)
      .post(`/api/specifications/${projectId}/turns/${reviewTurn.id}/response`)
      .send({
        kind: 'select-options',
        positions: [1],
        freeText: 'Add export rationale notes.',
        reviewAction: 'request-changes',
      })
      .expect(200);

    expect(response.body).toEqual({ ok: true });

    const projectRes = await request(app).get(`/api/specifications/${projectId}`).expect(200);
    expect(projectRes.body.workflow.phases.requirements).toEqual(
      expect.objectContaining({
        status: 'in_progress',
        proposalPending: false,
      }),
    );
    expect(projectRes.body.workflow.phases.criteria).toEqual(
      expect.objectContaining({
        status: 'unstarted',
        proposalPending: false,
      }),
    );
    expect(projectRes.body.specification.active_turn_id).toBe(projectRes.body.turns.at(-1).id);
    expect(projectRes.body.turns.at(-1)).toEqual(
      expect.objectContaining({
        phase: 'requirements',
      }),
    );

    const entitiesRes = await request(app)
      .get(`/api/specifications/${projectId}/entities?mode=project-wide`)
      .expect(200);
    expect(entitiesRes.body.requirements).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: requirement.id })]),
    );
    for (const candidateRequirement of entitiesRes.body.requirements) {
      expect(candidateRequirement).not.toHaveProperty('reviewStatus');
    }
  });

  it('rejects requirements review submissions that omit the explicit reviewAction', async () => {
    const projectId = await createTestSpecification();
    const seededRequirements = seedRequirementsReady(projectId);
    const { advanceHead, createOption, createTurn, updateTurn } = await import('./db.js');

    const reviewInput = {
      question: 'Please review the current requirement set.',
      why: 'Review turns must persist explicit accept/request-changes semantics.',
      impact: 'high' as const,
      options: [
        { content: 'Accept review', is_recommended: true },
        { content: 'Request changes', is_recommended: false },
      ],
      reviewActions: [
        { action: 'accept' as const, optionPosition: 0 },
        { action: 'request-changes' as const, optionPosition: 1 },
      ],
    };

    const reviewTurn = createTurn(db, projectId, {
      phase: 'requirements',
      parent_turn_id: seededRequirements.designConfirmationTurn.id,
      question: reviewInput.question,
      why: reviewInput.why,
      impact: reviewInput.impact,
      answer: '',
    });
    createOption(db, reviewTurn.id, {
      position: 0,
      content: 'Reject this requirement',
      is_recommended: true,
    });
    createOption(db, reviewTurn.id, {
      position: 1,
      content: 'Keep this requirement for now',
      is_recommended: false,
    });
    updateTurn(db, reviewTurn.id, {
      assistant_parts: JSON.stringify([
        {
          type: 'tool-ask_question',
          toolCallId: 'tool-review-reject',
          state: 'output-available',
          input: reviewInput,
          output: { ok: true, turnId: reviewTurn.id, optionCount: reviewInput.options.length },
        },
      ]),
    });
    advanceHead(db, projectId, reviewTurn.id);

    await request(app)
      .post(`/api/specifications/${projectId}/turns/${reviewTurn.id}/response`)
      .send({ kind: 'select-options', positions: [0] })
      .expect(400);
  });

  it('persists interviewer-owned criteria review metadata on runtime review turns and accepts from it', async () => {
    const projectId = await createTestSpecification();
    seedCriteriaReady(projectId);
    const { updateTurn } = await import('./db.js');

    const runtimeCriteriaReview = createRuntimeReviewQuestion({
      phase: 'criteria',
      title: 'Acceptance Criteria',
      question: 'Please review the current criterion set.',
      why: 'The first criteria review turn should carry its own durable review metadata.',
      items: [
        {
          reviewItemId: 'criteria:1',
          content: 'Restarting restores the active path',
          rationale: 'Proves the persisted branch resumes cleanly.',
          referenceCode: createKnowledgeReferenceCode('criterion', 1),
        },
        {
          reviewItemId: 'criteria:2',
          content: 'Markdown export includes accepted requirements only',
          rationale: 'Checks the final handoff stays scoped to accepted output.',
          referenceCode: createKnowledgeReferenceCode('criterion', 2),
        },
      ],
    });

    const criterionSeedState = await getSpecificationSnapshot(projectId);
    const criterionSeedTurnId = criterionSeedState.turns.at(-1)?.id;
    updateTurn(db, criterionSeedTurnId!, {
      assistant_parts: JSON.stringify([
        {
          type: 'data-observer-result',
          data: {
            turnId: criterionSeedTurnId,
            entityIds: {
              goals: [],
              terms: [],
              contexts: [],
              constraints: [],
              requirements: [],
              criteria: [],
              decisions: [],
              assumptions: [],
            },
          },
        },
      ]),
    });

    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makeStructuredQuestionInterviewer(dbArg as DB, (turn as { id: number }).id, runtimeCriteriaReview),
    );

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u-runtime-criteria',
            role: 'user',
            parts: [{ type: 'text', text: 'Review the current criterion set' }],
          },
        ],
      })
      .expect(200);

    const projectRes = await request(app).get(`/api/specifications/${projectId}`).expect(200);
    const reviewTurn = projectRes.body.turns.find(
      (turn: { phase: string; question: string }) =>
        turn.phase === 'criteria' && turn.question === runtimeCriteriaReview.question,
    );
    expect(reviewTurn).toBeDefined();
    const assistantParts = JSON.parse(reviewTurn.assistant_parts ?? '[]');
    expect(assistantParts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'tool-ask_question',
          input: expect.objectContaining({
            reviewActions: runtimeCriteriaReview.reviewActions,
            reviewSet: runtimeCriteriaReview.reviewSet,
          }),
        }),
        {
          type: 'data-review-set',
          data: runtimeCriteriaReview.reviewSet,
        },
      ]),
    );
    expect(JSON.stringify(assistantParts)).not.toContain(
      'Fallback criteria inventory should not become the persisted review set',
    );

    await request(app)
      .post(`/api/specifications/${projectId}/turns/${reviewTurn.id}/response`)
      .send({ kind: 'select-options', positions: [0], reviewAction: 'accept' })
      .expect(200, { ok: true, workflowCompleted: true });

    const entitiesRes = await request(app)
      .get(`/api/specifications/${projectId}/entities?mode=project-wide`)
      .expect(200);
    expect(entitiesRes.body.criteria).toEqual(
      expect.arrayContaining(
        runtimeCriteriaReview.reviewSet!.items.map((item) =>
          expect.objectContaining({ content: item.content }),
        ),
      ),
    );
    expect(
      entitiesRes.body.criteria.some(
        (criterion: { content: string }) =>
          criterion.content === 'Fallback criteria inventory should not become the persisted review set',
      ),
    ).toBe(false);
  });

  it('accepting the criteria full-set review uses explicit reviewAction instead of option copy', async () => {
    const projectId = await createTestSpecification();
    const seededCriteria = seedCriteriaReady(projectId);
    const { advanceHead, createKnowledgeItem, createOption, createTurn } = await import('./db.js');

    const criterionOne = createKnowledgeItem(
      db,
      projectId,
      'criterion',
      'Restarting restores the active path',
    );
    const criterionTwo = createKnowledgeItem(
      db,
      projectId,
      'criterion',
      'Markdown export includes accepted requirements only',
    );

    const reviewItems = [
      { reviewItemId: 'criteria:1', content: 'Restarting restores the active path' },
      { reviewItemId: 'criteria:2', content: 'Markdown export includes accepted requirements only' },
    ];

    const reviewTurn = createTurn(db, projectId, {
      phase: 'criteria',
      parent_turn_id: seededCriteria.requirementsConfirmationTurn.id,
      question: 'Please review the current criterion set.',
      why: 'Review the whole criterion set before moving forward.',
      impact: 'high',
      answer: '',
      assistant_parts: JSON.stringify([
        {
          type: 'tool-ask_question',
          toolCallId: 'tool-criteria-review',
          state: 'output-available',
          input: {
            question: 'Please review the current criterion set.',
            why: 'Review the whole criterion set before moving forward.',
            impact: 'high',
            options: [
              { content: 'Ship this set', is_recommended: true },
              { content: 'Revise this set', is_recommended: false },
            ],
            reviewActions: [
              { action: 'accept', optionPosition: 0 },
              { action: 'request-changes', optionPosition: 1 },
            ],
            reviewSet: { phase: 'criteria', title: 'Acceptance Criteria', items: reviewItems },
          },
          output: { ok: true, turnId: 0, optionCount: 2 },
        },
        {
          type: 'data-review-set',
          data: { phase: 'criteria', title: 'Acceptance Criteria', items: reviewItems },
        },
      ]),
    });
    createOption(db, reviewTurn.id, {
      position: 0,
      content: 'Ship this set',
      is_recommended: true,
    });
    createOption(db, reviewTurn.id, {
      position: 1,
      content: 'Revise this set',
      is_recommended: false,
    });
    advanceHead(db, projectId, reviewTurn.id);

    const response = await request(app)
      .post(`/api/specifications/${projectId}/turns/${reviewTurn.id}/response`)
      .send({ kind: 'select-options', positions: [0], reviewAction: 'accept' })
      .expect(200);

    expect(response.body).toEqual({ ok: true, workflowCompleted: true });

    const projectRes = await request(app).get(`/api/specifications/${projectId}`).expect(200);
    for (const phase of ['grounding', 'design', 'requirements', 'criteria'] as const) {
      expect(projectRes.body.workflow.phases[phase]).toEqual(
        expect.objectContaining({
          status: 'closed',
        }),
      );
    }
    expect(projectRes.body.workflow.phases.criteria).toEqual(
      expect.objectContaining({
        closureBasis: 'interviewer_recommended',
        proposalPending: false,
        turnId: reviewTurn.id,
        summary: 'The reviewed criteria set is accepted and the specification is ready for output.',
      }),
    );
    expect(projectRes.body.specification.active_turn_id).toBe(reviewTurn.id);

    const entitiesRes = await request(app)
      .get(`/api/specifications/${projectId}/entities?mode=project-wide`)
      .expect(200);
    expect(entitiesRes.body.criteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: criterionOne.id }),
        expect.objectContaining({ id: criterionTwo.id }),
      ]),
    );
    for (const criterion of entitiesRes.body.criteria) {
      expect(criterion).not.toHaveProperty('reviewStatus');
    }

    const exportRes = await request(app).get(`/api/specifications/${projectId}/export`).expect(200);
    expect(exportRes.body.ready).toBe(true);
  });

  it('accepting the criteria review materializes only the persisted review-set items onto the active path', async () => {
    const projectId = await createTestSpecification();
    const seededCriteria = seedCriteriaReady(projectId);
    const { advanceHead, createKnowledgeItem, createOption, createTurn } = await import('./db.js');

    const acceptedExistingCriterion = createKnowledgeItem(
      db,
      projectId,
      'criterion',
      'Restarting restores the active path',
      {
        rationale: 'Proves the persisted branch resumes cleanly.',
      },
    );
    createKnowledgeItem(db, projectId, 'criterion', 'PDF export renders the reviewed requirements');

    const reviewTurn = createTurn(db, projectId, {
      phase: 'criteria',
      parent_turn_id: seededCriteria.requirementsConfirmationTurn.id,
      question: 'Please review the current criterion set.',
      why: 'Review the whole criterion set before moving forward.',
      impact: 'high',
      answer: '',
      assistant_parts: createReviewSetAssistantParts({
        phase: 'criteria',
        title: 'Acceptance Criteria',
        question: 'Please review the current criterion set.',
        why: 'Review the whole criterion set before moving forward.',
        items: [
          {
            reviewItemId: 'criteria:1',
            referenceCode: createKnowledgeReferenceCode('criterion', 1),
            content: 'Restarting restores the active path',
            rationale: 'Proves the persisted branch resumes cleanly.',
          },
          {
            reviewItemId: 'criteria:2',
            referenceCode: createKnowledgeReferenceCode('criterion', 2),
            content: 'Markdown export includes accepted requirements only',
            rationale: 'Checks the final handoff stays scoped to accepted output.',
          },
        ],
      }),
    });
    createOption(db, reviewTurn.id, {
      position: 0,
      content: 'Accept review',
      is_recommended: true,
    });
    createOption(db, reviewTurn.id, {
      position: 1,
      content: 'Request changes',
      is_recommended: false,
    });
    advanceHead(db, projectId, reviewTurn.id);

    await request(app)
      .post(`/api/specifications/${projectId}/turns/${reviewTurn.id}/response`)
      .send({ kind: 'select-options', positions: [0], reviewAction: 'accept' })
      .expect(200);

    const activePathEntitiesRes = await request(app)
      .get(`/api/specifications/${projectId}/entities`)
      .expect(200);
    expect(activePathEntitiesRes.body.criteria).toEqual([
      expect.objectContaining({ id: acceptedExistingCriterion.id }),
      expect.objectContaining({ content: 'Markdown export includes accepted requirements only' }),
    ]);

    const projectWideEntitiesRes = await request(app)
      .get(`/api/specifications/${projectId}/entities?mode=project-wide`)
      .expect(200);
    expect(
      projectWideEntitiesRes.body.criteria.filter(
        (criterion: { content: string }) => criterion.content === 'Restarting restores the active path',
      ),
    ).toHaveLength(1);
    expect(
      projectWideEntitiesRes.body.criteria.map((criterion: { content: string }) => criterion.content),
    ).toEqual(
      expect.arrayContaining([
        'Restarting restores the active path',
        'Markdown export includes accepted requirements only',
        'PDF export renders the reviewed requirements',
      ]),
    );
  });

  it('accepting a regenerated criteria review preserves predecessor rationale on sparse successor items', async () => {
    const projectId = await createTestSpecification();
    const seededCriteria = seedCriteriaReady(projectId);
    const {
      advanceHead,
      applyTurnResponseSelections,
      createKnowledgeItem,
      createOption,
      createTurn,
      updateTurn,
    } = await import('./db.js');

    createKnowledgeItem(
      db,
      projectId,
      'criterion',
      'Fallback project-wide criterion that should stay out of the accepted set',
    );

    const predecessorReviewTurn = createTurn(db, projectId, {
      phase: 'criteria',
      parent_turn_id: seededCriteria.requirementsConfirmationTurn.id,
      question: 'Please review the current criterion set.',
      why: 'Carry forward metadata from the previous reviewed set when revisions stay sparse.',
      impact: 'high',
      answer: 'Request changes',
      assistant_parts: createReviewSetAssistantParts({
        phase: 'criteria',
        title: 'Acceptance Criteria',
        question: 'Please review the current criterion set.',
        why: 'Carry forward metadata from the previous reviewed set when revisions stay sparse.',
        items: [
          {
            reviewItemId: 'criteria:1',
            referenceCode: createKnowledgeReferenceCode('criterion', 1),
            content: 'Restarting restores the active path',
            rationale: 'Proves the persisted branch resumes cleanly.',
          },
          {
            reviewItemId: 'criteria:2',
            referenceCode: createKnowledgeReferenceCode('criterion', 2),
            content: 'Markdown export includes accepted requirements only',
            rationale: 'Checks the final handoff stays scoped to accepted output.',
          },
        ],
      }),
    });
    createOption(db, predecessorReviewTurn.id, {
      position: 0,
      content: 'Accept review',
      is_recommended: true,
    });
    const predecessorRequestChangesOption = createOption(db, predecessorReviewTurn.id, {
      position: 1,
      content: 'Request changes',
      is_recommended: false,
    });
    applyTurnResponseSelections(db, predecessorReviewTurn.id, [1]);
    updateTurn(db, predecessorReviewTurn.id, {
      user_parts: JSON.stringify([
        {
          type: 'data-turn-response',
          data: {
            turnId: predecessorReviewTurn.id,
            selectedOptionIds: [predecessorRequestChangesOption.id],
            reviewAction: 'request-changes',
            freeText: 'Keep the restart check, but tighten the rest of the set.',
          },
        },
      ]),
    });

    const successorReviewTurn = createTurn(db, projectId, {
      phase: 'criteria',
      parent_turn_id: predecessorReviewTurn.id,
      question: 'Please review the revised criterion set.',
      why: 'The persisted successor set should stay authoritative even when it omits unchanged metadata.',
      impact: 'high',
      answer: '',
      assistant_parts: createReviewSetAssistantParts({
        phase: 'criteria',
        title: 'Acceptance Criteria',
        question: 'Please review the revised criterion set.',
        why: 'The persisted successor set should stay authoritative even when it omits unchanged metadata.',
        items: [
          {
            reviewItemId: 'criteria:1',
            content: 'Restarting restores the active path',
          },
          {
            reviewItemId: 'criteria:3',
            content: 'Accepting a sparse regenerated review preserves carried rationale on unchanged items',
            rationale: 'Proves regenerated review metadata survives into the accepted output.',
          },
        ],
      }),
    });
    createOption(db, successorReviewTurn.id, {
      position: 0,
      content: 'Accept review',
      is_recommended: true,
    });
    createOption(db, successorReviewTurn.id, {
      position: 1,
      content: 'Request changes',
      is_recommended: false,
    });
    advanceHead(db, projectId, successorReviewTurn.id);

    await request(app)
      .post(`/api/specifications/${projectId}/turns/${successorReviewTurn.id}/response`)
      .send({ kind: 'select-options', positions: [0], reviewAction: 'accept' })
      .expect(200);

    const entitiesRes = await request(app).get(`/api/specifications/${projectId}/entities`).expect(200);
    expect(entitiesRes.body.criteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: 'Restarting restores the active path',
          rationale: 'Proves the persisted branch resumes cleanly.',
        }),
        expect.objectContaining({
          content: 'Accepting a sparse regenerated review preserves carried rationale on unchanged items',
          rationale: 'Proves regenerated review metadata survives into the accepted output.',
        }),
      ]),
    );
    expect(entitiesRes.body.criteria).toHaveLength(2);
    expect(
      entitiesRes.body.criteria.map((criterion: { content: string }) => criterion.content),
    ).not.toContain('Fallback project-wide criterion that should stay out of the accepted set');
  });

  it('requesting changes on the criteria full-set review keeps criteria open and does not advance to output semantics', async () => {
    const projectId = await createTestSpecification();
    const seededCriteria = seedCriteriaReady(projectId);
    const { advanceHead, createKnowledgeItem, createOption, createTurn } = await import('./db.js');

    const criterion = createKnowledgeItem(db, projectId, 'criterion', 'Restarting restores the active path');

    const reviewTurn = createTurn(db, projectId, {
      phase: 'criteria',
      parent_turn_id: seededCriteria.requirementsConfirmationTurn.id,
      question: 'Please review the current criterion set.',
      why: 'Review the whole criterion set before moving forward.',
      impact: 'high',
      answer: '',
      assistant_parts: JSON.stringify([
        {
          type: 'tool-ask_question',
          toolCallId: 'tool-criteria-review',
          state: 'output-available',
          input: {
            question: 'Please review the current criterion set.',
            why: 'Review the whole criterion set before moving forward.',
            impact: 'high',
            options: [
              { content: 'Ship this set', is_recommended: true },
              { content: 'Revise this set', is_recommended: false },
            ],
            reviewActions: [
              { action: 'accept', optionPosition: 0 },
              { action: 'request-changes', optionPosition: 1 },
            ],
          },
          output: { ok: true, turnId: 0, optionCount: 2 },
        },
      ]),
    });
    createOption(db, reviewTurn.id, {
      position: 0,
      content: 'Ship this set',
      is_recommended: true,
    });
    createOption(db, reviewTurn.id, {
      position: 1,
      content: 'Revise this set',
      is_recommended: false,
    });
    advanceHead(db, projectId, reviewTurn.id);

    const response = await request(app)
      .post(`/api/specifications/${projectId}/turns/${reviewTurn.id}/response`)
      .send({
        kind: 'select-options',
        positions: [1],
        freeText: 'Add browser-reload wording.',
        reviewAction: 'request-changes',
      })
      .expect(200);

    expect(response.body).toEqual({ ok: true });

    const projectRes = await request(app).get(`/api/specifications/${projectId}`).expect(200);
    expect(projectRes.body.workflow.phases.criteria).toEqual(
      expect.objectContaining({
        status: 'in_progress',
        proposalPending: false,
      }),
    );
    expect(projectRes.body.specification.active_turn_id).toBe(projectRes.body.turns.at(-1).id);
    expect(projectRes.body.turns.at(-1)).toEqual(
      expect.objectContaining({
        phase: 'criteria',
      }),
    );

    const entitiesRes = await request(app)
      .get(`/api/specifications/${projectId}/entities?mode=project-wide`)
      .expect(200);
    expect(entitiesRes.body.criteria).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: criterion.id })]),
    );
    for (const candidateCriterion of entitiesRes.body.criteria) {
      expect(candidateCriterion).not.toHaveProperty('reviewStatus');
    }
  });

  it('round-trips structured turn responses through project reload, transcript hydration, and interviewer history', async () => {
    const projectId = await createTestSpecification();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makeStructuredQuestionInterviewer(dbArg as DB, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const { getActivePath, getOptionsForTurn } = await import('./db.js');
    const { createInterviewEphemeralChatState } =
      await import('../client/routes/specification/$id/_view/-interview-controller-core.js');
    const turn = getActivePath(db, projectId)[1]!;

    await request(app)
      .post(`/api/specifications/${projectId}/turns/${turn.id}/response`)
      .send({
        kind: 'select-options',
        positions: [0, 1],
        freeText: 'Covers both launch paths',
      })
      .expect(200);

    const projectStateRes = await request(app).get(`/api/specifications/${projectId}`).expect(200);
    const projectState = projectStateRes.body as SpecificationState;
    const selectedOptionIds = getOptionsForTurn(db, turn.id)
      .filter((option) => option.is_selected)
      .map((option) => option.id);

    expect(projectState.turns).toHaveLength(2);
    expect(projectState.turns[1].answer).toBe('Web, Desktop — Covers both launch paths');
    expect(JSON.parse(projectState.turns[1].user_parts ?? '[]')).toEqual([
      { type: 'text', text: 'Web, Desktop — Covers both launch paths' },
      {
        type: 'data-turn-response',
        data: {
          turnId: turn.id,
          selectedOptionIds,
          freeText: 'Covers both launch paths',
        },
      },
    ]);

    const hydratedChat = createInterviewEphemeralChatState(projectState);
    expect(hydratedChat.seedMessages).toEqual([
      {
        id: 'turn-1-answer',
        role: 'user',
        parts: [{ type: 'text', text: 'hello' }],
      },
      {
        id: 'turn-1-assistant',
        role: 'assistant',
        parts: [
          {
            type: 'data-observer-result',
            data: {
              turnId: 1,
              entityIds: {
                goals: [],
                terms: [],
                contexts: [],
                constraints: [],
                requirements: [],
                criteria: [],
                decisions: [],
                assumptions: [],
              },
            },
          },
        ],
      },
      {
        id: `turn-${turn.id}-answer`,
        role: 'user',
        parts: [
          { type: 'text', text: 'Web, Desktop — Covers both launch paths' },
          {
            type: 'data-turn-response',
            data: {
              turnId: turn.id,
              selectedOptionIds,
              freeText: 'Covers both launch paths',
            },
          },
        ],
      },
      {
        id: `turn-${turn.id}-assistant`,
        role: 'assistant',
        parts: [{ type: 'text', text: 'What platform should we support first?' }],
      },
    ]);

    expect(buildInterviewerContext(projectState.turns, 'next prompt')).toContain(
      'Turn response:\n  Chosen options: Web, Desktop\n  Free-text response: Covers both launch paths',
    );
    expect(buildInterviewerContext(projectState.turns, 'next prompt')).not.toContain(
      'Answer: Web, Desktop — Covers both launch paths',
    );
  });

  it('persists a free-text-only turn response when no option is selected', async () => {
    const projectId = await createTestSpecification();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makeStructuredQuestionInterviewer(dbArg as DB, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const { getActivePath, getTurn, getOptionsForTurn } = await import('./db.js');
    const turn = getActivePath(db, projectId)[1]!;

    await request(app)
      .post(`/api/specifications/${projectId}/turns/${turn.id}/response`)
      .send({ kind: 'free-text', freeText: 'None of these fit our use case' })
      .expect(200);

    expect(getOptionsForTurn(db, turn.id).every((option) => !option.is_selected)).toBe(true);
    expect(getTurn(db, turn.id)?.answer).toBe('None of these fit our use case');

    const userParts = JSON.parse(getTurn(db, turn.id)?.user_parts ?? '[]');
    expect(userParts).toEqual([
      { type: 'text', text: 'None of these fit our use case' },
      {
        type: 'data-turn-response',
        data: { turnId: turn.id, selectedOptionIds: [], freeText: 'None of these fit our use case' },
      },
    ]);
  });

  it('acceptance with itemComments and freeText produces identical materialized entities as acceptance without comments', async () => {
    const projectId = await createTestSpecification();
    const seededRequirements = seedRequirementsReady(projectId);
    const { advanceHead, createOption, createTurn } = await import('./db.js');

    const reviewItems = [
      {
        reviewItemId: 'requirements:1',
        referenceCode: createKnowledgeReferenceCode('requirement', 1),
        content: 'Export the reviewed specification as markdown',
        rationale: 'Keeps the accepted review output portable for sharing.',
      },
      {
        reviewItemId: 'requirements:2',
        referenceCode: createKnowledgeReferenceCode('requirement', 2),
        content: 'Resume the interview from persisted local state',
        rationale: 'Users should be able to continue after a restart.',
      },
    ];

    const reviewTurn = createTurn(db, projectId, {
      phase: 'requirements',
      parent_turn_id: seededRequirements.designConfirmationTurn.id,
      question: 'Please review the current requirement set.',
      why: 'Review the whole requirement set before moving forward.',
      impact: 'high',
      answer: '',
      assistant_parts: createReviewSetAssistantParts({
        phase: 'requirements',
        title: 'Requirements',
        question: 'Please review the current requirement set.',
        why: 'Review the whole requirement set before moving forward.',
        items: reviewItems,
      }),
    });
    createOption(db, reviewTurn.id, {
      position: 0,
      content: 'Accept review',
      is_recommended: true,
    });
    createOption(db, reviewTurn.id, {
      position: 1,
      content: 'Request changes',
      is_recommended: false,
    });
    advanceHead(db, projectId, reviewTurn.id);

    await request(app)
      .post(`/api/specifications/${projectId}/turns/${reviewTurn.id}/response`)
      .send({
        kind: 'select-options',
        positions: [0],
        reviewAction: 'accept',
        freeText: 'Looks great overall, minor wording suggestions below.',
        itemComments: [
          { reviewItemId: 'requirements:1', comment: 'Consider rewording to mention format options.' },
        ],
      })
      .expect(200, { ok: true, advancedToPhase: 'criteria' });

    const entitiesRes = await request(app).get(`/api/specifications/${projectId}/entities`).expect(200);

    expect(entitiesRes.body.requirements).toEqual([
      expect.objectContaining({ content: 'Export the reviewed specification as markdown' }),
      expect.objectContaining({ content: 'Resume the interview from persisted local state' }),
    ]);
    expect(entitiesRes.body.requirements).toHaveLength(2);

    for (const requirement of entitiesRes.body.requirements) {
      expect(requirement.content).not.toContain('rewording');
      expect(requirement.content).not.toContain('format options');
    }
  });

  it('acceptance fails deterministically when the persisted review set is missing', async () => {
    const projectId = await createTestSpecification();
    const seededRequirements = seedRequirementsReady(projectId);
    const { advanceHead, createOption, createTurn } = await import('./db.js');

    const reviewTurn = createTurn(db, projectId, {
      phase: 'requirements',
      parent_turn_id: seededRequirements.designConfirmationTurn.id,
      question: 'Please review the current requirement set.',
      why: 'Review the whole requirement set before moving forward.',
      impact: 'high',
      answer: '',
      assistant_parts: JSON.stringify([
        {
          type: 'tool-ask_question',
          toolCallId: 'tool-requirements-review',
          state: 'output-available',
          input: {
            question: 'Please review the current requirement set.',
            why: 'Review the whole requirement set before moving forward.',
            impact: 'high',
            options: [
              { content: 'Accept review', is_recommended: true },
              { content: 'Request changes', is_recommended: false },
            ],
            reviewActions: [
              { action: 'accept', optionPosition: 0 },
              { action: 'request-changes', optionPosition: 1 },
            ],
          },
          output: { ok: true, turnId: 0, optionCount: 2 },
        },
      ]),
    });
    createOption(db, reviewTurn.id, {
      position: 0,
      content: 'Accept review',
      is_recommended: true,
    });
    createOption(db, reviewTurn.id, {
      position: 1,
      content: 'Request changes',
      is_recommended: false,
    });
    advanceHead(db, projectId, reviewTurn.id);

    const response = await request(app)
      .post(`/api/specifications/${projectId}/turns/${reviewTurn.id}/response`)
      .send({ kind: 'select-options', positions: [0], reviewAction: 'accept' })
      .expect(500);

    expect(response.body).toEqual({ error: 'Failed to submit turn response' });
  });

  it('rejects a free-text-only turn response when no free text is provided', async () => {
    const projectId = await createTestSpecification();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makeStructuredQuestionInterviewer(dbArg as DB, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/specifications/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const { getActivePath } = await import('./db.js');
    const turn = getActivePath(db, projectId)[1]!;

    await request(app)
      .post(`/api/specifications/${projectId}/turns/${turn.id}/response`)
      .send({ kind: 'free-text', freeText: '   ' })
      .expect(400);
  });
});

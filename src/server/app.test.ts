import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectState } from '../shared/api-types.js';
import { buildInterviewerContext } from './context.js';
import type { DB } from './db.js';

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

const structuredQuestion = {
  question: 'What platform should we support first?',
  why: 'Platform choice determines the first UI and deployment constraints.',
  impact: 'high' as const,
  options: [
    { content: 'Web', is_recommended: true },
    { content: 'Desktop', is_recommended: false },
  ],
};

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

async function makeStructuredQuestionInterviewer(dbArg: DB, turnId: number) {
  const { updateTurn, createOption } = await import('./db.js');

  updateTurn(dbArg, turnId, {
    question: structuredQuestion.question,
    why: structuredQuestion.why,
    impact: structuredQuestion.impact,
  });

  structuredQuestion.options.forEach((option, index) => {
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
          input: structuredQuestion,
        },
        {
          type: 'tool-output-available',
          toolCallId: 'tool-1',
          output: { ok: true, turnId, optionCount: structuredQuestion.options.length },
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

async function createTestProject(name = 'Test Project'): Promise<number> {
  const res = await request(app).post('/api/projects').send({ name });
  return res.body.id;
}

beforeEach(() => {
  mockStreamInterviewer.mockReset();
  mockRunObserver.mockReset();
  mockStreamInterviewer.mockImplementation(async () => makeTextInterviewer('Hi'));
  mockRunObserver.mockResolvedValue({
    framing: [],
    constraints: [],
    requirements: [],
    criteria: [],
    decisions: [],
    assumptions: [],
  });

  const result = createApp();
  app = result.app;
  db = result.db;
});

afterEach(() => {
  db.$client.close();
});

describe('GET /api/projects', () => {
  it('returns an empty array when no projects exist', async () => {
    const res = await request(app).get('/api/projects').expect(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/projects/:id/chat', () => {
  it('requires typed UI messages', async () => {
    const projectId = await createTestProject();

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({ messages: [{ role: 'user', content: 'hello' }] })
      .expect(400);
  });

  it('returns an AI SDK UI message stream and persists the turn', async () => {
    const projectId = await createTestProject();

    const res = await request(app)
      .post(`/api/projects/${projectId}/chat`)
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
    expect(turns).toHaveLength(1);
    expect(turns[0].answer).toBe('hello');
    expect(turns[0].question).toBe('Hi');
    expect(turns[0].assistant_parts).not.toBeNull();
  });

  it('emits widened observer results and persists scope-mode constraints through the entities API', async () => {
    const projectId = await createTestProject();
    mockRunObserver.mockImplementation(async (dbArg, turnArg, projectIdArg) => {
      const { createKnowledgeItem, linkKnowledgeItemToTurn } = await import('./db.js');
      const framing = createKnowledgeItem(
        dbArg as DB,
        projectIdArg as number,
        'framing',
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
      linkKnowledgeItemToTurn(dbArg as DB, framing.id, (turnArg as { id: number }).id);
      linkKnowledgeItemToTurn(dbArg as DB, constraint.id, (turnArg as { id: number }).id);
      return {
        framing: [framing.id],
        constraints: [constraint.id],
        requirements: [],
        criteria: [],
        decisions: [],
        assumptions: [],
      };
    });

    const res = await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const events = parseSSELines(collectSSE(res)).filter((event) => event !== '[DONE]');
    const observerEvent = events.find((event) => event.type === 'data-observer-result');

    expect(observerEvent).toEqual({
      type: 'data-observer-result',
      data: {
        entityIds: {
          framing: [1],
          constraints: [2],
          requirements: [],
          criteria: [],
          decisions: [],
          assumptions: [],
        },
      },
    });

    const entitiesRes = await request(app).get(`/api/projects/${projectId}/entities`).expect(200);
    expect(entitiesRes.body.framing).toEqual([
      {
        id: 1,
        project_id: projectId,
        kind: 'framing',
        subtype: null,
        content: 'The project starts from a fuzzy brief',
        rationale: 'The user is still establishing the problem context',
      },
    ]);
    expect(entitiesRes.body.constraints).toEqual([
      {
        id: 2,
        project_id: projectId,
        kind: 'constraint',
        subtype: 'non-goal',
        content: 'Keep setup instant',
        rationale: 'The launcher should stay lightweight',
      },
    ]);
  });

  it('emits mixed observer results and persists legacy-plus-generic entities through the entities API', async () => {
    const projectId = await createTestProject();
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
      const framing = createKnowledgeItem(
        dbArg as DB,
        projectIdArg as number,
        'framing',
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
      linkKnowledgeItemToTurn(dbArg as DB, framing.id, (turnArg as { id: number }).id);
      linkKnowledgeItemToTurn(dbArg as DB, constraint.id, (turnArg as { id: number }).id);
      linkAssumptionToTurn(dbArg as DB, assumption.id, (turnArg as { id: number }).id);
      linkDecisionToTurn(dbArg as DB, decision.id, (turnArg as { id: number }).id);
      return {
        framing: [framing.id],
        constraints: [constraint.id],
        requirements: [],
        criteria: [],
        decisions: [decision.id],
        assumptions: [assumption.id],
      };
    });

    const res = await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const events = parseSSELines(collectSSE(res)).filter((event) => event !== '[DONE]');
    const observerEvent = events.find((event) => event.type === 'data-observer-result');

    expect(observerEvent).toEqual({
      type: 'data-observer-result',
      data: {
        entityIds: {
          framing: [1],
          constraints: [2],
          requirements: [],
          criteria: [],
          decisions: [1],
          assumptions: [1],
        },
      },
    });

    const entitiesRes = await request(app).get(`/api/projects/${projectId}/entities`).expect(200);
    expect(entitiesRes.body.framing).toEqual([
      {
        id: 1,
        project_id: projectId,
        kind: 'framing',
        subtype: null,
        content: 'The first release still targets solo builders',
        rationale: 'The turn clarified the intended audience',
      },
    ]);
    expect(entitiesRes.body.constraints).toEqual([
      {
        id: 2,
        project_id: projectId,
        kind: 'constraint',
        subtype: 'non-goal',
        content: 'Do not add a plugin system yet',
        rationale: 'The first release should stay narrow',
      },
    ]);
    expect(entitiesRes.body.decisions).toEqual([
      {
        id: 1,
        project_id: projectId,
        content: 'Start with the web app',
        rationale: 'It is the fastest path to feedback',
      },
    ]);
    expect(entitiesRes.body.assumptions).toEqual([
      {
        id: 1,
        project_id: projectId,
        content: 'Users can work in a browser',
      },
    ]);
    expect(entitiesRes.body.relationships).toEqual([
      {
        type: 'depends_on',
        source: { collection: 'decision', kind: 'decision', id: 1 },
        target: { collection: 'assumption', kind: 'assumption', id: 1 },
      },
    ]);
  });

  it('emits widened observer results and persists requirements-mode requirement items through the entities API', async () => {
    const projectId = await createTestProject();
    mockRunObserver.mockImplementation(async (dbArg, turnArg, projectIdArg) => {
      const { createKnowledgeItem, linkKnowledgeItemToTurn } = await import('./db.js');
      const requirement = createKnowledgeItem(
        dbArg as DB,
        projectIdArg as number,
        'requirement',
        'Resume the interview from SQLite after restart',
        {
          rationale: 'Users will come back to finish the workflow',
        },
      );
      linkKnowledgeItemToTurn(dbArg as DB, requirement.id, (turnArg as { id: number }).id);
      return {
        framing: [],
        constraints: [],
        requirements: [requirement.id],
        criteria: [],
        decisions: [],
        assumptions: [],
      };
    });

    const res = await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const events = parseSSELines(collectSSE(res)).filter((event) => event !== '[DONE]');
    const observerEvent = events.find((event) => event.type === 'data-observer-result');

    expect(observerEvent).toEqual({
      type: 'data-observer-result',
      data: {
        entityIds: {
          framing: [],
          constraints: [],
          requirements: [1],
          criteria: [],
          decisions: [],
          assumptions: [],
        },
      },
    });

    const entitiesRes = await request(app).get(`/api/projects/${projectId}/entities`).expect(200);
    expect(entitiesRes.body.requirements).toEqual([
      {
        id: 1,
        project_id: projectId,
        kind: 'requirement',
        subtype: null,
        content: 'Resume the interview from SQLite after restart',
        rationale: 'Users will come back to finish the workflow',
      },
    ]);
  });

  it('emits widened observer results and persists criteria-mode criterion items through the entities API', async () => {
    const projectId = await createTestProject();
    mockRunObserver.mockImplementation(async (dbArg, turnArg, projectIdArg) => {
      const { createKnowledgeItem, linkKnowledgeItemToTurn } = await import('./db.js');
      const criterion = createKnowledgeItem(
        dbArg as DB,
        projectIdArg as number,
        'criterion',
        'Resuming restores the active path without data loss',
        {
          rationale: 'This proves persistence worked for the branch the user was on',
        },
      );
      linkKnowledgeItemToTurn(dbArg as DB, criterion.id, (turnArg as { id: number }).id);
      return {
        framing: [],
        constraints: [],
        requirements: [],
        criteria: [criterion.id],
        decisions: [],
        assumptions: [],
      } as never;
    });

    const res = await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const events = parseSSELines(collectSSE(res)).filter((event) => event !== '[DONE]');
    const observerEvent = events.find((event) => event.type === 'data-observer-result');

    expect(observerEvent).toEqual({
      type: 'data-observer-result',
      data: {
        entityIds: {
          framing: [],
          constraints: [],
          requirements: [],
          criteria: [1],
          decisions: [],
          assumptions: [],
        },
      },
    });

    const entitiesRes = await request(app).get(`/api/projects/${projectId}/entities`).expect(200);
    expect(entitiesRes.body.criteria).toEqual([
      {
        id: 1,
        project_id: projectId,
        kind: 'criterion',
        subtype: null,
        content: 'Resuming restores the active path without data loss',
        rationale: 'This proves persistence worked for the branch the user was on',
      },
    ]);
  });
});

describe('GET /api/projects/:id/entities', () => {
  it('returns remaining generic knowledge kinds alongside framing, decisions, assumptions, and relationships', async () => {
    const projectId = await createTestProject();
    const { createDecision, createAssumption, createKnowledgeItem, addDecisionParentAssumption } =
      await import('./db.js');

    createKnowledgeItem(db, projectId, 'framing', 'The project starts from an ambiguous brief');
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

    const res = await request(app).get(`/api/projects/${projectId}/entities`).expect(200);

    expect(res.body).toMatchObject({
      framing: [
        {
          kind: 'framing',
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
          source: { collection: 'decision', kind: 'decision', id: decision.id },
          target: { collection: 'assumption', kind: 'assumption', id: assumption.id },
        },
      ],
    });
  });
});

describe('GET /api/projects/:id', () => {
  it('returns structured question state after a tool-driven turn', async () => {
    const projectId = await createTestProject();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makeStructuredQuestionInterviewer(dbArg as DB, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const res = await request(app).get(`/api/projects/${projectId}`).expect(200);

    expect(res.body.turns).toHaveLength(1);
    expect(res.body.turns[0].question).toBe(structuredQuestion.question);
    expect(res.body.turns[0].options).toHaveLength(2);
    expect(res.body.turns[0].options[0].content).toBe('Web');
  });
});

describe('POST /api/projects/:id/turns/:turnId/select', () => {
  it('persists the selected option and free-text turn response into answer and user parts', async () => {
    const projectId = await createTestProject();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makeStructuredQuestionInterviewer(dbArg as DB, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const { getActivePath, getTurn, getOptionsForTurn } = await import('./db.js');
    const turn = getActivePath(db, projectId)[0];

    await request(app)
      .post(`/api/projects/${projectId}/turns/${turn.id}/select`)
      .send({ positions: [1], freeText: 'Best fit for our launch' })
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
    const projectId = await createTestProject();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makeStructuredQuestionInterviewer(dbArg as DB, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const { getActivePath, getTurn, getOptionsForTurn } = await import('./db.js');
    const turn = getActivePath(db, projectId)[0];

    await request(app)
      .post(`/api/projects/${projectId}/turns/${turn.id}/select`)
      .send({ positions: [0, 1], freeText: 'Covers both launch paths' })
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

  it('round-trips structured turn responses through project reload, transcript hydration, and interviewer history', async () => {
    const projectId = await createTestProject();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makeStructuredQuestionInterviewer(dbArg as DB, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const { getActivePath, getOptionsForTurn } = await import('./db.js');
    const { createWorkspaceEphemeralChatState } =
      await import('../client/workspace/workspace-controller-core.js');
    const turn = getActivePath(db, projectId)[0];

    await request(app)
      .post(`/api/projects/${projectId}/turns/${turn.id}/select`)
      .send({ positions: [0, 1], freeText: 'Covers both launch paths' })
      .expect(200);

    const projectStateRes = await request(app).get(`/api/projects/${projectId}`).expect(200);
    const projectState = projectStateRes.body as ProjectState;
    const selectedOptionIds = getOptionsForTurn(db, turn.id)
      .filter((option) => option.is_selected)
      .map((option) => option.id);

    expect(projectState.turns).toHaveLength(1);
    expect(projectState.turns[0].answer).toBe('Web, Desktop — Covers both launch paths');
    expect(JSON.parse(projectState.turns[0].user_parts ?? '[]')).toEqual([
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

    const hydratedChat = createWorkspaceEphemeralChatState(projectState);
    expect(hydratedChat.seedMessages).toEqual([
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
        parts: [
          {
            type: 'tool-ask_question',
            toolCallId: 'tool-1',
            state: 'output-available',
            input: structuredQuestion,
            output: { ok: true, turnId: turn.id, optionCount: structuredQuestion.options.length },
          },
          {
            type: 'data-observer-result',
            data: {
              entityIds: {
                framing: [],
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
    ]);

    expect(buildInterviewerContext(projectState.turns, 'next prompt')).toContain(
      'Turn response:\n  Chosen options: Web, Desktop\n  Free-text response: Covers both launch paths',
    );
    expect(buildInterviewerContext(projectState.turns, 'next prompt')).not.toContain(
      'Answer: Web, Desktop — Covers both launch paths',
    );
  });

  it('persists a free-text-only turn response when no option is selected', async () => {
    const projectId = await createTestProject();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makeStructuredQuestionInterviewer(dbArg as DB, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const { getActivePath, getTurn, getOptionsForTurn } = await import('./db.js');
    const turn = getActivePath(db, projectId)[0];

    await request(app)
      .post(`/api/projects/${projectId}/turns/${turn.id}/select`)
      .send({ freeText: 'None of these fit our use case' })
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

  it('rejects a free-text-only turn response when no free text is provided', async () => {
    const projectId = await createTestProject();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makeStructuredQuestionInterviewer(dbArg as DB, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    const { getActivePath } = await import('./db.js');
    const turn = getActivePath(db, projectId)[0];

    await request(app)
      .post(`/api/projects/${projectId}/turns/${turn.id}/select`)
      .send({ freeText: '   ' })
      .expect(400);
  });
});

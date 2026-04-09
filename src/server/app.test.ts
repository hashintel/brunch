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

async function makePhaseClosureInterviewer(
  dbArg: DB,
  projectId: number,
  turnId: number,
  phase: 'scope' | 'design' = 'scope',
  summary:
    | 'Goals, terms, context, and constraints are sufficiently captured.'
    | 'The main architectural commitments are captured well enough to review requirements.' = 'Goals, terms, context, and constraints are sufficiently captured.',
) {
  const { createPhaseOutcome } = await import('./db.js');

  createPhaseOutcome(dbArg, {
    projectId,
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

async function createTestProject(name = 'Test Project'): Promise<number> {
  const res = await request(app).post('/api/projects').send({ name });
  return res.body.id;
}

beforeEach(() => {
  mockStreamInterviewer.mockReset();
  mockRunObserver.mockReset();
  mockStreamInterviewer.mockImplementation(async () => makeTextInterviewer('Hi'));
  mockRunObserver.mockResolvedValue({
    goals: [],
    terms: [],
    contexts: [],
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

  it('emits canonical scope-kind observer results and persists them through the entities API', async () => {
    const projectId = await createTestProject();
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
      return {
        goals: [goal.id],
        terms: [term.id],
        contexts: [context.id],
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

    const entitiesRes = await request(app).get(`/api/projects/${projectId}/entities`).expect(200);
    expect(entitiesRes.body.goals).toEqual([
      {
        id: 1,
        project_id: projectId,
        kind: 'goal',
        subtype: null,
        content: 'Produce a clean implementation brief',
        rationale: 'The interview should end in a trustworthy handoff',
      },
    ]);
    expect(entitiesRes.body.terms).toEqual([
      {
        id: 2,
        project_id: projectId,
        kind: 'term',
        subtype: null,
        content: 'implementation brief',
        rationale: 'The turn named the artifact the project is trying to produce',
      },
    ]);
    expect(entitiesRes.body.contexts).toEqual([
      {
        id: 3,
        project_id: projectId,
        kind: 'context',
        subtype: null,
        content: 'The project starts from a fuzzy brief',
        rationale: 'The user is still establishing the problem context',
      },
    ]);
    expect(entitiesRes.body.constraints).toEqual([
      {
        id: 4,
        project_id: projectId,
        kind: 'constraint',
        subtype: 'non-goal',
        content: 'Keep setup instant',
        rationale: 'The launcher should stay lightweight',
      },
    ]);
  });

  it('emits mixed observer results and persists generic design entities through the entities API', async () => {
    const projectId = await createTestProject();
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
      const framing = createKnowledgeItem(
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
      linkKnowledgeItemToTurn(dbArg as DB, framing.id, (turnArg as { id: number }).id);
      linkKnowledgeItemToTurn(dbArg as DB, constraint.id, (turnArg as { id: number }).id);
      linkAssumptionToTurn(dbArg as DB, assumption.id, (turnArg as { id: number }).id);
      linkDecisionToTurn(dbArg as DB, decision.id, (turnArg as { id: number }).id);
      createdIds = {
        context: framing.id,
        constraint: constraint.id,
        assumption: assumption.id,
        decision: decision.id,
      };
      return {
        goals: [],
        terms: [],
        contexts: [framing.id],
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

    expect(createdIds).not.toBeNull();
    expect(observerEvent).toEqual({
      type: 'data-observer-result',
      data: {
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

    const entitiesRes = await request(app).get(`/api/projects/${projectId}/entities`).expect(200);
    expect(entitiesRes.body.contexts).toEqual([
      {
        id: createdIds!.context,
        project_id: projectId,
        kind: 'context',
        subtype: null,
        content: 'The first release still targets solo builders',
        rationale: 'The turn clarified the intended audience',
      },
    ]);
    expect(entitiesRes.body.constraints).toEqual([
      {
        id: createdIds!.constraint,
        project_id: projectId,
        kind: 'constraint',
        subtype: 'non-goal',
        content: 'Do not add a plugin system yet',
        rationale: 'The first release should stay narrow',
      },
    ]);
    expect(entitiesRes.body.decisions).toEqual([
      {
        id: createdIds!.decision,
        project_id: projectId,
        content: 'Start with the web app',
        rationale: 'It is the fastest path to feedback',
      },
    ]);
    expect(entitiesRes.body.assumptions).toEqual([
      {
        id: createdIds!.assumption,
        project_id: projectId,
        content: 'Users can work in a browser',
      },
    ]);
    expect(entitiesRes.body.relationships).toEqual([
      {
        type: 'depends_on',
        source: { collection: 'decision', kind: 'decision', id: createdIds!.decision },
        target: { collection: 'assumption', kind: 'assumption', id: createdIds!.assumption },
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
        goals: [],
        terms: [],
        contexts: [],
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
          goals: [],
          terms: [],
          contexts: [],
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
        goals: [],
        terms: [],
        contexts: [],
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
          goals: [],
          terms: [],
          contexts: [],
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
  it('returns canonical generic knowledge kinds alongside decisions, assumptions, and relationships', async () => {
    const projectId = await createTestProject();
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

    const res = await request(app).get(`/api/projects/${projectId}/entities`).expect(200);

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
          source: { collection: 'decision', kind: 'decision', id: decision.id },
          target: { collection: 'assumption', kind: 'assumption', id: assumption.id },
        },
      ],
    });
  });
});

describe('phase outcomes + scope closure', () => {
  it('streams a scope phase summary proposal and projects workflow state from an explicit phase outcome', async () => {
    const projectId = await createTestProject();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makePhaseClosureInterviewer(dbArg as DB, projectId, (turn as { id: number }).id),
    );

    const chatRes = await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [
          { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'We have enough scope context' }] },
        ],
      })
      .expect(200);

    const events = parseSSELines(collectSSE(chatRes)).filter((event) => event !== '[DONE]');
    expect(events).toContainEqual({
      type: 'data-phase-summary',
      data: {
        turnId: 1,
        phase: 'scope',
        summary: 'Goals, terms, context, and constraints are sufficiently captured.',
      },
    });

    const projectRes = await request(app).get(`/api/projects/${projectId}`).expect(200);
    expect(projectRes.body.workflow.phases.scope).toEqual({
      status: 'in_progress',
      closeability: true,
      readiness: 'medium',
      closureBasis: null,
      proposalPending: true,
      turnId: 1,
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });
    expect(JSON.parse(projectRes.body.turns[0].assistant_parts ?? '[]')).toEqual(
      expect.arrayContaining([
        {
          type: 'data-phase-summary',
          data: {
            turnId: 1,
            phase: 'scope',
            summary: 'Goals, terms, context, and constraints are sufficiently captured.',
          },
        },
      ]),
    );
  });

  it('confirms a proposed scope phase outcome through /chat and persists confirmed workflow state', async () => {
    const projectId = await createTestProject();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makePhaseClosureInterviewer(dbArg as DB, projectId, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [
          { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'We have enough scope context' }] },
        ],
      })
      .expect(200);

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u2',
            role: 'user',
            parts: [
              { type: 'text', text: 'Confirm scope closure' },
              { type: 'data-confirmation', data: { turnId: 1, confirmed: true } },
            ],
          },
        ],
      })
      .expect(200);

    const projectRes = await request(app).get(`/api/projects/${projectId}`).expect(200);
    expect(projectRes.body.workflow.phases.scope).toEqual(
      expect.objectContaining({
        status: 'closed',
        turnId: 1,
        summary: 'Goals, terms, context, and constraints are sufficiently captured.',
        closeability: false,
        readiness: 'high',
        closureBasis: 'interviewer_recommended',
        proposalPending: false,
      }),
    );
    expect(projectRes.body.workflow.phases.design).toEqual(
      expect.objectContaining({
        status: 'in_progress',
        closeability: false,
        readiness: 'low',
        closureBasis: null,
        proposalPending: false,
      }),
    );
    expect(projectRes.body.project.active_turn_id).toBe(2);
    expect(projectRes.body.turns.at(-1)).toMatchObject({
      answer: 'Confirm scope closure',
    });
    expect(JSON.parse(projectRes.body.turns.at(-1).user_parts ?? '[]')).toEqual([
      { type: 'text', text: 'Confirm scope closure' },
      { type: 'data-confirmation', data: { turnId: 1, confirmed: true } },
    ]);
  });

  it('enters design mode on the next chat turn after scope closure and runs the observer in design phase', async () => {
    const projectId = await createTestProject();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makePhaseClosureInterviewer(dbArg as DB, projectId, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [
          { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'We have enough scope context' }] },
        ],
      })
      .expect(200);

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u2',
            role: 'user',
            parts: [
              { type: 'text', text: 'Confirm scope closure' },
              { type: 'data-confirmation', data: { turnId: 1, confirmed: true } },
            ],
          },
        ],
      })
      .expect(200);

    mockStreamInterviewer.mockImplementation(async () =>
      makeTextInterviewer('Which database tradeoff matters more?'),
    );

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
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
    );
    expect(mockRunObserver).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ phase: 'design' }),
      projectId,
    );
  });

  it('streams a design phase summary proposal and projects workflow state through the shared phase seam', async () => {
    const projectId = await createTestProject();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makePhaseClosureInterviewer(dbArg as DB, projectId, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [
          { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'We have enough scope context' }] },
        ],
      })
      .expect(200);

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u2',
            role: 'user',
            parts: [
              { type: 'text', text: 'Confirm scope closure' },
              { type: 'data-confirmation', data: { turnId: 1, confirmed: true } },
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
      .post(`/api/projects/${projectId}/chat`)
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

    const projectRes = await request(app).get(`/api/projects/${projectId}`).expect(200);
    expect(projectRes.body.workflow.phases.design).toEqual({
      status: 'in_progress',
      closeability: true,
      readiness: 'medium',
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
    const projectId = await createTestProject();
    mockStreamInterviewer.mockImplementation(async (dbArg, turn) =>
      makePhaseClosureInterviewer(dbArg as DB, projectId, (turn as { id: number }).id),
    );

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [
          { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'We have enough scope context' }] },
        ],
      })
      .expect(200);

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u2',
            role: 'user',
            parts: [
              { type: 'text', text: 'Confirm scope closure' },
              { type: 'data-confirmation', data: { turnId: 1, confirmed: true } },
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
      .post(`/api/projects/${projectId}/chat`)
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

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
      .send({
        messages: [
          {
            id: 'u4',
            role: 'user',
            parts: [
              { type: 'text', text: 'Confirm design closure' },
              { type: 'data-confirmation', data: { turnId: 3, confirmed: true } },
            ],
          },
        ],
      })
      .expect(200);

    const projectRes = await request(app).get(`/api/projects/${projectId}`).expect(200);
    expect(projectRes.body.workflow.phases.design).toEqual(
      expect.objectContaining({
        status: 'closed',
        turnId: 3,
        summary: 'The main architectural commitments are captured well enough to review requirements.',
        closeability: false,
        readiness: 'high',
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

    mockStreamInterviewer.mockImplementation(async () =>
      makeTextInterviewer('Which requirement is must-have?'),
    );

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
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
    );
    expect(mockRunObserver).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ phase: 'requirements' }),
      projectId,
    );
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

describe('POST /api/projects/:id/turns/:turnId/response', () => {
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
      .post(`/api/projects/${projectId}/turns/${turn.id}/response`)
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
      .post(`/api/projects/${projectId}/turns/${turn.id}/response`)
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
      .post(`/api/projects/${projectId}/turns/${turn.id}/response`)
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
      .post(`/api/projects/${projectId}/turns/${turn.id}/response`)
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
      .post(`/api/projects/${projectId}/turns/${turn.id}/response`)
      .send({ freeText: '   ' })
      .expect(400);
  });
});

import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectState, WorkflowPhase } from '@/shared/api-types.js';
import { getPhaseClosureCommandText } from '@/shared/phase-close.js';

import { buildInterviewerContext } from './context.js';
import type { DB } from './db.js';
import { seedFromManifest, type ManifestScenario } from './fixtures/manifest.js';
import {
  seedActiveDesign as _seedActiveDesign,
  seedAllPhasesClosed as _seedAllPhasesClosed,
  seedClosedScope as _seedClosedScope,
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
  phase: WorkflowPhase = 'scope',
  summary = 'Goals, terms, context, and constraints are sufficiently captured.',
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

function seedClosedScope(projectId: number) {
  return _seedClosedScope(db, projectId);
}

function seedActiveDesign(projectId: number) {
  return _seedActiveDesign(db, projectId);
}

function seedRequirementsReady(projectId: number) {
  return _seedRequirementsReady(db, projectId);
}

function seedCriteriaReady(projectId: number) {
  return _seedCriteriaReady(db, projectId);
}

function seedAllPhasesClosed(projectId: number) {
  return _seedAllPhasesClosed(db, projectId);
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

  it('returns workflow summary with scope in-progress for a new project', async () => {
    await createTestProject('Fresh project');
    const res = await request(app).get('/api/projects').expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      name: 'Fresh project',
      workflowSummary: {
        scope: 'in_progress',
        design: 'unstarted',
        requirements: 'unstarted',
        criteria: 'unstarted',
      },
    });
  });

  it('returns workflow summary reflecting closed scope and in-progress design', async () => {
    const projectId = await createTestProject('Active project');
    seedActiveDesign(projectId);
    const res = await request(app).get('/api/projects').expect(200);
    expect(res.body[0]).toMatchObject({
      workflowSummary: {
        scope: 'closed',
        design: 'in_progress',
        requirements: 'unstarted',
        criteria: 'unstarted',
      },
    });
  });

  it('returns workflow summary with all phases closed for a completed project', async () => {
    const projectId = await createTestProject('Done project');
    seedAllPhasesClosed(projectId);
    const res = await request(app).get('/api/projects').expect(200);
    expect(res.body[0]).toMatchObject({
      workflowSummary: {
        scope: 'closed',
        design: 'closed',
        requirements: 'closed',
        criteria: 'closed',
      },
    });
  });
});

describe('GET /api/projects/:id/export', () => {
  it('returns not ready when not all phases are closed', async () => {
    const projectId = await createTestProject('In Progress');
    seedRequirementsReady(projectId);
    const res = await request(app).get(`/api/projects/${projectId}/export`).expect(200);
    expect(res.body).toEqual({ ready: false });
  });

  it('returns ready with markdown when all phases are closed', async () => {
    const projectId = await createTestProject('Done');
    seedAllPhasesClosed(projectId);
    const res = await request(app).get(`/api/projects/${projectId}/export`).expect(200);
    expect(res.body.ready).toBe(true);
    expect(res.body.markdown).toContain('# Done');
    expect(res.body.markdown).toContain('Resume the interview from SQLite after restart');
    expect(res.body.markdown).toContain('Verify SQLite resume');
    expect(res.body.markdown).not.toContain('Support exporting the spec as a PDF');
  });
});

describe('POST /api/projects', () => {
  it('creates a greenfield project by default', async () => {
    const res = await request(app).post('/api/projects').send({ name: 'Greenfield' }).expect(201);
    expect(res.body.mode).toBe('greenfield');
    expect(res.body.cwd).toBeNull();
  });

  it('creates a brownfield project with mode and server-derived cwd', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'Brownfield', mode: 'brownfield' })
      .expect(201);
    expect(res.body.mode).toBe('brownfield');
    expect(res.body.cwd).toBe(process.cwd());
  });

  it('rejects client-supplied cwd data on project creation', async () => {
    await request(app)
      .post('/api/projects')
      .send({ name: 'Brownfield', mode: 'brownfield', cwd: '/tmp/repo' })
      .expect(400);
  });

  it('persists mode in project state', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .send({ name: 'BF', mode: 'brownfield' })
      .expect(201);
    const stateRes = await request(app).get(`/api/projects/${createRes.body.id}`).expect(200);
    expect(stateRes.body.project.mode).toBe('brownfield');
    expect(stateRes.body.project.cwd).toBe(process.cwd());
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

  it('passes brownfield kickoff mode options into the interviewer stream', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .send({ name: 'Brownfield kickoff', mode: 'brownfield' })
      .expect(201);

    await request(app)
      .post(`/api/projects/${createRes.body.id}/chat`)
      .send({
        messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      })
      .expect(200);

    expect(mockStreamInterviewer).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.any(Array),
      'hello',
      'scope',
      { mode: 'brownfield', cwd: process.cwd() },
    );
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

    const entitiesRes = await request(app).get(`/api/projects/${projectId}/entities`).expect(200);
    expect(entitiesRes.body.goals).toEqual([
      {
        id: 1,
        project_id: projectId,
        kind: 'goal',
        subtype: null,
        content: 'Produce a clean implementation brief',
        rationale: 'The interview should end in a trustworthy handoff',
        referenceCode: 'GOAL1',
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
        referenceCode: 'TERM1',
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
        referenceCode: 'CTX1',
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
        referenceCode: 'CST1',
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

    const entitiesRes = await request(app).get(`/api/projects/${projectId}/entities`).expect(200);
    expect(entitiesRes.body.contexts).toEqual([
      {
        id: createdIds!.context,
        project_id: projectId,
        kind: 'context',
        subtype: null,
        content: 'The first release still targets solo builders',
        rationale: 'The turn clarified the intended audience',
        referenceCode: 'CTX1',
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
        referenceCode: 'CST1',
      },
    ]);
    expect(entitiesRes.body.decisions).toEqual([
      {
        id: createdIds!.decision,
        project_id: projectId,
        content: 'Start with the web app',
        rationale: 'It is the fastest path to feedback',
        referenceCode: 'D1',
      },
    ]);
    expect(entitiesRes.body.assumptions).toEqual([
      {
        id: createdIds!.assumption,
        project_id: projectId,
        content: 'Users can work in a browser',
        referenceCode: 'A1',
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
        turnId: 1,
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
        reviewStatus: 'pending',
        referenceCode: 'R1',
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
        turnId: 1,
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
        reviewStatus: 'pending',
        referenceCode: 'CRIT1',
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

    const res = await request(app).get(`/api/projects/${projectId}/entities?mode=project-wide`).expect(200);

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

  it('projects manifest-backed relation vocabulary through the entities api', async () => {
    const scenario: ManifestScenario = {
      turns: [
        {
          phase: 'scope',
          question: 'What are we building?',
          answer: 'A lightweight issue tracker.',
          options: [{ content: 'Issue tracker', is_recommended: true }],
          selectedOptionPositions: [0],
        },
      ],
      knowledgeItems: [
        {
          kind: 'goal',
          content: 'Track work from creation to completion',
          capturedAtTurn: 0,
        },
        {
          kind: 'context',
          content: 'The team currently works from a spreadsheet',
          capturedAtTurn: 0,
        },
        {
          kind: 'constraint',
          content: 'Keep the first release simpler than Jira',
          capturedAtTurn: 0,
        },
        {
          kind: 'term',
          content: 'ticket',
          capturedAtTurn: 0,
        },
        {
          kind: 'requirement',
          content: 'Preserve relation semantics through the shared transport',
          capturedAtTurn: 0,
        },
        {
          kind: 'criterion',
          content: 'The routed client receives the same relation kinds persisted in storage',
          capturedAtTurn: 0,
        },
      ],
      edges: [
        {
          fromItemIndex: 3,
          toItemIndex: 1,
          relation: 'depends_on',
        },
        {
          fromItemIndex: 2,
          toItemIndex: 0,
          relation: 'constrains',
        },
        {
          fromItemIndex: 1,
          toItemIndex: 0,
          relation: 'derived_from',
        },
        {
          fromItemIndex: 5,
          toItemIndex: 4,
          relation: 'verifies',
        },
        {
          fromItemIndex: 4,
          toItemIndex: 0,
          relation: 'refines',
        },
      ],
    };

    const projectId = seedFromManifest(db, scenario, 'Manifest relation characterization');

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

    const res = await request(app).get(`/api/projects/${projectId}/entities`).expect(200);

    expect(res.body.relationships).toEqual(
      expect.arrayContaining([
        {
          type: 'depends_on',
          source: { collection: 'knowledge_item', kind: 'term', id: 4 },
          target: { collection: 'knowledge_item', kind: 'context', id: 2 },
        },
        {
          type: 'constrains',
          source: { collection: 'knowledge_item', kind: 'constraint', id: 3 },
          target: { collection: 'knowledge_item', kind: 'goal', id: 1 },
        },
        {
          type: 'derived_from',
          source: { collection: 'knowledge_item', kind: 'context', id: 2 },
          target: { collection: 'knowledge_item', kind: 'goal', id: 1 },
        },
        {
          type: 'verifies',
          source: { collection: 'knowledge_item', kind: 'criterion', id: 6 },
          target: { collection: 'knowledge_item', kind: 'requirement', id: 5 },
        },
        {
          type: 'refines',
          source: { collection: 'knowledge_item', kind: 'requirement', id: 5 },
          target: { collection: 'knowledge_item', kind: 'goal', id: 1 },
        },
      ]),
    );
  });

  it('keeps canonical entities on the active path while project-wide inventory stays explicit', async () => {
    const { getProjectState } = await import('./core.js');
    const { advanceHead, createKnowledgeItem, createTurn, linkKnowledgeItemToTurn } = await import('./db.js');

    const scenario: ManifestScenario = {
      turns: [
        {
          phase: 'scope',
          question: 'What kind of workflow is this project replacing?',
          answer: 'A spreadsheet-driven issue tracker process.',
          options: [{ content: 'Spreadsheet replacement', is_recommended: true }],
          selectedOptionPositions: [0],
        },
      ],
      knowledgeItems: [
        {
          kind: 'goal',
          content: 'Replace spreadsheet issue tracking with a durable workflow',
          capturedAtTurn: 0,
        },
      ],
      edges: [],
    };

    const projectId = seedFromManifest(db, scenario, 'Manifest Branching Project');
    const projectState = getProjectState(db, projectId);
    expect(projectState).not.toBeNull();
    const rootTurn = projectState!.turns[0]!;

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

    const canonicalRes = await request(app).get(`/api/projects/${projectId}/entities`).expect(200);
    expect(canonicalRes.body.decisions).toEqual([
      expect.objectContaining({ content: 'Use Postgres for persistence' }),
    ]);

    const projectWideRes = await request(app)
      .get(`/api/projects/${projectId}/entities?mode=project-wide`)
      .expect(200);
    expect(projectWideRes.body.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ content: 'Use SQLite for persistence' }),
        expect.objectContaining({ content: 'Use Postgres for persistence' }),
      ]),
    );
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
              { type: 'text', text: 'Confirm grounding closure' },
              {
                type: 'data-confirmation',
                data: {
                  kind: 'confirm-proposed-phase-closure',
                  proposalTurnId: 1,
                  phase: 'scope',
                },
              },
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
    const phaseOutcomes = db.$client
      .prepare('SELECT closure_basis FROM phase_outcome WHERE project_id = ? ORDER BY id DESC')
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
    expect(projectRes.body.project.active_turn_id).toBe(2);
    expect(projectRes.body.turns.at(-1)).toMatchObject({
      answer: 'Confirm grounding closure',
    });
    expect(JSON.parse(projectRes.body.turns.at(-1).user_parts ?? '[]')).toEqual([
      { type: 'text', text: 'Confirm grounding closure' },
      {
        type: 'data-confirmation',
        data: {
          kind: 'confirm-proposed-phase-closure',
          proposalTurnId: 1,
          phase: 'scope',
        },
      },
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
              { type: 'text', text: 'Confirm grounding closure' },
              {
                type: 'data-confirmation',
                data: {
                  kind: 'confirm-proposed-phase-closure',
                  proposalTurnId: 1,
                  phase: 'scope',
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
      undefined,
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
              { type: 'text', text: 'Confirm grounding closure' },
              {
                type: 'data-confirmation',
                data: {
                  kind: 'confirm-proposed-phase-closure',
                  proposalTurnId: 1,
                  phase: 'scope',
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
              { type: 'text', text: 'Confirm grounding closure' },
              {
                type: 'data-confirmation',
                data: {
                  kind: 'confirm-proposed-phase-closure',
                  proposalTurnId: 1,
                  phase: 'scope',
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
              { type: 'text', text: 'Confirm elicitation closure' },
              {
                type: 'data-confirmation',
                data: {
                  kind: 'confirm-proposed-phase-closure',
                  proposalTurnId: 3,
                  phase: 'design',
                },
              },
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
      undefined,
    );
    expect(mockRunObserver).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ phase: 'requirements' }),
      projectId,
    );
  });

  it('persists a missing requirement through the requirements-review response loop and keeps requirements not yet closeable', async () => {
    const projectId = await createTestProject();
    const seededRequirements = seedRequirementsReady(projectId);
    const { advanceHead, createKnowledgeItem, createOption, createTurn } = await import('./db.js');

    createKnowledgeItem(db, projectId, 'requirement', 'Resume the interview from SQLite after restart');

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
      .post(`/api/projects/${projectId}/turns/${reviewTurn.id}/response`)
      .send({
        kind: 'select-options',
        positions: [2],
        freeText: 'Export the reviewed spec as markdown',
      })
      .expect(200);

    mockStreamInterviewer.mockImplementation(async () =>
      makeTextInterviewer('Thanks, what else is missing?'),
    );
    mockRunObserver.mockImplementation(async (dbArg, turnArg, observedProjectId) => {
      const { createKnowledgeItem } = await import('./db.js');
      const turn = turnArg as { phase: string; answer: string | null };
      expect(turn.phase).toBe('requirements');
      expect(observedProjectId).toBe(projectId);

      if (!turn.answer?.includes('Export the reviewed spec as markdown')) {
        return {
          goals: [],
          terms: [],
          contexts: [],
          constraints: [],
          requirements: [],
          criteria: [],
          decisions: [],
          assumptions: [],
        };
      }

      const requirement = createKnowledgeItem(
        dbArg as DB,
        observedProjectId as number,
        'requirement',
        'Export the reviewed spec as markdown',
      );
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

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
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

    const projectRes = await request(app).get(`/api/projects/${projectId}`).expect(200);
    expect(projectRes.body.workflow.phases.requirements).toEqual(
      expect.objectContaining({
        status: 'in_progress',
        closeability: false,
        proposalPending: false,
      }),
    );

    const entitiesRes = await request(app)
      .get(`/api/projects/${projectId}/entities?mode=project-wide`)
      .expect(200);
    expect(entitiesRes.body.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ content: 'Resume the interview from SQLite after restart' }),
        expect.objectContaining({ content: 'Export the reviewed spec as markdown' }),
      ]),
    );
  });

  it('emits a requirements phase-summary proposal once every requirement is explicitly reviewed', async () => {
    const projectId = await createTestProject();
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
      .post(`/api/projects/${projectId}/chat`)
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

    const events = parseSSELines(collectSSE(chatRes)).filter((event) => event !== '[DONE]');
    expect(events).toContainEqual({
      type: 'data-phase-summary',
      data: {
        turnId: reviewTurn.id + 1,
        phase: 'requirements',
        summary: 'The requirement set has explicit review coverage and is ready to move into criteria.',
      },
    });

    const projectRes = await request(app).get(`/api/projects/${projectId}`).expect(200);
    expect(projectRes.body.workflow.phases.requirements).toEqual(
      expect.objectContaining({
        status: 'in_progress',
        closeability: true,
        proposalPending: true,
        turnId: reviewTurn.id + 1,
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
    const projectId = await createTestProject();
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
      projectId,
      phase: 'requirements',
      proposal_turn_id: proposalTurn.id,
      summary: 'The requirement set has explicit review coverage and is ready to move into criteria.',
    });

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
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

    const projectRes = await request(app).get(`/api/projects/${projectId}`).expect(200);
    expect(projectRes.body.workflow.phases.requirements).toEqual(
      expect.objectContaining({
        status: 'closed',
        closeability: false,
        readiness: 'high',
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

    mockStreamInterviewer.mockImplementation(async () =>
      makeTextInterviewer('Which acceptance criterion proves export works?'),
    );

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
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
    expect(mockRunObserver).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ phase: 'criteria' }),
      projectId,
    );

    const refreshedProjectRes = await request(app).get(`/api/projects/${projectId}`).expect(200);
    expect(refreshedProjectRes.body.workflow.phases.requirements).toEqual(
      expect.objectContaining({
        status: 'closed',
        proposalPending: false,
      }),
    );
    expect(refreshedProjectRes.body.turns.at(-1).phase).toBe('criteria');
  });

  it('grounds the first criteria turn in approved requirements and round-trips a criterion through observer persistence', async () => {
    const projectId = await createTestProject();
    seedCriteriaReady(projectId);

    mockStreamInterviewer.mockImplementation(async () =>
      makeTextInterviewer('What would prove the resume flow is complete?'),
    );
    mockRunObserver.mockImplementation(async (dbArg, turnArg, observedProjectId) => {
      const { createKnowledgeItem } = await import('./db.js');
      const criterion = createKnowledgeItem(
        dbArg as DB,
        observedProjectId as number,
        'criterion',
        'Closing and reopening the browser restores the active path',
      );
      return {
        goals: [],
        terms: [],
        contexts: [],
        constraints: [],
        requirements: [],
        criteria: [criterion.id],
        decisions: [],
        assumptions: [],
      };
    });

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
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

    expect(mockRunObserver).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ phase: 'criteria' }),
      projectId,
    );

    const projectRes = await request(app).get(`/api/projects/${projectId}`).expect(200);
    expect(projectRes.body.workflow.phases.criteria).toEqual(
      expect.objectContaining({
        status: 'in_progress',
        closeability: false,
      }),
    );

    const entitiesRes = await request(app)
      .get(`/api/projects/${projectId}/entities?mode=project-wide`)
      .expect(200);
    expect(entitiesRes.body.criteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: 'Closing and reopening the browser restores the active path',
        }),
      ]),
    );
  });

  it('emits a criteria phase-summary proposal once every criterion is explicitly reviewed', async () => {
    const projectId = await createTestProject();
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
      .post(`/api/projects/${projectId}/chat`)
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

    const events = parseSSELines(collectSSE(chatRes)).filter((event) => event !== '[DONE]');
    expect(events).toContainEqual({
      type: 'data-phase-summary',
      data: {
        turnId: reviewTurn.id + 1,
        phase: 'criteria',
        summary: 'All criteria have been explicitly reviewed and the criteria set is ready to close.',
      },
    });

    const projectRes = await request(app).get(`/api/projects/${projectId}`).expect(200);
    expect(projectRes.body.workflow.phases.criteria).toEqual(
      expect.objectContaining({
        status: 'in_progress',
        closeability: true,
        proposalPending: true,
        turnId: reviewTurn.id + 1,
        summary: 'All criteria have been explicitly reviewed and the criteria set is ready to close.',
      }),
    );
  });

  it('confirms a proposed criteria outcome, closes criteria, and projects all workflow phases as closed', async () => {
    const projectId = await createTestProject();
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
      projectId,
      phase: 'criteria',
      proposal_turn_id: proposalTurn.id,
      summary: 'All criteria have been explicitly reviewed and the criteria set is ready to close.',
    });

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
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

    const projectRes = await request(app).get(`/api/projects/${projectId}`).expect(200);
    expect(projectRes.body.workflow.phases.criteria).toEqual(
      expect.objectContaining({
        status: 'closed',
        closeability: false,
        readiness: 'high',
        closureBasis: 'interviewer_recommended',
        proposalPending: false,
        turnId: proposalTurn.id,
        summary: 'All criteria have been explicitly reviewed and the criteria set is ready to close.',
      }),
    );

    for (const phase of ['scope', 'design', 'requirements', 'criteria'] as const) {
      expect(projectRes.body.workflow.phases[phase].status).toBe('closed');
    }

    const phaseOutcomes = db.$client
      .prepare(
        'SELECT phase, closure_basis FROM phase_outcome WHERE project_id = ? AND status = ? ORDER BY id',
      )
      .all(projectId, 'confirmed') as Array<{ phase: string; closure_basis: string | null }>;
    expect(phaseOutcomes.map((o) => o.phase)).toEqual(['scope', 'design', 'requirements', 'criteria']);
    expect(phaseOutcomes.at(-1)).toEqual({
      phase: 'criteria',
      closure_basis: 'interviewer_recommended',
    });
  });

  it('projects no stale active interviewer phase after criteria closure confirmation', async () => {
    const projectId = await createTestProject();
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
      projectId,
      phase: 'criteria',
      proposal_turn_id: proposalTurn.id,
      summary: 'Criteria reviewed.',
    });

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
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

    const projectRes = await request(app).get(`/api/projects/${projectId}`).expect(200);
    const allClosed = (['scope', 'design', 'requirements', 'criteria'] as const).every(
      (phase) => projectRes.body.workflow.phases[phase].status === 'closed',
    );
    expect(allClosed).toBe(true);

    const activePhases = (['scope', 'design', 'requirements', 'criteria'] as const).filter(
      (phase) => projectRes.body.workflow.phases[phase].status === 'in_progress',
    );
    expect(activePhases).toEqual([]);
  });

  it('force-closes design through the shared confirmation seam and enters requirements mode on the next turn', async () => {
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
              { type: 'text', text: 'Confirm grounding closure' },
              {
                type: 'data-confirmation',
                data: {
                  kind: 'confirm-proposed-phase-closure',
                  proposalTurnId: 1,
                  phase: 'scope',
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

    await request(app)
      .post(`/api/projects/${projectId}/chat`)
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

    const projectRes = await request(app).get(`/api/projects/${projectId}`).expect(200);
    expect(projectRes.body.workflow.phases.design).toEqual(
      expect.objectContaining({
        status: 'closed',
        closeability: false,
        readiness: 'high',
        closureBasis: 'user_forced',
        proposalPending: false,
      }),
    );
    const phaseOutcomes = db.$client
      .prepare('SELECT closure_basis FROM phase_outcome WHERE project_id = ? ORDER BY id DESC')
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
      undefined,
    );
    expect(mockRunObserver).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ phase: 'requirements' }),
      projectId,
    );
  });

  it.each([
    {
      name: 'unsupported phases',
      seed: async (projectId: number) => {
        const { advanceHead, createTurn } = await import('./db.js');
        const scopeTurn = createTurn(db, projectId, {
          phase: 'scope',
          question: 'What platform?',
          answer: 'Web',
        });
        advanceHead(db, projectId, scopeTurn.id);
      },
      phase: 'scope',
      expectedError: 'Only design supports force-close in this slice',
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
        seedClosedScope(projectId);
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
          projectId,
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
    const projectId = await createTestProject();
    await seed(projectId);

    const response = await request(app)
      .post(`/api/projects/${projectId}/chat`)
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

    const { listPhaseOutcomesForProject } = await import('./db.js');
    const outcomes = listPhaseOutcomesForProject(db, projectId);
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].phase).toBe('scope');

    const response = await request(app)
      .post(`/api/projects/${projectId}/chat`)
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

  it('persists explicit approved review state for a targeted requirement through the response seam', async () => {
    const projectId = await createTestProject();
    const seededRequirements = seedRequirementsReady(projectId);
    const { advanceHead, createKnowledgeItem, createOption, createTurn, updateTurn } =
      await import('./db.js');

    const approvedRequirement = createKnowledgeItem(db, projectId, 'requirement', 'Export the reviewed spec');
    const pendingRequirement = createKnowledgeItem(
      db,
      projectId,
      'requirement',
      'Resume the interview from SQLite after restart',
    );
    const reviewInput = {
      question: `Should we approve requirement [${approvedRequirement.id}] Export the reviewed spec?`,
      why: 'Requirements review should record explicit approval state one item at a time.',
      impact: 'high' as const,
      options: [
        { content: 'Approve this requirement', is_recommended: true },
        { content: 'This requirement needs correction', is_recommended: false },
      ],
      requirementReview: {
        kind: 'requirement-approval' as const,
        requirementId: approvedRequirement.id,
        approveOptionPosition: 0,
      },
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
      content: 'Approve this requirement',
      is_recommended: true,
    });
    createOption(db, reviewTurn.id, {
      position: 1,
      content: 'This requirement needs correction',
      is_recommended: false,
    });
    updateTurn(db, reviewTurn.id, {
      assistant_parts: JSON.stringify([
        {
          type: 'tool-ask_question',
          toolCallId: 'tool-review',
          state: 'output-available',
          input: reviewInput,
          output: { ok: true, turnId: reviewTurn.id, optionCount: reviewInput.options.length },
        },
      ]),
    });
    advanceHead(db, projectId, reviewTurn.id);

    await request(app)
      .post(`/api/projects/${projectId}/turns/${reviewTurn.id}/response`)
      .send({ kind: 'select-options', positions: [0] })
      .expect(200);

    const reviewedRows = db.$client
      .prepare(
        `SELECT item_id, turn_id, relation FROM turn_knowledge_item WHERE relation = 'reviewed' ORDER BY item_id`,
      )
      .all() as Array<{ item_id: number; turn_id: number; relation: string }>;
    expect(reviewedRows).toEqual([
      {
        item_id: approvedRequirement.id,
        turn_id: reviewTurn.id,
        relation: 'reviewed',
      },
    ]);

    const projectRes = await request(app).get(`/api/projects/${projectId}`).expect(200);
    expect(projectRes.body.workflow.phases.requirements).toEqual(
      expect.objectContaining({
        status: 'in_progress',
        closeability: false,
        proposalPending: false,
      }),
    );

    const entitiesRes = await request(app)
      .get(`/api/projects/${projectId}/entities?mode=project-wide`)
      .expect(200);
    expect(entitiesRes.body.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: approvedRequirement.id, reviewStatus: 'approved' }),
        expect.objectContaining({ id: pendingRequirement.id, reviewStatus: 'pending' }),
      ]),
    );
  });

  it('persists explicit rejected review state for a targeted requirement through the response seam', async () => {
    const projectId = await createTestProject();
    const seededRequirements = seedRequirementsReady(projectId);
    const { advanceHead, createKnowledgeItem, createOption, createTurn, updateTurn } =
      await import('./db.js');

    const rejectedRequirement = createKnowledgeItem(
      db,
      projectId,
      'requirement',
      'Support exporting the spec as a PDF',
    );
    const pendingRequirement = createKnowledgeItem(
      db,
      projectId,
      'requirement',
      'Resume the interview from SQLite after restart',
    );
    const reviewInput = {
      question: `Should we reject requirement [${rejectedRequirement.id}] Support exporting the spec as a PDF?`,
      why: 'Requirements review should record explicit rejection state one item at a time.',
      impact: 'high' as const,
      options: [
        { content: 'Reject this requirement', is_recommended: true },
        { content: 'Keep this requirement for now', is_recommended: false },
      ],
      requirementReview: {
        kind: 'requirement-rejection' as const,
        requirementId: rejectedRequirement.id,
        rejectOptionPosition: 0,
      },
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
      .post(`/api/projects/${projectId}/turns/${reviewTurn.id}/response`)
      .send({ kind: 'select-options', positions: [0] })
      .expect(200);

    const rejectedRows = db.$client
      .prepare(
        `SELECT item_id, turn_id, relation FROM turn_knowledge_item WHERE relation = 'rejected' ORDER BY item_id`,
      )
      .all() as Array<{ item_id: number; turn_id: number; relation: string }>;
    expect(rejectedRows).toEqual([
      {
        item_id: rejectedRequirement.id,
        turn_id: reviewTurn.id,
        relation: 'rejected',
      },
    ]);

    const projectRes = await request(app).get(`/api/projects/${projectId}`).expect(200);
    expect(projectRes.body.workflow.phases.requirements).toEqual(
      expect.objectContaining({
        status: 'in_progress',
        closeability: false,
        proposalPending: false,
      }),
    );

    const entitiesRes = await request(app)
      .get(`/api/projects/${projectId}/entities?mode=project-wide`)
      .expect(200);
    expect(entitiesRes.body.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: rejectedRequirement.id, reviewStatus: 'rejected' }),
        expect.objectContaining({ id: pendingRequirement.id, reviewStatus: 'pending' }),
      ]),
    );
  });

  it('persists explicit approved review state for a targeted criterion through the response seam', async () => {
    const projectId = await createTestProject();
    const seededCriteria = seedCriteriaReady(projectId);
    const { advanceHead, createKnowledgeItem, createOption, createTurn, updateTurn } =
      await import('./db.js');

    const approvedCriterion = createKnowledgeItem(
      db,
      projectId,
      'criterion',
      'Markdown preview renders the reviewed requirements',
    );
    const pendingCriterion = createKnowledgeItem(
      db,
      projectId,
      'criterion',
      'Restarting the browser resumes the active path',
    );
    const reviewInput = {
      question: `Should we approve criterion [${approvedCriterion.id}] Markdown preview renders the reviewed requirements?`,
      why: 'Criteria review should record explicit approval state one item at a time.',
      impact: 'high' as const,
      options: [
        { content: 'Approve this criterion', is_recommended: true },
        { content: 'This criterion needs correction', is_recommended: false },
      ],
      criterionReview: {
        kind: 'criterion-approval' as const,
        criterionId: approvedCriterion.id,
        approveOptionPosition: 0,
      },
    };

    const reviewTurn = createTurn(db, projectId, {
      phase: 'criteria',
      parent_turn_id: seededCriteria.requirementsConfirmationTurn.id,
      question: reviewInput.question,
      why: reviewInput.why,
      impact: reviewInput.impact,
      answer: '',
    });
    createOption(db, reviewTurn.id, {
      position: 0,
      content: 'Approve this criterion',
      is_recommended: true,
    });
    createOption(db, reviewTurn.id, {
      position: 1,
      content: 'This criterion needs correction',
      is_recommended: false,
    });
    updateTurn(db, reviewTurn.id, {
      assistant_parts: JSON.stringify([
        {
          type: 'tool-ask_question',
          toolCallId: 'tool-criterion-review',
          state: 'output-available',
          input: reviewInput,
          output: { ok: true, turnId: reviewTurn.id, optionCount: reviewInput.options.length },
        },
      ]),
    });
    advanceHead(db, projectId, reviewTurn.id);

    await request(app)
      .post(`/api/projects/${projectId}/turns/${reviewTurn.id}/response`)
      .send({ kind: 'select-options', positions: [0] })
      .expect(200);

    const reviewedRows = db.$client
      .prepare(
        `SELECT item_id, turn_id, relation FROM turn_knowledge_item WHERE item_id = ? AND relation = 'reviewed'`,
      )
      .all(approvedCriterion.id) as Array<{ item_id: number; turn_id: number; relation: string }>;
    expect(reviewedRows).toEqual([
      {
        item_id: approvedCriterion.id,
        turn_id: reviewTurn.id,
        relation: 'reviewed',
      },
    ]);

    const projectRes = await request(app).get(`/api/projects/${projectId}`).expect(200);
    expect(projectRes.body.workflow.phases.criteria).toEqual(
      expect.objectContaining({
        status: 'in_progress',
        closeability: false,
        proposalPending: false,
      }),
    );

    const entitiesRes = await request(app)
      .get(`/api/projects/${projectId}/entities?mode=project-wide`)
      .expect(200);
    expect(entitiesRes.body.criteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: approvedCriterion.id, reviewStatus: 'approved' }),
        expect.objectContaining({ id: pendingCriterion.id, reviewStatus: 'pending' }),
      ]),
    );
  });

  it('persists explicit rejected review state for a targeted criterion through the response seam', async () => {
    const projectId = await createTestProject();
    const seededCriteria = seedCriteriaReady(projectId);
    const { advanceHead, createKnowledgeItem, createOption, createTurn, updateTurn } =
      await import('./db.js');

    const rejectedCriterion = createKnowledgeItem(
      db,
      projectId,
      'criterion',
      'PDF export renders the reviewed requirements',
    );
    const pendingCriterion = createKnowledgeItem(
      db,
      projectId,
      'criterion',
      'Restarting the browser resumes the active path',
    );
    const reviewInput = {
      question: `Should we reject criterion [${rejectedCriterion.id}] PDF export renders the reviewed requirements?`,
      why: 'Criteria review should record explicit rejection state one item at a time.',
      impact: 'high' as const,
      options: [
        { content: 'Reject this criterion', is_recommended: true },
        { content: 'Keep this criterion for now', is_recommended: false },
      ],
      criterionReview: {
        kind: 'criterion-rejection' as const,
        criterionId: rejectedCriterion.id,
        rejectOptionPosition: 0,
      },
    };

    const reviewTurn = createTurn(db, projectId, {
      phase: 'criteria',
      parent_turn_id: seededCriteria.requirementsConfirmationTurn.id,
      question: reviewInput.question,
      why: reviewInput.why,
      impact: reviewInput.impact,
      answer: '',
    });
    createOption(db, reviewTurn.id, {
      position: 0,
      content: 'Reject this criterion',
      is_recommended: true,
    });
    createOption(db, reviewTurn.id, {
      position: 1,
      content: 'Keep this criterion for now',
      is_recommended: false,
    });
    updateTurn(db, reviewTurn.id, {
      assistant_parts: JSON.stringify([
        {
          type: 'tool-ask_question',
          toolCallId: 'tool-criterion-review-reject',
          state: 'output-available',
          input: reviewInput,
          output: { ok: true, turnId: reviewTurn.id, optionCount: reviewInput.options.length },
        },
      ]),
    });
    advanceHead(db, projectId, reviewTurn.id);

    await request(app)
      .post(`/api/projects/${projectId}/turns/${reviewTurn.id}/response`)
      .send({ kind: 'select-options', positions: [0] })
      .expect(200);

    const rejectedRows = db.$client
      .prepare(
        `SELECT item_id, turn_id, relation FROM turn_knowledge_item WHERE item_id = ? AND relation = 'rejected'`,
      )
      .all(rejectedCriterion.id) as Array<{ item_id: number; turn_id: number; relation: string }>;
    expect(rejectedRows).toEqual([
      {
        item_id: rejectedCriterion.id,
        turn_id: reviewTurn.id,
        relation: 'rejected',
      },
    ]);

    const entitiesRes = await request(app)
      .get(`/api/projects/${projectId}/entities?mode=project-wide`)
      .expect(200);
    expect(entitiesRes.body.criteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: rejectedCriterion.id, reviewStatus: 'rejected' }),
        expect.objectContaining({ id: pendingCriterion.id, reviewStatus: 'pending' }),
      ]),
    );
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
    const { createInterviewEphemeralChatState } =
      await import('../client/routes/project/$id/_view/-interview-controller-core.js');
    const turn = getActivePath(db, projectId)[0];

    await request(app)
      .post(`/api/projects/${projectId}/turns/${turn.id}/response`)
      .send({
        kind: 'select-options',
        positions: [0, 1],
        freeText: 'Covers both launch paths',
      })
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

    const hydratedChat = createInterviewEphemeralChatState(projectState);
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
              turnId: turn.id,
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
      .send({ kind: 'free-text', freeText: '   ' })
      .expect(400);
  });
});

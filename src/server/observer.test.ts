import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { DomainEvent } from './core.js';
import type { DB } from './db.js';

// Mock the Claude Agent SDK
const mockQuery = vi.fn();
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: mockQuery,
  createSdkMcpServer: () => ({ name: 'interview', instance: {} }),
  tool: (name: string, desc: string, schema: any, handler: any) => ({
    name,
    description: desc,
    inputSchema: schema,
    handler,
  }),
}));

const { runObserver } = await import('./observer.js');
const { createDb, createProject, createTurn, getEntitiesForProject } = await import('./db.js');

let db: DB;

beforeEach(() => {
  mockQuery.mockReset();
  db = createDb();
});

afterEach(() => {
  db.$client.close();
});

/** Helper: mock a successful observer result message */
function mockObserverResult(structured_output: unknown) {
  return (async function* () {
    yield {
      type: 'result',
      subtype: 'success',
      duration_ms: 1500,
      duration_api_ms: 1000,
      total_cost_usd: 0.001,
      is_error: false,
      num_turns: 1,
      usage: { input_tokens: 300, output_tokens: 100 },
      result: '',
      structured_output,
    };
  })();
}

describe('runObserver', () => {
  it('persists extracted decisions and links them to the turn', async () => {
    mockQuery.mockReturnValue(
      mockObserverResult({
        decisions: [
          {
            content: 'Use SQLite',
            rationale: 'Simple and fast',
            parentDecisionIds: [],
            parentAssumptionIds: [],
          },
        ],
        assumptions: [],
      }),
    );

    const project = createProject(db, 'Test');
    const turn = createTurn(db, project.id, { phase: 'scope', question: 'Q', answer: 'A' });

    const events: DomainEvent[] = [];
    for await (const event of runObserver(db, turn, project.id)) {
      events.push(event);
    }

    const entities = getEntitiesForProject(db, project.id);
    expect(entities.decisions).toHaveLength(1);
    expect(entities.decisions[0].content).toBe('Use SQLite');
  });

  it('persists extracted assumptions and links them to the turn', async () => {
    mockQuery.mockReturnValue(
      mockObserverResult({
        decisions: [],
        assumptions: [{ content: 'Users have API keys', parentAssumptionIds: [] }],
      }),
    );

    const project = createProject(db, 'Test');
    const turn = createTurn(db, project.id, { phase: 'scope', question: 'Q', answer: 'A' });

    const events: DomainEvent[] = [];
    for await (const event of runObserver(db, turn, project.id)) {
      events.push(event);
    }

    const entities = getEntitiesForProject(db, project.id);
    expect(entities.assumptions).toHaveLength(1);
    expect(entities.assumptions[0].content).toBe('Users have API keys');
  });

  it('persists dependency edges between decisions', async () => {
    const project = createProject(db, 'Test');
    // Pre-existing decision from a previous turn
    const { createDecision, linkDecisionToTurn } = await import('./db.js');
    const prevTurn = createTurn(db, project.id, { phase: 'scope', question: 'Q1', answer: 'A1' });
    const existingDecision = createDecision(db, project.id, 'Use Express');
    linkDecisionToTurn(db, existingDecision.id, prevTurn.id);

    const turn = createTurn(db, project.id, {
      phase: 'scope',
      question: 'Q2',
      answer: 'A2',
      parent_turn_id: prevTurn.id,
    });

    mockQuery.mockReturnValue(
      mockObserverResult({
        decisions: [
          {
            content: 'Use SSE for streaming',
            rationale: 'Real-time updates',
            parentDecisionIds: [existingDecision.id],
            parentAssumptionIds: [],
          },
        ],
        assumptions: [],
      }),
    );

    for await (const _ of runObserver(db, turn, project.id)) {
      /* consume */
    }

    const entities = getEntitiesForProject(db, project.id);
    expect(entities.decisions).toHaveLength(2);
  });

  it('yields observer-complete with entity IDs after extraction', async () => {
    mockQuery.mockReturnValue(
      mockObserverResult({
        decisions: [{ content: 'D1', rationale: null, parentDecisionIds: [], parentAssumptionIds: [] }],
        assumptions: [{ content: 'A1', parentAssumptionIds: [] }],
      }),
    );

    const project = createProject(db, 'Test');
    const turn = createTurn(db, project.id, { phase: 'scope', question: 'Q', answer: 'A' });

    const events: DomainEvent[] = [];
    for await (const event of runObserver(db, turn, project.id)) {
      events.push(event);
    }

    const complete = events.find((e) => e.type === 'observer-complete');
    expect(complete).toBeDefined();
    expect((complete as any).entityIds.decisions).toHaveLength(1);
    expect((complete as any).entityIds.assumptions).toHaveLength(1);
  });

  it('yields agent-metrics from ResultMessage', async () => {
    mockQuery.mockReturnValue(
      mockObserverResult({
        decisions: [],
        assumptions: [],
      }),
    );

    const project = createProject(db, 'Test');
    const turn = createTurn(db, project.id, { phase: 'scope', question: 'Q', answer: 'A' });

    const events: DomainEvent[] = [];
    for await (const event of runObserver(db, turn, project.id)) {
      events.push(event);
    }

    const metrics = events.find((e) => e.type === 'agent-metrics');
    expect(metrics).toBeDefined();
    expect((metrics as any).agent).toBe('observer');
    expect((metrics as any).durationMs).toBe(1500);
  });

  it('handles empty extraction gracefully', async () => {
    mockQuery.mockReturnValue(
      mockObserverResult({
        decisions: [],
        assumptions: [],
      }),
    );

    const project = createProject(db, 'Test');
    const turn = createTurn(db, project.id, { phase: 'scope', question: 'Q', answer: 'A' });

    const events: DomainEvent[] = [];
    for await (const event of runObserver(db, turn, project.id)) {
      events.push(event);
    }

    const complete = events.find((e) => e.type === 'observer-complete') as any;
    expect(complete.entityIds.decisions).toEqual([]);
    expect(complete.entityIds.assumptions).toEqual([]);
  });
});

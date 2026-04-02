import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { DomainEvent } from './core.js';
import type { DB } from './db.js';

// Mock the Anthropic SDK
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        stream: vi.fn(),
        create: mockCreate,
      };
    },
  };
});

const { runObserver } = await import('./observer.js');
const { createDb, createProject, createTurn, getEntitiesForProject } = await import('./db.js');

let db: DB;

beforeEach(() => {
  mockCreate.mockReset();
  db = createDb();
});

afterEach(() => {
  db.$client.close();
});

/** Helper: mock a successful observer response from raw API */
function mockObserverResponse(jsonOutput: unknown) {
  const jsonStr = JSON.stringify(jsonOutput);
  mockCreate.mockResolvedValue({
    id: 'msg-obs-1',
    content: [{ type: 'text', text: jsonStr }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 300, output_tokens: 100 },
  });
}

describe('runObserver', () => {
  it('persists extracted decisions and links them to the turn', async () => {
    mockObserverResponse({
      decisions: [
        {
          content: 'Use SQLite',
          rationale: 'Simple and fast',
          parentDecisionIds: [],
          parentAssumptionIds: [],
        },
      ],
      assumptions: [],
    });

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
    mockObserverResponse({
      decisions: [],
      assumptions: [{ content: 'Users have API keys', parentAssumptionIds: [] }],
    });

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

    mockObserverResponse({
      decisions: [
        {
          content: 'Use SSE for streaming',
          rationale: 'Real-time updates',
          parentDecisionIds: [existingDecision.id],
          parentAssumptionIds: [],
        },
      ],
      assumptions: [],
    });

    for await (const _ of runObserver(db, turn, project.id)) {
      /* consume */
    }

    const entities = getEntitiesForProject(db, project.id);
    expect(entities.decisions).toHaveLength(2);
  });

  it('yields observer-complete with entity IDs after extraction', async () => {
    mockObserverResponse({
      decisions: [{ content: 'D1', rationale: null, parentDecisionIds: [], parentAssumptionIds: [] }],
      assumptions: [{ content: 'A1', parentAssumptionIds: [] }],
    });

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

  it('yields agent-metrics from raw API response', async () => {
    mockObserverResponse({
      decisions: [],
      assumptions: [],
    });

    const project = createProject(db, 'Test');
    const turn = createTurn(db, project.id, { phase: 'scope', question: 'Q', answer: 'A' });

    const events: DomainEvent[] = [];
    for await (const event of runObserver(db, turn, project.id)) {
      events.push(event);
    }

    const metrics = events.find((e) => e.type === 'agent-metrics');
    expect(metrics).toBeDefined();
    expect((metrics as any).agent).toBe('observer');
    expect((metrics as any).inputTokens).toBe(300);
    expect((metrics as any).outputTokens).toBe(100);
    expect((metrics as any).durationMs).toBeGreaterThanOrEqual(0);
  });

  it('handles code-fence-wrapped JSON from model', async () => {
    const jsonStr = JSON.stringify({
      decisions: [
        { content: 'Use REST', rationale: 'Simple', parentDecisionIds: [], parentAssumptionIds: [] },
      ],
      assumptions: [],
    });
    // Model wraps in ```json ... ```
    mockCreate.mockResolvedValue({
      id: 'msg-obs-1',
      content: [{ type: 'text', text: '```json\n' + jsonStr + '\n```' }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 200, output_tokens: 80 },
    });

    const project = createProject(db, 'Test');
    const turn = createTurn(db, project.id, { phase: 'scope', question: 'Q', answer: 'A' });

    const events: DomainEvent[] = [];
    for await (const event of runObserver(db, turn, project.id)) {
      events.push(event);
    }

    const complete = events.find((e) => e.type === 'observer-complete') as any;
    expect(complete.entityIds.decisions).toHaveLength(1);

    const entities = getEntitiesForProject(db, project.id);
    expect(entities.decisions[0].content).toBe('Use REST');
  });

  it('handles empty extraction gracefully', async () => {
    mockObserverResponse({
      decisions: [],
      assumptions: [],
    });

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

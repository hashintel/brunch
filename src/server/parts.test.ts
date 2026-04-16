import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  dataConfirmationSchema,
  dataTurnResponseSchema,
  type BrunchAssistantPart,
  type BrunchUserPart,
} from '@/shared/chat.js';

import { createDb, type DB } from './db.js';
import {
  deserializeAssistantParts,
  deserializeUserParts,
  safeDeserializeAssistantParts,
  safeDeserializeUserParts,
  serializeParts,
} from './parts.js';

let db: DB;

beforeEach(() => {
  db = createDb();
});

afterEach(() => {
  db.$client.close();
});

describe('migration-adds-parts-columns', () => {
  it('turn table has user_parts and assistant_parts columns', () => {
    const columns = db.$client.prepare("PRAGMA table_info('turn')").all() as Array<{ name: string }>;
    const names = columns.map((column) => column.name);

    expect(names).toContain('user_parts');
    expect(names).toContain('assistant_parts');
  });
});

describe('LLM-boundary data schemas', () => {
  it('validates data-turn-response payloads', () => {
    const value = { turnId: 1, selectedOptionIds: [2], freeText: 'Best fit' };
    expect(dataTurnResponseSchema.parse(value)).toEqual(value);
  });

  it('validates explicit reviewAction payloads for full-set review turns', () => {
    const value = { turnId: 1, selectedOptionIds: [2], reviewAction: 'accept' as const };
    expect(dataTurnResponseSchema.parse(value)).toEqual(value);
  });

  it('validates data-turn-response payloads with many selected options', () => {
    const value = { turnId: 1, selectedOptionIds: [2, 3], freeText: 'Need both' };
    expect(dataTurnResponseSchema.parse(value)).toEqual(value);
  });

  it('validates free-text-only data-turn-response payloads and rejects empty ones', () => {
    const validValue = { turnId: 1, selectedOptionIds: [], freeText: 'None of these fit our use case' };
    expect(dataTurnResponseSchema.parse(validValue)).toEqual(validValue);
    expect(() => dataTurnResponseSchema.parse({ turnId: 1, selectedOptionIds: [] })).toThrow();
  });

  it('validates explicit recommended-close data-confirmation payloads', () => {
    const value = { kind: 'confirm-proposed-phase-closure', proposalTurnId: 5, phase: 'scope' };
    expect(dataConfirmationSchema.parse(value)).toEqual(value);
  });

  it('validates explicit forced-close data-confirmation payloads', () => {
    const value = { kind: 'force-close-active-phase', phase: 'design' };
    expect(dataConfirmationSchema.parse(value)).toEqual(value);
  });

  it('rejects the old optional-field data-confirmation payload shape', () => {
    expect(() => dataConfirmationSchema.parse({ turnId: 5, confirmed: true })).toThrow();
  });
});

describe('assistant part round-trip', () => {
  it('round-trips persisted assistant parts with tool and data parts', () => {
    const parts: BrunchAssistantPart[] = [
      { type: 'reasoning', text: 'Let me think.', state: 'done' },
      { type: 'text', text: 'Here is the next question.', state: 'done' },
      {
        type: 'tool-ask_question',
        toolCallId: 'toolu_01',
        state: 'output-available',
        input: {
          question: 'What platform?',
          why: 'Platform shapes architecture.',
          impact: 'high',
          options: [
            { content: 'Web', is_recommended: true },
            { content: 'Desktop', is_recommended: false },
          ],
        },
        output: { ok: true, turnId: 12, optionCount: 2 },
      },
      {
        type: 'data-observer-result',
        data: {
          entityIds: {
            goals: [],
            terms: [],
            contexts: [3],
            constraints: [4],
            requirements: [5],
            criteria: [],
            decisions: [1],
            assumptions: [2],
          },
        },
      },
    ];

    const json = serializeParts(parts);
    expect(deserializeAssistantParts(json)).toEqual(parts);
  });

  it('round-trips mixed observer-result ids through persisted assistant parts', () => {
    const parts: BrunchAssistantPart[] = [
      { type: 'text', text: 'Captured observer delta.', state: 'done' },
      {
        type: 'data-observer-result',
        data: {
          entityIds: {
            goals: [],
            terms: [],
            contexts: [7],
            constraints: [8],
            requirements: [11],
            criteria: [],
            decisions: [9],
            assumptions: [10],
          },
        },
      },
    ];

    const json = serializeParts(parts);
    expect(deserializeAssistantParts(json)).toEqual(parts);
  });

  it('round-trips observer-result ids with generic criterion entities through persisted assistant parts', () => {
    const parts: BrunchAssistantPart[] = [
      { type: 'text', text: 'Captured criteria observer delta.', state: 'done' },
      {
        type: 'data-observer-result',
        data: {
          entityIds: {
            goals: [],
            terms: [],
            contexts: [],
            constraints: [],
            requirements: [11],
            criteria: [12],
            decisions: [9],
            assumptions: [10],
          },
        },
      },
    ];

    const json = serializeParts(parts);
    expect(deserializeAssistantParts(json)).toEqual(parts);
  });
});

describe('user part round-trip', () => {
  it('round-trips persisted user parts', () => {
    const parts: BrunchUserPart[] = [
      { type: 'text', text: 'Web first — Best fit' },
      {
        type: 'data-turn-response',
        data: { turnId: 4, selectedOptionIds: [9], freeText: 'Best fit', reviewAction: 'accept' },
      },
      {
        type: 'data-confirmation',
        data: { kind: 'confirm-proposed-phase-closure', proposalTurnId: 4, phase: 'scope' },
      },
    ];

    const json = serializeParts(parts);
    expect(deserializeUserParts(json)).toEqual(parts);
  });

  it('round-trips forced-close confirmation user parts', () => {
    const parts: BrunchUserPart[] = [
      { type: 'text', text: 'Force elicitation closure' },
      {
        type: 'data-confirmation',
        data: { kind: 'force-close-active-phase', phase: 'design' },
      },
    ];

    const json = serializeParts(parts);
    expect(deserializeUserParts(json)).toEqual(parts);
  });

  it('round-trips persisted user parts with many selected option ids', () => {
    const parts: BrunchUserPart[] = [
      { type: 'text', text: 'Web, Desktop — Need both' },
      { type: 'data-turn-response', data: { turnId: 4, selectedOptionIds: [9, 10], freeText: 'Need both' } },
    ];

    const json = serializeParts(parts);
    expect(deserializeUserParts(json)).toEqual(parts);
  });
});

describe('safe deserialization', () => {
  it('returns empty arrays for malformed persisted JSON', () => {
    expect(safeDeserializeAssistantParts('not-json')).toEqual([]);
    expect(safeDeserializeUserParts('not-json')).toEqual([]);
  });

  it('returns empty arrays for null persisted JSON', () => {
    expect(safeDeserializeAssistantParts(null)).toEqual([]);
    expect(safeDeserializeUserParts(null)).toEqual([]);
  });
});

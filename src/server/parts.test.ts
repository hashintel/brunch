import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  dataConfirmationSchema,
  dataOptionSelectionSchema,
  type BrunchAssistantPart,
  type BrunchUserPart,
} from '../shared/chat.js';
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

describe('data schemas', () => {
  it('validates data-option-selection payloads', () => {
    const value = { turnId: 1, selectedOptionId: 2, rationale: 'Best fit' };
    expect(dataOptionSelectionSchema.parse(value)).toEqual(value);
  });

  it('validates data-confirmation payloads', () => {
    const value = { turnId: 5, confirmed: true };
    expect(dataConfirmationSchema.parse(value)).toEqual(value);
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
            decisions: [1],
            assumptions: [2],
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
      { type: 'text', text: 'Web first' },
      { type: 'data-option-selection', data: { turnId: 4, selectedOptionId: 9 } },
      { type: 'data-confirmation', data: { turnId: 4, confirmed: true } },
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

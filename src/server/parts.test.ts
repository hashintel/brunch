import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import type { DomainEvent } from './core.js';
import { createDb, type DB } from './db.js';
import {
  assembleAssistantParts,
  serializeParts,
  deserializeAssistantParts,
  dataOptionSelectionSchema,
  dataConfirmationSchema,
  type AssistantPart,
} from './parts.js';

// --- Schema migration ---

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
    const names = columns.map((c) => c.name);
    expect(names).toContain('user_parts');
    expect(names).toContain('assistant_parts');
  });
});

// --- Parts assembly ---

describe('assemble-assistant-parts', () => {
  it('assembles reasoning, text, and tool-call parts from DomainEvents', () => {
    const events: DomainEvent[] = [
      { type: 'stream-start', messageId: 'msg-1' },
      { type: 'thinking', delta: 'Let me ' },
      { type: 'thinking', delta: 'think about this.' },
      { type: 'text-delta', delta: 'Here is ' },
      { type: 'text-delta', delta: 'my answer.' },
      { type: 'tool-call-start', toolName: 'ask_question', toolCallId: 'toolu_01' },
      { type: 'tool-call-delta', toolCallId: 'toolu_01', delta: '{"question":' },
      { type: 'tool-call-delta', toolCallId: 'toolu_01', delta: '"What?"}' },
      { type: 'tool-call-end', toolCallId: 'toolu_01', toolName: 'ask_question' },
      { type: 'stream-end' },
    ];

    const parts = assembleAssistantParts(events);

    expect(parts).toHaveLength(3);
    expect(parts[0]).toEqual({ type: 'reasoning', text: 'Let me think about this.' });
    expect(parts[1]).toEqual({ type: 'text', text: 'Here is my answer.' });
    expect(parts[2]).toEqual({
      type: 'tool-invocation',
      toolCallId: 'toolu_01',
      toolName: 'ask_question',
      args: { question: 'What?' },
      state: 'result',
    });
  });

  it('concatenates consecutive thinking deltas into one reasoning part', () => {
    const events: DomainEvent[] = [
      { type: 'stream-start', messageId: 'msg-1' },
      { type: 'thinking', delta: 'First ' },
      { type: 'thinking', delta: 'second ' },
      { type: 'thinking', delta: 'third.' },
      { type: 'stream-end' },
    ];

    const parts = assembleAssistantParts(events);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toEqual({ type: 'reasoning', text: 'First second third.' });
  });

  it('handles empty event stream', () => {
    const parts = assembleAssistantParts([]);
    expect(parts).toEqual([]);
  });

  it('handles stream with only control events', () => {
    const events: DomainEvent[] = [{ type: 'stream-start', messageId: 'msg-1' }, { type: 'stream-end' }];

    const parts = assembleAssistantParts(events);
    expect(parts).toEqual([]);
  });

  it('handles interleaved reasoning and text blocks', () => {
    const events: DomainEvent[] = [
      { type: 'stream-start', messageId: 'msg-1' },
      { type: 'thinking', delta: 'Hmm...' },
      { type: 'text-delta', delta: 'Answer part 1. ' },
      { type: 'text-delta', delta: 'Answer part 2.' },
      { type: 'stream-end' },
    ];

    const parts = assembleAssistantParts(events);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({ type: 'reasoning', text: 'Hmm...' });
    expect(parts[1]).toEqual({ type: 'text', text: 'Answer part 1. Answer part 2.' });
  });

  it('handles multiple tool calls', () => {
    const events: DomainEvent[] = [
      { type: 'stream-start', messageId: 'msg-1' },
      { type: 'tool-call-start', toolName: 'tool_a', toolCallId: 'tc-1' },
      { type: 'tool-call-delta', toolCallId: 'tc-1', delta: '{"a":1}' },
      { type: 'tool-call-end', toolCallId: 'tc-1', toolName: 'tool_a' },
      { type: 'tool-call-start', toolName: 'tool_b', toolCallId: 'tc-2' },
      { type: 'tool-call-delta', toolCallId: 'tc-2', delta: '{"b":2}' },
      { type: 'tool-call-end', toolCallId: 'tc-2', toolName: 'tool_b' },
      { type: 'stream-end' },
    ];

    const parts = assembleAssistantParts(events);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatchObject({ type: 'tool-invocation', toolName: 'tool_a', args: { a: 1 } });
    expect(parts[1]).toMatchObject({ type: 'tool-invocation', toolName: 'tool_b', args: { b: 2 } });
  });
});

// --- Data Part schemas ---

describe('data-part-schemas', () => {
  it('validates correct data-option-selection', () => {
    const valid = { turnId: 1, selectedOptionId: 2, rationale: 'Best fit' };
    expect(dataOptionSelectionSchema.parse(valid)).toEqual(valid);
  });

  it('validates data-option-selection without optional rationale', () => {
    const valid = { turnId: 1, selectedOptionId: 0 };
    expect(dataOptionSelectionSchema.parse(valid)).toEqual(valid);
  });

  it('rejects data-option-selection with missing turnId', () => {
    expect(() => dataOptionSelectionSchema.parse({ selectedOptionId: 0 })).toThrow();
  });

  it('rejects data-option-selection with string turnId', () => {
    expect(() => dataOptionSelectionSchema.parse({ turnId: 'abc', selectedOptionId: 0 })).toThrow();
  });

  it('validates correct data-confirmation', () => {
    const valid = { turnId: 5, confirmed: true };
    expect(dataConfirmationSchema.parse(valid)).toEqual(valid);
  });

  it('rejects data-confirmation with missing confirmed', () => {
    expect(() => dataConfirmationSchema.parse({ turnId: 5 })).toThrow();
  });

  it('rejects data-confirmation with string confirmed', () => {
    expect(() => dataConfirmationSchema.parse({ turnId: 5, confirmed: 'yes' })).toThrow();
  });
});

// --- Round-trip oracle ---

describe('parts-round-trip', () => {
  it('assistant parts survive JSON serialization round-trip', () => {
    const original: AssistantPart[] = [
      { type: 'reasoning', text: 'Let me think about this carefully.' },
      { type: 'text', text: 'Here is my structured response.' },
      {
        type: 'tool-invocation',
        toolCallId: 'toolu_01',
        toolName: 'ask_question',
        args: { question: 'What?', options: [{ content: 'A' }] },
        state: 'result',
      },
    ];

    const json = serializeParts(original);
    const restored = deserializeAssistantParts(json);
    expect(restored).toEqual(original);
  });

  it('empty parts array round-trips', () => {
    const json = serializeParts([]);
    const restored = deserializeAssistantParts(json);
    expect(restored).toEqual([]);
  });
});

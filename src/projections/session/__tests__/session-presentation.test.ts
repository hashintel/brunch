import { describe, expect, it } from 'vitest';

import { projectSessionPresentation } from '../session-presentation.js';

const target = { specId: 1, sessionId: 'session-1' };
const entry = (id: string, message: unknown) => ({ type: 'message', id, parentId: null, message });
const request = {
  schema: 'brunch.structured_exchange.request',
  v: 1,
  exchange_id: 'ask-1',
  tool_meta: { curr: 'ask', next: 'capture_answer' },
  question: { body: 'What is canonical?' },
  answered: { text: 'Canonical JSONL.' },
};

describe('session presentation', () => {
  it('projects ordinary messages and one ask to stable product identities', () => {
    const result = projectSessionPresentation(target, [
      entry('u1', { role: 'user', content: 'Why?', timestamp: 0 }),
      entry('a1', {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'private' },
          { type: 'text', text: 'Because.' },
        ],
        timestamp: 1,
      }),
      entry('r1', { role: 'toolResult', toolName: 'ask', details: request }),
    ]);

    expect(result).toEqual({
      status: 'ready',
      presentation: {
        target,
        cursor: '2:r1',
        entries: [
          { id: 'u1', cursor: '0:u1', kind: 'message', role: 'user', text: 'Why?' },
          { id: 'a1', cursor: '1:a1', kind: 'message', role: 'assistant', text: 'Because.' },
          {
            id: 'r1',
            cursor: '2:r1',
            kind: 'ask',
            exchangeId: 'ask-1',
            question: 'What is canonical?',
            terminal: { status: 'answered', value: { text: 'Canonical JSONL.' } },
          },
        ],
      },
    });
  });

  it('preserves every free-text ask terminal state without loss', () => {
    const terminals = [
      { answered: { text: 'Canonical JSONL.', comment: 'Keep the source visible.' } },
      { cancelled: { message: 'No longer needed.' } },
      { unavailable: { message: 'The source is unavailable.' } },
      { cancelled: {} },
    ] as const;
    const result = projectSessionPresentation(
      target,
      terminals.map((terminal, index) =>
        entry(`r${index}`, {
          role: 'toolResult',
          toolName: 'ask',
          details: {
            schema: request.schema,
            v: request.v,
            exchange_id: request.exchange_id,
            question: request.question,
            tool_meta: { curr: 'ask' },
            ...terminal,
          },
        }),
      ),
    );

    expect(result).toEqual({
      status: 'ready',
      presentation: {
        target,
        cursor: '3:r3',
        entries: [
          {
            id: 'r0',
            cursor: '0:r0',
            kind: 'ask',
            exchangeId: 'ask-1',
            question: 'What is canonical?',
            terminal: {
              status: 'answered',
              value: { text: 'Canonical JSONL.', comment: 'Keep the source visible.' },
            },
          },
          {
            id: 'r1',
            cursor: '1:r1',
            kind: 'ask',
            exchangeId: 'ask-1',
            question: 'What is canonical?',
            terminal: { status: 'cancelled', value: { message: 'No longer needed.' } },
          },
          {
            id: 'r2',
            cursor: '2:r2',
            kind: 'ask',
            exchangeId: 'ask-1',
            question: 'What is canonical?',
            terminal: { status: 'unavailable', value: { message: 'The source is unavailable.' } },
          },
          {
            id: 'r3',
            cursor: '3:r3',
            kind: 'ask',
            exchangeId: 'ask-1',
            question: 'What is canonical?',
            terminal: { status: 'cancelled', value: {} },
          },
        ],
      },
    });
  });

  it('classifies malformed Brunch ask details instead of leaking them', () => {
    expect(
      projectSessionPresentation(target, [
        entry('bad', {
          role: 'toolResult',
          toolName: 'ask',
          details: { raw: 'pi' },
        }),
      ]),
    ).toEqual({ status: 'malformed_detail', entryId: 'bad', family: 'ask' });
  });
});

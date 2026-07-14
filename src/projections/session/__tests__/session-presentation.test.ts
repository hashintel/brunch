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
            answer: 'Canonical JSONL.',
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

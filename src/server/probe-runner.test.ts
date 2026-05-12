import { describe, expect, it } from 'vitest';

import { runScriptedProbe, type JsonlTransport, type ProbeJsonlRequest } from './probe-runner.js';

describe('probe runner', () => {
  it('drives two interview responses through an injected JSONL transport', async () => {
    const requests: ProbeJsonlRequest[] = [];
    const transport: JsonlTransport = {
      async send(request) {
        requests.push(request);
        if (request.capability === 'spec.create') {
          return { id: request.id, ok: true, output: { specId: 1 } };
        }
        if (request.capability === 'chat.getPrimary') {
          return {
            id: request.id,
            ok: true,
            output: { specId: 1, chatId: 10, kind: 'interview', activeTurnId: null },
          };
        }
        if (request.id === 'ready-1') {
          return {
            id: request.id,
            ok: true,
            output: { chatId: 10, specId: 1, state: 'awaiting_response', turnId: 100 },
          };
        }
        if (request.id === 'read-1') {
          return {
            id: request.id,
            ok: true,
            output: {
              frontier: { state: 'awaiting_response', phase: 'grounding', turnId: 100 },
              turns: [{ id: 100, question: 'What are you building?', answer: null, options: [] }],
              nextCommands: [{ capability: 'turn.submitResponse', input: { chatId: 10, turnId: 100 } }],
            },
          };
        }
        if (request.id === 'answer-1') {
          return { id: request.id, ok: true, output: { response: { ok: true } } };
        }
        if (request.id === 'read-2') {
          return {
            id: request.id,
            ok: true,
            output: {
              frontier: { state: 'answered', phase: 'grounding', turnId: 100 },
              turns: [
                { id: 100, question: 'What are you building?', answer: 'A probeable spec tool', options: [] },
              ],
              nextCommands: [{ capability: 'chat.ensureReady', input: { chatId: 10 } }],
            },
          };
        }
        if (request.id === 'ready-2') {
          return {
            id: request.id,
            ok: true,
            output: { chatId: 10, specId: 1, state: 'awaiting_response', turnId: 101 },
          };
        }
        if (request.id === 'read-3') {
          return {
            id: request.id,
            ok: true,
            output: {
              frontier: { state: 'awaiting_response', phase: 'grounding', turnId: 101 },
              turns: [
                { id: 100, question: 'What are you building?', answer: 'A probeable spec tool', options: [] },
                {
                  id: 101,
                  question: 'What should be specified first?',
                  answer: null,
                  options: [
                    { id: 1, position: 0, content: 'Acceptance criteria' },
                    { id: 2, position: 1, content: 'API shape' },
                  ],
                },
              ],
              nextCommands: [{ capability: 'turn.submitResponse', input: { chatId: 10, turnId: 101 } }],
            },
          };
        }
        if (request.id === 'answer-2') {
          return { id: request.id, ok: true, output: { response: { ok: true } } };
        }
        if (request.id === 'read-4') {
          return {
            id: request.id,
            ok: true,
            output: {
              frontier: { state: 'answered', phase: 'grounding', turnId: 101 },
              turns: [
                { id: 100, question: 'What are you building?', answer: 'A probeable spec tool', options: [] },
                {
                  id: 101,
                  question: 'What should be specified first?',
                  answer: 'Acceptance criteria',
                  options: [],
                },
              ],
              nextCommands: [{ capability: 'chat.ensureReady', input: { chatId: 10 } }],
            },
          };
        }
        return { id: request.id, ok: false, error: { code: 'unexpected', message: request.id } };
      },
    };

    const result = await runScriptedProbe({
      transport,
      scenario: { name: 'proof', specName: 'Probe proof' },
      scriptedAnswers: ['A probeable spec tool'],
    });

    expect(requests.map((request) => request.capability)).toEqual([
      'spec.create',
      'chat.getPrimary',
      'chat.ensureReady',
      'chat.read',
      'turn.submitResponse',
      'chat.read',
      'chat.ensureReady',
      'chat.read',
      'turn.submitResponse',
      'chat.read',
    ]);
    expect(requests[4]).toMatchObject({
      id: 'answer-1',
      input: { chatId: 10, turnId: 100, response: { kind: 'free-text', freeText: 'A probeable spec tool' } },
    });
    expect(requests[8]).toMatchObject({
      id: 'answer-2',
      input: { chatId: 10, turnId: 101, response: { kind: 'select-options', positions: [0] } },
    });
    expect(result.summary).toMatchObject({ turnsAnswered: 2, finalFrontierState: 'answered' });
    expect(result.errors).toEqual([]);
  });

  it('returns structured errors from failed JSONL responses', async () => {
    const transport: JsonlTransport = {
      async send(request) {
        if (request.capability === 'spec.create') {
          return { id: request.id, ok: true, output: { specId: 1 } };
        }
        return {
          id: request.id,
          ok: false,
          error: { code: 'handler_failed', message: 'Chat 10 not found' },
        };
      },
    };

    const result = await runScriptedProbe({
      transport,
      scenario: { name: 'failure', specName: 'Failure proof' },
      scriptedAnswers: [],
    });

    expect(result.summary.turnsAnswered).toBe(0);
    expect(result.errors).toEqual([
      {
        requestId: 'primary',
        capability: 'chat.getPrimary',
        code: 'handler_failed',
        message: 'Chat 10 not found',
      },
    ]);
  });
});

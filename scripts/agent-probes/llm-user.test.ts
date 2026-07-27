import { describe, expect, it } from 'vitest';

import { createModelBackedUserPolicy, type SimulatedUserModelAdapter } from './llm-user.js';
import { buildProbeArtifactBundle, runScriptedProbe, type JsonlTransport } from './probe-runner.js';
import type { ProbeJsonlRequest, ProbeJsonlResponse, SimulatedUserEvent } from './probe-runner.js';

describe('model-backed simulated user policy', () => {
  it('renders a strict JSON prompt with scenario, active question, options, and prior Q/A', async () => {
    const prompts: string[] = [];
    const events: SimulatedUserEvent[] = [];
    const model: SimulatedUserModelAdapter = {
      async generateText(prompt) {
        prompts.push(prompt);
        return JSON.stringify({ kind: 'free-text', freeText: 'I want a spec assistant.' });
      },
    };

    const result = await runScriptedProbe({
      transport: createOneTurnTransport(),
      scenario: { name: 'llm-user', specName: 'LLM user proof', brief: 'A tired founder wants help.' },
      scriptedAnswers: [],
      responsePolicy: createModelBackedUserPolicy({ model, events }),
      simulatedUserEvents: events,
    });

    expect(prompts[0]).toContain('You are simulating the user, not the interviewer.');
    expect(prompts[0]).toContain('A tired founder wants help.');
    expect(prompts[0]).toContain('What are you building?');
    expect(prompts[0]).toContain('Earlier answered turns');
    expect(prompts[1]).toContain('0. Acceptance criteria');
    expect(prompts[1]).toContain('Q: What are you building?');
    expect(prompts[1]).toContain('A: I want a spec assistant.');
    expect(result.summary.turnsAnswered).toBe(2);
  });

  it('parses valid model JSON into free-text and option-selection response payloads', async () => {
    const events: SimulatedUserEvent[] = [];
    const outputs = [
      JSON.stringify({ kind: 'free-text', freeText: 'A graph-first spec tool' }),
      JSON.stringify({ kind: 'select-options', positions: [0] }),
    ];
    const model: SimulatedUserModelAdapter = {
      async generateText() {
        return outputs.shift() ?? '{}';
      },
    };
    const requests: ProbeJsonlRequest[] = [];

    const result = await runScriptedProbe({
      transport: createOneTurnTransport(requests),
      scenario: { name: 'parse', specName: 'Parse proof' },
      scriptedAnswers: [],
      responsePolicy: createModelBackedUserPolicy({ model, events }),
      simulatedUserEvents: events,
    });

    expect(requests[4]).toMatchObject({
      capability: 'turn.submitResponse',
      input: { response: { kind: 'free-text', freeText: 'A graph-first spec tool' } },
    });
    expect(requests[8]).toMatchObject({
      capability: 'turn.submitResponse',
      input: { response: { kind: 'select-options', positions: [0] } },
    });
    expect(result.errors).toEqual([]);
  });

  it('records simulated-user prompt artifacts and parse status in the artifact bundle', async () => {
    const events: SimulatedUserEvent[] = [];
    const model: SimulatedUserModelAdapter = {
      async generateText() {
        return JSON.stringify({ kind: 'free-text', freeText: 'Preserve prompt artifacts' });
      },
    };

    const result = await runScriptedProbe({
      transport: createOneTurnTransport(),
      scenario: { name: 'artifact', specName: 'Artifact proof' },
      scriptedAnswers: [],
      responsePolicy: createModelBackedUserPolicy({ model, events }),
      simulatedUserEvents: events,
    });

    const bundle = buildProbeArtifactBundle(result);
    expect(bundle.simulatedUserEvents[0]).toMatchObject({
      turnId: 100,
      status: 'parsed',
      parsedResponse: { kind: 'free-text', freeText: 'Preserve prompt artifacts' },
    });
    expect(bundle.simulatedUserEvents[0]?.prompt).toContain('Return exactly one JSON object');
    expect(bundle.simulatedUserEvents[0]?.rawModelOutput).toContain('Preserve prompt artifacts');
  });

  it('turns invalid model output into a structured probe error', async () => {
    const events: SimulatedUserEvent[] = [];
    const model: SimulatedUserModelAdapter = {
      async generateText() {
        return 'not json';
      },
    };

    const result = await runScriptedProbe({
      transport: createOneTurnTransport(),
      scenario: { name: 'bad-json', specName: 'Bad JSON proof' },
      scriptedAnswers: [],
      responsePolicy: createModelBackedUserPolicy({ model, events }),
      simulatedUserEvents: events,
    });

    expect(result.summary.turnsAnswered).toBe(0);
    expect(result.errors).toEqual([
      {
        requestId: 'policy-1',
        capability: 'probe.responsePolicy',
        code: 'policy_failed',
        message: 'Simulated user returned invalid JSON',
      },
    ]);
    expect(result.simulatedUserEvents[0]).toMatchObject({ status: 'failed', rawModelOutput: 'not json' });
  });
});

function createOneTurnTransport(requests: ProbeJsonlRequest[] = []): JsonlTransport {
  return {
    async send(request) {
      requests.push(request);
      return getFakeAgentResponse(request);
    },
  };
}

function getFakeAgentResponse(request: ProbeJsonlRequest): ProbeJsonlResponse {
  if (request.capability === 'spec.create') {
    return { id: request.id, ok: true, output: { specId: 1 } };
  }
  if (request.capability === 'chat.getPrimary') {
    return { id: request.id, ok: true, output: { chatId: 10 } };
  }
  if (request.capability === 'chat.ensureReady') {
    const turnId = request.id === 'ready-1' ? 100 : 101;
    return { id: request.id, ok: true, output: { chatId: 10, state: 'awaiting_response', turnId } };
  }
  if (request.id === 'read-1') {
    return {
      id: request.id,
      ok: true,
      output: {
        frontier: { state: 'awaiting_response', turnId: 100 },
        turns: [{ id: 100, question: 'What are you building?', answer: null, options: [] }],
      },
    };
  }
  if (request.id === 'read-2') {
    return {
      id: request.id,
      ok: true,
      output: {
        frontier: { state: 'answered', turnId: 100 },
        turns: [
          { id: 100, question: 'What are you building?', answer: 'I want a spec assistant.', options: [] },
        ],
      },
    };
  }
  if (request.id === 'read-3') {
    return {
      id: request.id,
      ok: true,
      output: {
        frontier: { state: 'awaiting_response', turnId: 101 },
        turns: [
          { id: 100, question: 'What are you building?', answer: 'I want a spec assistant.', options: [] },
          {
            id: 101,
            question: 'What should be specified first?',
            answer: null,
            options: [{ position: 0, content: 'Acceptance criteria' }],
          },
        ],
      },
    };
  }
  if (request.id === 'read-4') {
    return {
      id: request.id,
      ok: true,
      output: {
        frontier: { state: 'answered', turnId: 101 },
        turns: [
          { id: 100, question: 'What are you building?', answer: 'I want a spec assistant.', options: [] },
          {
            id: 101,
            question: 'What should be specified first?',
            answer: 'Acceptance criteria',
            options: [],
          },
        ],
      },
    };
  }
  return { id: request.id, ok: true, output: { ok: true } };
}

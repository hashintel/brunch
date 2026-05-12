import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createProcessJsonlTransport,
  runProcessBackedProbe,
  runScriptedProbe,
  type JsonlTransport,
  type ProbeJsonlRequest,
  type SpawnedJsonlProcess,
} from './probe-runner.js';

describe('probe runner', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function makeTempDir(prefix: string): string {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  }

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

  it('uses a process JSONL transport to write requests and parse responses', async () => {
    const written: string[] = [];
    let onStdoutData: ((chunk: string) => void) | null = null;
    const process: SpawnedJsonlProcess = {
      writeStdin(line) {
        written.push(line);
        const request = JSON.parse(line) as ProbeJsonlRequest;
        onStdoutData?.(
          `${JSON.stringify({ id: request.id, ok: true, output: { echoed: request.capability } })}\n`,
        );
      },
      endStdin() {},
      onStdoutData(listener) {
        onStdoutData = listener;
      },
    };

    const transport = createProcessJsonlTransport(process);
    const response = await transport.send({
      id: 'create',
      capability: 'spec.create',
      input: { name: 'Probe' },
    });

    expect(written).toEqual([
      JSON.stringify({ id: 'create', capability: 'spec.create', input: { name: 'Probe' } }),
    ]);
    expect(response).toEqual({ id: 'create', ok: true, output: { echoed: 'spec.create' } });
  });

  it('creates an isolated workspace and writes minimal probe artifacts outside .brunch', async () => {
    const outputDir = makeTempDir('brunch-probe-output-');
    const spawnedCwds: string[] = [];

    const result = await runProcessBackedProbe({
      scenario: { name: 'process-proof', specName: 'Process proof' },
      scriptedAnswers: ['A temp-workspace probe'],
      outputDir,
      spawnProcess({ cwd }) {
        spawnedCwds.push(cwd);
        return createFakeAgentProcess();
      },
    });

    expect(result.summary).toMatchObject({ turnsAnswered: 2, finalFrontierState: 'answered' });
    expect(spawnedCwds).toHaveLength(1);
    expect(spawnedCwds[0]).toContain('brunch-probe-workspace-');
    expect(outputDir).not.toContain(`${spawnedCwds[0]}/.brunch`);

    const rawJsonl = readFileSync(join(outputDir, 'raw-jsonl.ndjson'), 'utf8');
    const finalChat = JSON.parse(readFileSync(join(outputDir, 'final-chat.json'), 'utf8')) as unknown;
    const summary = JSON.parse(readFileSync(join(outputDir, 'summary.json'), 'utf8')) as unknown;

    expect(rawJsonl).toContain('"direction":"request"');
    expect(rawJsonl).toContain('"direction":"response"');
    expect(finalChat).toMatchObject({ frontier: { state: 'answered' } });
    expect(summary).toMatchObject({ turnsAnswered: 2, finalFrontierState: 'answered' });
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

function createFakeAgentProcess(): SpawnedJsonlProcess {
  let onStdoutData: ((chunk: string) => void) | null = null;

  return {
    writeStdin(line) {
      const request = JSON.parse(line) as ProbeJsonlRequest;
      const response = getFakeAgentResponse(request);
      onStdoutData?.(`${JSON.stringify(response)}\n`);
    },
    endStdin() {},
    onStdoutData(listener) {
      onStdoutData = listener;
    },
  };
}

function getFakeAgentResponse(request: ProbeJsonlRequest) {
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
  if (request.capability === 'chat.ensureReady') {
    const turnId = request.id === 'ready-1' ? 100 : 101;
    return {
      id: request.id,
      ok: true,
      output: { chatId: 10, specId: 1, state: 'awaiting_response', turnId },
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
  if (request.id === 'read-2') {
    return {
      id: request.id,
      ok: true,
      output: {
        frontier: { state: 'answered', phase: 'grounding', turnId: 100 },
        turns: [
          { id: 100, question: 'What are you building?', answer: 'A temp-workspace probe', options: [] },
        ],
        nextCommands: [{ capability: 'chat.ensureReady', input: { chatId: 10 } }],
      },
    };
  }
  if (request.id === 'read-3') {
    return {
      id: request.id,
      ok: true,
      output: {
        frontier: { state: 'awaiting_response', phase: 'grounding', turnId: 101 },
        turns: [
          { id: 100, question: 'What are you building?', answer: 'A temp-workspace probe', options: [] },
          {
            id: 101,
            question: 'What should be specified first?',
            answer: null,
            options: [{ id: 1, position: 0, content: 'Acceptance criteria' }],
          },
        ],
        nextCommands: [{ capability: 'turn.submitResponse', input: { chatId: 10, turnId: 101 } }],
      },
    };
  }
  if (request.id === 'read-4') {
    return {
      id: request.id,
      ok: true,
      output: {
        frontier: { state: 'answered', phase: 'grounding', turnId: 101 },
        turns: [
          { id: 100, question: 'What are you building?', answer: 'A temp-workspace probe', options: [] },
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
  return { id: request.id, ok: true, output: { response: { ok: true } } };
}

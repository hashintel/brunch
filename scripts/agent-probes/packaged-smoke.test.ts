import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { formatSmokeSummary, runPackagedLlmUserSmoke } from './packaged-smoke.js';
import type { ProbeJsonlRequest, ProbeJsonlResponse, SpawnedJsonlProcess } from './probe-runner.js';

describe('packaged LLM-as-user smoke helper', () => {
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

  it('builds first, drives the packaged agent command, preserves fixture state, and returns JSON-only summary data', async () => {
    const outputDir = makeTempDir('brunch-smoke-output-');
    const buildCommands: Array<{ command: string; args: string[] }> = [];
    const spawnedCommands: Array<{ command: string; args: string[]; cwd: string }> = [];

    const summary = await runPackagedLlmUserSmoke({
      outputDir,
      model: {
        async generateText(prompt) {
          if (prompt.includes('Options:') && prompt.includes('0. Acceptance criteria')) {
            return JSON.stringify({ kind: 'select-options', positions: [0] });
          }
          return JSON.stringify({ kind: 'free-text', freeText: 'A smoke-test spec assistant' });
        },
      },
      async runBuildCommand(command, args) {
        buildCommands.push({ command, args });
      },
      spawnProcess(options) {
        spawnedCommands.push({ command: options.command, args: options.args, cwd: options.cwd });
        return createFakeAgentProcess();
      },
    });

    expect(buildCommands).toEqual([{ command: 'npm', args: ['run', 'build'] }]);
    expect(spawnedCommands).toEqual([
      {
        command: process.execPath,
        args: [resolve('bin/brunch.js'), 'agent'],
        cwd: expect.stringContaining('brunch-probe-workspace-'),
      },
    ]);
    expect(summary).toEqual({
      outputDir,
      turnsAnswered: 2,
      finalFrontierState: 'answered',
      errors: [],
    });
    expect(JSON.parse(formatSmokeSummary(summary))).toEqual(summary);
    expect(readFileSync(join(outputDir, 'artifact-bundle.json'), 'utf8')).toContain('simulatedUserEvents');
    expect(readFileSync(join(outputDir, 'summary.json'), 'utf8')).toContain('"turnsAnswered": 2');
  });

  it('writes redacted failure artifacts and returns JSON-safe errors when the model fails', async () => {
    const outputDir = makeTempDir('brunch-smoke-failure-');

    const summary = await runPackagedLlmUserSmoke({
      outputDir,
      model: {
        async generateText() {
          throw new Error('Provider failed with ANTHROPIC_API_KEY=sk-ant-secret-value\nstack');
        },
      },
      async runBuildCommand() {},
      spawnProcess() {
        return createFakeAgentProcess();
      },
    });

    expect(summary).toEqual({
      outputDir,
      turnsAnswered: 0,
      finalFrontierState: 'awaiting_response',
      errors: [
        {
          requestId: 'policy-1',
          capability: 'probe.responsePolicy',
          code: 'policy_failed',
          message: 'Provider failed with ANTHROPIC_API_KEY=[redacted]',
        },
      ],
    });
    expect(readFileSync(join(outputDir, 'artifact-bundle.json'), 'utf8')).not.toContain(
      'sk-ant-secret-value',
    );
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
          { id: 100, question: 'What are you building?', answer: 'A smoke-test spec assistant', options: [] },
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
          { id: 100, question: 'What are you building?', answer: 'A smoke-test spec assistant', options: [] },
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
          { id: 100, question: 'What are you building?', answer: 'A smoke-test spec assistant', options: [] },
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

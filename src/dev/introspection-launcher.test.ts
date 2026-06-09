import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { describe, expect, it } from 'vitest';

import { createInMemoryBrunchIntrospectionStore } from '../.pi/brunch-pi-extensions.js';
import { runBrunchIntrospectionTurn, type BrunchIntrospectionSession } from './introspection-launcher.js';

describe('Brunch introspection launcher', () => {
  it('rejects unsafe artifact run ids before constructing paths', async () => {
    await expect(
      runBrunchIntrospectionTurn({
        session: createFakeSession('No artifact.'),
        store: createInMemoryBrunchIntrospectionStore(),
        runId: '../escape',
      }),
    ).rejects.toThrow('Artifact runId must be a portable single path segment');
  });
  it('writes a paired run artifact keyed by the captured turn', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-introspection-launcher-'));
    const store = createInMemoryBrunchIntrospectionStore();
    store.recordPassiveCapture({
      turnId: 'turn-7',
      capturedAt: '2026-06-09T00:00:00.000Z',
      event: 'before_provider_request',
      payload: { system: 'final prompt', tools: [{ name: 'read' }] },
    });
    const latestPassiveCapture = store.latestPassiveCapture();
    store.recordBaseReport({
      reportedAt: '2026-06-09T00:00:01.000Z',
      command: 'introspect',
      baseSystemPromptOptions: { cwd, selectedTools: ['read'] },
      ...(latestPassiveCapture ? { latestPassiveCapture } : {}),
    });
    const session = createFakeSession('The tool list is clear, but the graph policy is ambiguous.');

    const result = await runBrunchIntrospectionTurn({
      cwd,
      runId: 'test-run',
      session,
      store,
      prompt: 'What is confusing?',
      now: () => new Date('2026-06-09T00:00:02.000Z'),
    });

    expect(result.artifact).toMatchObject({
      runId: 'test-run',
      generatedAt: '2026-06-09T00:00:02.000Z',
      prompt: 'What is confusing?',
      turnId: 'turn-7',
      mechanical: {
        passiveCapture: { turnId: 'turn-7', payload: { system: 'final prompt', tools: [{ name: 'read' }] } },
        baseReport: { baseSystemPromptOptions: { cwd, selectedTools: ['read'] } },
      },
      subjective: { answerText: 'The tool list is clear, but the graph policy is ambiguous.' },
    });

    await expect(readJson(join(result.artifactDir, 'manifest.json'))).resolves.toMatchObject({
      runId: 'test-run',
      turnId: 'turn-7',
    });
    await expect(readJson(join(result.artifactDir, 'mechanical.json'))).resolves.toMatchObject({
      passiveCapture: { turnId: 'turn-7' },
    });
    await expect(readJson(join(result.artifactDir, 'subjective.json'))).resolves.toEqual({
      answerText: 'The tool list is clear, but the graph policy is ambiguous.',
    });
  });

  it('fails loud when the extension did not capture a provider payload', async () => {
    await expect(
      runBrunchIntrospectionTurn({
        session: createFakeSession('No capture.'),
        store: createInMemoryBrunchIntrospectionStore(),
        runId: 'missing-capture',
      }),
    ).rejects.toThrow('Introspection run did not capture a provider payload');
  });
});

function createFakeSession(answerText: string): BrunchIntrospectionSession {
  const messages: BrunchIntrospectionSession['messages'] = [];
  return {
    messages,
    async prompt() {
      messages.push(fauxAssistantMessage(answerText));
    },
  };
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

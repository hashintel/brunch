import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { describe, expect, it } from 'vitest';

import { createInMemoryBrunchIntrospectionStore } from '../app/pi-extensions.js';
import {
  introspectionArtifactDir,
  runBrunchIntrospectionTurn,
  type BrunchIntrospectionSession,
} from './introspection-launcher.js';

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
  it('writes a paired scratch artifact keyed by the captured turn', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-introspection-workbench-'));
    const store = createInMemoryBrunchIntrospectionStore();
    const session = createFakeSession('The tool list is clear, but the graph policy is ambiguous.', () => {
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
    });

    const result = await runBrunchIntrospectionTurn({
      cwd,
      runId: 'test-run',
      session,
      store,
      prompt: 'What is confusing?',
      now: () => new Date('2026-06-09T00:00:02.000Z'),
    });

    expect(result.artifactDir).toBe(introspectionArtifactDir('test-run'));
    expect(result.artifactDir).not.toContain(`${cwd}/.fixtures/`);
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
    await rm(result.artifactDir, { recursive: true, force: true });
  });

  it('rejects a stale passive capture recorded before the prompted turn', async () => {
    const store = createInMemoryBrunchIntrospectionStore();
    store.recordPassiveCapture({
      turnId: 'stale-turn',
      capturedAt: '2026-06-09T00:00:00.000Z',
      event: 'before_provider_request',
      payload: { system: 'stale prompt' },
    });

    await expect(
      runBrunchIntrospectionTurn({
        session: createFakeSession('No new capture.'),
        store,
        runId: 'stale-capture',
      }),
    ).rejects.toThrow('Introspection run did not capture a provider payload for the prompted turn');
  });

  it('fails loud when the extension did not capture a provider payload', async () => {
    await expect(
      runBrunchIntrospectionTurn({
        session: createFakeSession('No capture.'),
        store: createInMemoryBrunchIntrospectionStore(),
        runId: 'missing-capture',
      }),
    ).rejects.toThrow('Introspection run did not capture a provider payload for the prompted turn');
  });

  it('omits a base report from a different turn', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-introspection-launcher-'));
    const store = createInMemoryBrunchIntrospectionStore();
    store.recordPassiveCapture({
      turnId: 'stale-turn',
      capturedAt: '2026-06-09T00:00:00.000Z',
      event: 'before_provider_request',
      payload: { system: 'stale prompt' },
    });
    const staleCapture = store.latestPassiveCapture();
    store.recordBaseReport({
      reportedAt: '2026-06-09T00:00:01.000Z',
      command: 'introspect',
      baseSystemPromptOptions: { cwd, selectedTools: ['read'] },
      ...(staleCapture ? { latestPassiveCapture: staleCapture } : {}),
    });

    const result = await runBrunchIntrospectionTurn({
      cwd,
      runId: 'mismatched-base-report',
      session: createFakeSession('Fresh answer.', () => {
        store.recordPassiveCapture({
          turnId: 'fresh-turn',
          capturedAt: '2026-06-09T00:00:02.000Z',
          event: 'before_provider_request',
          payload: { system: 'fresh prompt' },
        });
      }),
      store,
    });

    expect(result.artifact.turnId).toBe('fresh-turn');
    expect(result.artifact.mechanical).toEqual({
      passiveCapture: {
        turnId: 'fresh-turn',
        capturedAt: '2026-06-09T00:00:02.000Z',
        event: 'before_provider_request',
        payload: { system: 'fresh prompt' },
      },
    });
    await rm(result.artifactDir, { recursive: true, force: true });
  });
});

function createFakeSession(answerText: string, onPrompt?: () => void): BrunchIntrospectionSession {
  const messages: BrunchIntrospectionSession['messages'] = [];
  return {
    messages,
    async prompt() {
      onPrompt?.();
      messages.push(fauxAssistantMessage(answerText));
    },
  };
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

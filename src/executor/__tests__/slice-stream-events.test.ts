import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { readRunDetail } from '../observer-read.js';
import { runDirPath, runMetadataPath } from '../run.js';
import { appendRunOrderedStreamEvent, runStreamEventsPath } from '../slice-stream-events.js';

describe('appendRunOrderedStreamEvent', () => {
  it.each([
    ['torn', '{"event":"agent_stream"'],
    ['invalid', 'not-json\n'],
  ])('refuses to append to a %s run journal', async (_kind, existing) => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-stream-invalid-'));
    const streamPath = join(runDirPath(cwd, 'run-1'), 'streams', 'task-1', 'agent-attempt-1.jsonl');
    const journalPath = runStreamEventsPath(streamPath);
    await mkdir(join(runDirPath(cwd, 'run-1'), 'streams'), { recursive: true });
    await writeFile(journalPath, existing, 'utf8');

    await expect(
      appendRunOrderedStreamEvent({
        streamPath,
        event: { event: 'agent_stream', message: 'must not append' },
      }),
    ).rejects.toThrow();
    await expect(readFile(journalPath, 'utf8')).resolves.toBe(existing);
  });

  it('executes a queued sibling after its predecessor mirror rejects', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-stream-queued-mirror-'));
    const streamsDir = join(runDirPath(cwd, 'run-1'), 'streams');
    const brokenMirror = join(streamsDir, 'task-1', 'agent-attempt-1.jsonl');
    const siblingMirror = join(streamsDir, 'task-2', 'agent-attempt-1.jsonl');
    await mkdir(brokenMirror, { recursive: true });

    const first = appendRunOrderedStreamEvent({
      streamPath: brokenMirror,
      event: { event: 'agent_stream', message: 'first' },
    });
    const sibling = appendRunOrderedStreamEvent({
      streamPath: siblingMirror,
      event: { event: 'agent_stream', message: 'second' },
    });

    await expect(first).rejects.toThrow();
    await expect(sibling).resolves.toMatchObject({ message: 'second', runSequence: 1 });
    await expect(readFile(runStreamEventsPath(siblingMirror), 'utf8')).resolves.toContain('"runSequence":1');
    await expect(readFile(siblingMirror, 'utf8')).resolves.toContain('second');
  });

  it('persists the ordered carrier before a failing attempt-file mirror', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-stream-carrier-'));
    const runDir = runDirPath(cwd, 'run-1');
    const streamPath = join(runDir, 'streams', 'task-1', 'agent-attempt-1.jsonl');
    await mkdir(streamPath, { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      `${JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: join(cwd, 'missing-plan.json'),
        status: 'slice_completed',
        completedSliceIds: ['task-1'],
      })}\n`,
      'utf8',
    );

    await expect(
      appendRunOrderedStreamEvent({
        streamPath,
        event: {
          event: 'agent_stream',
          runId: 'run-1',
          sliceId: 'task-1',
          sequence: 0,
          kind: 'message',
          message: 'durable first',
        },
      }),
    ).rejects.toThrow();

    await expect(readFile(runStreamEventsPath(streamPath), 'utf8')).resolves.toContain('durable first');
    await expect(access(streamPath)).resolves.toBeUndefined();
    await expect(readRunDetail(cwd, 'run-1')).resolves.toMatchObject({
      agentStreamTotal: 1,
      agentStreamTail: [{ sliceId: 'task-1', message: 'durable first', runSequence: 0 }],
    });
  });
});

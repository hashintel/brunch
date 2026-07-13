import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { readRunDetail } from '../observer-read.js';
import { runDirPath, runMetadataPath } from '../run.js';
import { appendRunOrderedStreamEvent, runStreamEventsPath } from '../slice-stream-events.js';

describe('appendRunOrderedStreamEvent', () => {
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

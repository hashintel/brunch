import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { agentResultPath, agentStreamPath, ingestAgentResult } from '../agent-result.js';
import type { AgentRunArgs } from '../execution-ports.js';
import { reportsPath } from '../report.js';
import { readRunMetadata, runDirPath, runMetadataPath } from '../run.js';
import { sliceExecutionRequestPath } from '../slice-execute.js';
import { ingestTestResult } from '../test-result.js';
import { worktreeDirPath } from '../worktree.js';

const fsMockState = vi.hoisted(() => ({
  slowFirstStreamAppendPath: undefined as string | undefined,
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    appendFile: vi.fn(async (...args: Parameters<typeof actual.appendFile>) => {
      if (
        args[0] === fsMockState.slowFirstStreamAppendPath &&
        typeof args[1] === 'string' &&
        args[1].includes('"sequence":0')
      ) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return actual.appendFile(...args);
    }),
  };
});

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function createRequestedSliceRun(cwd: string): Promise<void> {
  const runDir = runDirPath(cwd, 'run-1');
  const metadataPath = runMetadataPath(cwd, 'run-1');
  const reportPath = reportsPath(cwd, 'run-1');
  const requestPath = sliceExecutionRequestPath(cwd, 'run-1', 'task-1');
  await mkdir(dirname(requestPath), { recursive: true });
  await writeFile(requestPath, JSON.stringify({ status: 'requested' }), 'utf8');
  await writeFile(reportPath, '{"event":"run_ready"}\n', 'utf8');
  await writeFile(
    metadataPath,
    JSON.stringify({
      runId: 'run-1',
      specId: '42',
      planPath: '/tmp/plan.json',
      status: 'slice_execution_requested',
      worktreeDir: join(runDir, 'worktree'),
      reportsPath: reportPath,
      activeSliceId: 'task-1',
      activeEpicId: 'frontier-1',
      sliceExecutionRequestPath: requestPath,
      verifyTarget: { command: 'npm', args: ['run', 'verify'] },
    }),
    'utf8',
  );
  await mkdir(join(runDir, 'worktree'), { recursive: true });
}

describe('ingestAgentResult', () => {
  it('does not ingest when run metadata is missing', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-agent-result-missing-run-'));
    const result = await ingestAgentResult({
      cwd,
      runId: 'run-1',
      agentRunner: {
        async run() {
          return { status: 'completed', summary: 'Implemented task.' };
        },
      },
    });

    expect(result).toEqual({
      status: 'missing_run',
      runStatus: 'not_started',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('does not ingest before execution has been requested', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-agent-result-not-requested-'));
    await mkdir(runDirPath(cwd, 'run-1'), { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      JSON.stringify({ runId: 'run-1', specId: '42', planPath: '/tmp/plan.json', status: 'slice_started' }),
      'utf8',
    );

    const result = await ingestAgentResult({
      cwd,
      runId: 'run-1',
      agentRunner: {
        async run() {
          return { status: 'completed', summary: 'Implemented task.' };
        },
      },
    });

    expect(result).toEqual({
      status: 'slice_not_requested',
      runStatus: 'slice_started',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('rejects active slice ids that would read outside the agent-output directory', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-agent-result-unsafe-slice-'));
    const runDir = runDirPath(cwd, 'run-1');
    const metadataPath = runMetadataPath(cwd, 'run-1');
    const reportPath = reportsPath(cwd, 'run-1');
    await mkdir(runDir, { recursive: true });
    await writeFile(reportPath, '{"event":"run_ready"}\n', 'utf8');
    await writeFile(
      metadataPath,
      JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/tmp/plan.json',
        status: 'slice_execution_requested',
        reportsPath: reportPath,
        activeSliceId: '../../escape',
        activeEpicId: 'frontier-1',
      }),
      'utf8',
    );

    await expect(
      ingestAgentResult({
        cwd,
        runId: 'run-1',
        agentRunner: {
          async run() {
            return { status: 'completed', summary: 'Implemented task.' };
          },
        },
      }),
    ).rejects.toThrow('invalid sliceId');
  });

  it('runs the agent runner in the run worktree and ingests its result', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-agent-result-runner-'));
    await createRequestedSliceRun(cwd);
    const resultPath = agentResultPath(cwd, 'run-1', 'task-1');
    const calls: AgentRunArgs[] = [];

    const result = await ingestAgentResult({
      cwd,
      runId: 'run-1',
      agentRunner: {
        async run(args) {
          calls.push(args);
          return { status: 'completed', summary: 'Implemented task.' };
        },
      },
    });

    expect(calls).toEqual([
      expect.objectContaining({
        worktreeDir: worktreeDirPath(cwd, 'run-1'),
        requestPath: sliceExecutionRequestPath(cwd, 'run-1', 'task-1'),
        resultPath,
        runId: 'run-1',
        epicId: 'frontier-1',
        sliceId: 'task-1',
      }),
    ]);
    expect(result).toEqual({
      status: 'agent_result_ingested',
      runStatus: 'agent_result_ingested',
      runId: 'run-1',
      sliceId: 'task-1',
      epicId: 'frontier-1',
      resultPath,
      metadataPath: runMetadataPath(cwd, 'run-1'),
      reportsPath: reportsPath(cwd, 'run-1'),
      sideEffects: [
        { kind: 'append_file', path: reportsPath(cwd, 'run-1') },
        { kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
      ],
    });
    const reports = (await readFile(reportsPath(cwd, 'run-1'), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(reports.at(-1)).toEqual({
      event: 'slice_agent_result',
      runId: 'run-1',
      epicId: 'frontier-1',
      sliceId: 'task-1',
      cycle: 1,
      artifactAttempt: 1,
      status: 'completed',
      summary: 'Implemented task.',
    });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'agent_result_ingested',
      activeSliceId: 'task-1',
      agentResultPath: resultPath,
    });
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'petrinaut'))).toBe(false);
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'tests-ran.json'))).toBe(false);
  });

  it('activates a pending repair before standalone agent ingestion', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-agent-result-pending-repair-'));
    await createRequestedSliceRun(cwd);
    await ingestAgentResult({
      cwd,
      runId: 'run-1',
      agentRunner: {
        async run() {
          return { status: 'completed', summary: 'Initial implementation.' };
        },
      },
    });
    await ingestTestResult({
      cwd,
      runId: 'run-1',
      testRunner: {
        async run() {
          return { status: 'completed', verdict: 'failed', exitCode: 1, target: 'npm run verify' };
        },
      },
    });
    expect(await readRunMetadata(runMetadataPath(cwd, 'run-1'))).toMatchObject({
      status: 'slice_execution_requested',
      pendingSliceRepair: { phase: 'materialized', sourceCycle: 1, cycle: 2 },
    });

    const calls: AgentRunArgs[] = [];
    await ingestAgentResult({
      cwd,
      runId: 'run-1',
      agentRunner: {
        async run(args) {
          calls.push(args);
          return { status: 'completed', summary: 'Repaired implementation.' };
        },
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      cycle: 2,
      repairContext: { cycle: 2, sourceCycle: 1 },
      repairContextAuthority: {
        pending: { phase: 'materialized', cycle: 2, sourceCycle: 1 },
      },
    });
    const metadata = await readRunMetadata(runMetadataPath(cwd, 'run-1'));
    expect(metadata).toMatchObject({
      status: 'agent_result_ingested',
      activeSliceRepairContext: { cycle: 2, sourceCycle: 1 },
      sliceRepairHistory: {
        'task-1': [{ cycle: 1 }, { cycle: 2, epochs: [{ stage: 'agent', outcome: 'succeeded' }] }],
      },
    });
    expect(metadata?.pendingSliceRepair).toBeUndefined();
  });

  it('persists normalized worker stream updates before ingesting the final result', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-agent-result-stream-'));
    await createRequestedSliceRun(cwd);
    const observed: unknown[] = [];

    const result = await ingestAgentResult({
      cwd,
      runId: 'run-1',
      agentRunner: {
        async run(args) {
          await args.onUpdate?.({ kind: 'status', message: 'worker started' });
          await args.onUpdate?.({ kind: 'message', message: 'edited src/types.ts' });
          return { status: 'completed', summary: 'Implemented task.' };
        },
      },
      onAgentUpdate: (event) => observed.push(event),
    });

    const streamPath = agentStreamPath(cwd, 'run-1', 'task-1');
    const stream = (await readFile(streamPath, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(stream).toEqual([
      {
        event: 'agent_stream',
        runId: 'run-1',
        epicId: 'frontier-1',
        sliceId: 'task-1',
        sequence: 0,
        runSequence: 0,
        kind: 'status',
        message: 'worker started',
      },
      {
        event: 'agent_stream',
        runId: 'run-1',
        epicId: 'frontier-1',
        sliceId: 'task-1',
        sequence: 1,
        runSequence: 1,
        kind: 'message',
        message: 'edited src/types.ts',
      },
    ]);
    expect(observed).toEqual(stream);
    expect(result.sideEffects).toContainEqual({ kind: 'append_file', path: streamPath });
    expect(result.status).toBe('agent_result_ingested');
  });

  it('serializes concurrent worker stream updates before appending', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-agent-result-stream-race-'));
    await createRequestedSliceRun(cwd);
    const streamPath = agentStreamPath(cwd, 'run-1', 'task-1');
    fsMockState.slowFirstStreamAppendPath = streamPath;

    try {
      await ingestAgentResult({
        cwd,
        runId: 'run-1',
        agentRunner: {
          async run(args) {
            await Promise.all([
              args.onUpdate?.({ kind: 'status', message: 'worker started' }),
              args.onUpdate?.({ kind: 'message', message: 'edited src/types.ts' }),
            ]);
            return { status: 'completed', summary: 'Implemented task.' };
          },
        },
      });
    } finally {
      fsMockState.slowFirstStreamAppendPath = undefined;
    }

    const stream = (await readFile(streamPath, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(stream.map((event) => [event.sequence, event.message])).toEqual([
      [0, 'worker started'],
      [1, 'edited src/types.ts'],
    ]);
  });

  it('does not advance run metadata when the agent runner cannot execute', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-agent-result-run-failed-'));
    await createRequestedSliceRun(cwd);

    const result = await ingestAgentResult({
      cwd,
      runId: 'run-1',
      agentRunner: {
        async run() {
          return { status: 'failed', message: 'worker unavailable' };
        },
      },
    });

    expect(result).toEqual({
      status: 'agent_run_failed',
      runStatus: 'slice_execution_requested',
      runId: 'run-1',
      sliceId: 'task-1',
      worktreeDir: worktreeDirPath(cwd, 'run-1'),
      metadataPath: runMetadataPath(cwd, 'run-1'),
      message: 'worker unavailable',
      attempts: 1,
      sideEffects: [{ kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' }],
    });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'slice_execution_requested',
      activeSliceAttempts: 1,
    });
    const reports = await readFile(reportsPath(cwd, 'run-1'), 'utf8');
    expect(reports).not.toContain('slice_agent_result');
  });
});

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { runDirPath, runMetadataPath } from '../../../executor/run.js';
import type { JsonRpcRequest } from '../../protocol.js';
import { executeRpcMethods, UNKNOWN_RUN_ID_MESSAGE } from '../execute.js';
import type { RpcMethodContext } from '../registry.js';

function contextFor(cwd: string): RpcMethodContext {
  // execute.* handlers consume only cwd; the remaining context members are
  // coordinator/session machinery these read projections must never touch.
  return { cwd } as RpcMethodContext;
}

function method(name: string) {
  const definition = executeRpcMethods.find((entry) => entry.method === name);
  if (!definition) throw new Error(`missing method ${name}`);
  return definition;
}

function request(name: string, params?: unknown): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id: 7,
    method: name,
    ...(params === undefined ? {} : { params }),
  } as JsonRpcRequest;
}

async function writeRun(
  cwd: string,
  runId: string,
  options: { readonly planPath?: string } = {},
): Promise<void> {
  await mkdir(runDirPath(cwd, runId), { recursive: true });
  await writeFile(
    runMetadataPath(cwd, runId),
    `${JSON.stringify({ runId, specId: '42', planPath: options.planPath ?? '/plan.yaml', status: 'created' })}\n`,
    'utf8',
  );
}

describe('execute.runs', () => {
  it('rejects params', async () => {
    const response = await method('execute.runs').handle(
      contextFor('/tmp/none'),
      request('execute.runs', {}),
    );
    expect(response).toMatchObject({ error: { code: -32602 } });
  });

  it('lists run summaries for the invocation cwd', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-runs-'));
    await writeRun(cwd, 'run-1');

    const response = await method('execute.runs').handle(contextFor(cwd), request('execute.runs'));

    expect(response).toMatchObject({
      result: {
        runs: [
          {
            runId: 'run-1',
            specId: '42',
            status: 'created',
            presence: { worktree: false, reports: false, petri: false, promotion: false },
          },
        ],
      },
    });
  });
});

describe('execute.run', () => {
  it('rejects malformed and traversal-shaped params', async () => {
    const definition = method('execute.run');
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-run-params-'));
    for (const params of [undefined, {}, { runId: '' }, { runId: '../escape' }]) {
      const response = await definition.handle(contextFor(cwd), request('execute.run', params));
      expect(response).toMatchObject({ error: { code: -32602 } });
    }
  });

  it('fails with a named error for an unknown runId', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-run-missing-'));
    const response = await method('execute.run').handle(
      contextFor(cwd),
      request('execute.run', { runId: 'run-x' }),
    );
    expect(response).toMatchObject({ error: { code: -32011, message: UNKNOWN_RUN_ID_MESSAGE } });
  });

  it('returns the run detail projection', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-run-detail-'));
    await writeRun(cwd, 'run-1');
    await writeFile(join(runDirPath(cwd, 'run-1'), 'reports.jsonl'), '{"event":"run_ready"}\n', 'utf8');

    const response = await method('execute.run').handle(
      contextFor(cwd),
      request('execute.run', { runId: 'run-1' }),
    );

    expect(response).toMatchObject({
      result: {
        runId: 'run-1',
        planPath: '/plan.yaml',
        reportsTotal: 1,
        reportsTail: [{ event: 'run_ready' }],
        agentStreamTotal: 0,
        agentStreamTail: [],
        verifyStreamTotal: 0,
        verifyStreamTail: [],
        presence: { worktree: false, reports: true, petri: false, promotion: false },
      },
    });
  });

  it('returns normalized worker stream events without exposing artifact paths', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-run-agent-stream-'));
    await writeRun(cwd, 'run-1');
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      `${JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/plan.yaml',
        status: 'slice_execution_requested',
        activeSliceId: 'task-1',
        activeEpicId: 'frontier-1',
      })}\n`,
      'utf8',
    );
    await mkdir(join(runDirPath(cwd, 'run-1'), 'streams', 'task-1'), { recursive: true });
    await writeFile(
      join(runDirPath(cwd, 'run-1'), 'streams', 'task-1', 'agent.jsonl'),
      `${JSON.stringify({
        event: 'agent_stream',
        runId: 'run-1',
        epicId: 'frontier-1',
        sliceId: 'task-1',
        sequence: 0,
        kind: 'message',
        message: 'worker emitted text',
      })}\n`,
      'utf8',
    );

    const response = await method('execute.run').handle(
      contextFor(cwd),
      request('execute.run', { runId: 'run-1' }),
    );

    expect(response).toMatchObject({
      result: {
        agentStreamTotal: 1,
        agentStreamTail: [
          {
            event: 'agent_stream',
            runId: 'run-1',
            epicId: 'frontier-1',
            sliceId: 'task-1',
            sequence: 0,
            kind: 'message',
            message: 'worker emitted text',
          },
        ],
      },
    });
    expect(JSON.stringify(response)).not.toContain('agent.jsonl');
  });

  it('returns per-requirement status from plan mapping and run verification', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-run-requirements-'));
    const planPath = join(cwd, 'plan.yaml');
    await writeFile(
      planPath,
      `${JSON.stringify({
        spec: {
          requirements: [
            { item_id: 'REQ1', content: 'Build type root.' },
            { item_id: 'REQ2', content: 'Build command surface.' },
            { item_id: 'REQ3', content: 'Unmapped requirement.' },
          ],
          criteria: [{ item_id: 'AC1', content: 'Type root works.', verifies: ['REQ1'] }],
        },
        slices: [
          { id: 'task-1', derived_from: ['REQ1'] },
          { id: 'task-2', derived_from: ['REQ2'] },
        ],
      })}\n`,
      'utf8',
    );
    await writeRun(cwd, 'run-1', { planPath });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      `${JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath,
        status: 'slice_completed',
        completedSliceIds: ['task-1', 'task-2'],
      })}\n`,
      'utf8',
    );
    await writeFile(
      join(runDirPath(cwd, 'run-1'), 'reports.jsonl'),
      [
        JSON.stringify({ event: 'slice_test_result', sliceId: 'task-1', status: 'passed' }),
        JSON.stringify({ event: 'slice_test_result', sliceId: 'task-2', status: 'passed' }),
        '',
      ].join('\n'),
      'utf8',
    );

    const response = await method('execute.run').handle(
      contextFor(cwd),
      request('execute.run', { runId: 'run-1' }),
    );

    expect(response).toMatchObject({
      result: {
        requirements: [
          {
            requirementId: 'REQ1',
            status: 'passed',
            sliceIds: ['task-1'],
            completedSliceIds: ['task-1'],
            criterionIds: ['AC1'],
          },
          {
            requirementId: 'REQ2',
            status: 'unverified',
            sliceIds: ['task-2'],
            completedSliceIds: ['task-2'],
            criterionIds: [],
          },
          {
            requirementId: 'REQ3',
            status: 'unmapped',
            sliceIds: [],
          },
        ],
      },
    });
  });

  it('returns normalized verify stream events without exposing artifact paths', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-execute-run-verify-stream-'));
    await writeRun(cwd, 'run-1');
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      `${JSON.stringify({
        runId: 'run-1',
        specId: '42',
        planPath: '/plan.yaml',
        status: 'agent_result_ingested',
        activeSliceId: 'task-1',
        activeEpicId: 'frontier-1',
      })}\n`,
      'utf8',
    );
    await mkdir(join(runDirPath(cwd, 'run-1'), 'streams', 'task-1'), { recursive: true });
    await writeFile(
      join(runDirPath(cwd, 'run-1'), 'streams', 'task-1', 'verify.jsonl'),
      `${JSON.stringify({
        event: 'verify_stream',
        runId: 'run-1',
        epicId: 'frontier-1',
        sliceId: 'task-1',
        sequence: 0,
        kind: 'stdout',
        message: 'tests passed',
      })}\n`,
      'utf8',
    );

    const response = await method('execute.run').handle(
      contextFor(cwd),
      request('execute.run', { runId: 'run-1' }),
    );

    expect(response).toMatchObject({
      result: {
        verifyStreamTotal: 1,
        verifyStreamTail: [
          {
            event: 'verify_stream',
            runId: 'run-1',
            epicId: 'frontier-1',
            sliceId: 'task-1',
            sequence: 0,
            kind: 'stdout',
            message: 'tests passed',
          },
        ],
      },
    });
    expect(JSON.stringify(response)).not.toContain('verify.jsonl');
  });
});

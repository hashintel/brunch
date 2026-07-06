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

async function writeRun(cwd: string, runId: string): Promise<void> {
  await mkdir(runDirPath(cwd, runId), { recursive: true });
  await writeFile(
    runMetadataPath(cwd, runId),
    `${JSON.stringify({ runId, specId: '42', planPath: '/plan.yaml', status: 'created' })}\n`,
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
        presence: { worktree: false, reports: true, petri: false, promotion: false },
      },
    });
  });
});

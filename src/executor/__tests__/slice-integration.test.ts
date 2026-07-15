import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { GitSliceIntegrationPort } from '../execution-ports.js';
import { reportsPath } from '../report.js';
import { runDirPath, runMetadataPath } from '../run.js';
import { integrateSlice } from '../slice-integration.js';
import { sliceWorkspacePath } from '../slice-workspace.js';

async function writeIntegrationReadyRun(cwd: string): Promise<void> {
  const runDir = runDirPath(cwd, 'run-1');
  await mkdir(runDir, { recursive: true });
  await writeFile(
    reportsPath(cwd, 'run-1'),
    [
      JSON.stringify({ event: 'run_ready' }),
      JSON.stringify({ event: 'slice_test_result', sliceId: 'task-1', status: 'passed' }),
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    runMetadataPath(cwd, 'run-1'),
    JSON.stringify({
      runId: 'run-1',
      specId: '42',
      planPath: '/tmp/plan.yaml',
      status: 'test_result_ingested',
      worktreeDir: join(runDir, 'worktree'),
      reportsPath: reportsPath(cwd, 'run-1'),
      activeSliceId: 'task-1',
      activeEpicId: 'frontier-1',
      activeSliceWorkspaceDir: sliceWorkspacePath(cwd, 'run-1', 'task-1'),
      activeSliceBaseSha: 'base123',
    }),
    'utf8',
  );
}

describe('integrateSlice', () => {
  it('records successful integration as serial lifecycle authority', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-integrate-'));
    await writeIntegrationReadyRun(cwd);
    const calls: Parameters<GitSliceIntegrationPort['integrate']>[0][] = [];

    const result = await integrateSlice({
      cwd,
      runId: 'run-1',
      gitSliceIntegration: {
        async prepare() {
          throw new Error('not used');
        },
        async integrate(args) {
          calls.push(args);
          return {
            status: 'integrated',
            sliceCommitSha: 'slice123',
            integrationCommitSha: 'integrated123',
            sideEffects: [
              { kind: 'git_commit', path: args.sliceWorktreeDir, sha: 'slice123' },
              { kind: 'git_integrate', path: args.runWorktreeDir, sha: 'integrated123' },
            ],
          };
        },
      },
    });

    expect(calls).toEqual([
      {
        runWorktreeDir: join(runDirPath(cwd, 'run-1'), 'worktree'),
        sliceWorktreeDir: sliceWorkspacePath(cwd, 'run-1', 'task-1'),
        sliceId: 'task-1',
        baseSha: 'base123',
      },
    ]);
    expect(result).toMatchObject({ status: 'slice_integrated', integrationCommitSha: 'integrated123' });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toMatchObject({
      status: 'slice_integrated',
      integratedSliceCommits: { 'task-1': 'integrated123' },
    });
  });

  it('returns a structured conflict without advancing run.json', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-slice-conflict-'));
    await writeIntegrationReadyRun(cwd);
    const before = await readFile(runMetadataPath(cwd, 'run-1'), 'utf8');

    const result = await integrateSlice({
      cwd,
      runId: 'run-1',
      gitSliceIntegration: {
        async prepare() {
          throw new Error('not used');
        },
        async integrate() {
          return { status: 'conflict', message: 'shared.txt conflicts', sideEffects: [] };
        },
      },
    });

    expect(result).toMatchObject({
      status: 'slice_integration_conflict',
      runStatus: 'test_result_ingested',
      message: 'shared.txt conflicts',
      sideEffects: [{ kind: 'append_file', path: reportsPath(cwd, 'run-1') }],
    });
    expect(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8')).toBe(before);
  });
});

import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { abandonRun } from '../run-abandon.js';
import { runMetadataPath, type RunMetadata } from '../run.js';

async function writeRun(cwd: string, metadata: RunMetadata): Promise<void> {
  const metadataPath = runMetadataPath(cwd, metadata.runId);
  await mkdir(dirname(metadataPath), { recursive: true });
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
}

describe('abandonRun', () => {
  it('reports missing runs without side effects', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-abandon-missing-'));

    await expect(abandonRun({ cwd, runId: 'run-1' })).resolves.toEqual({
      status: 'missing_run',
      runStatus: 'not_started',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('refuses completed terminal runs', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-abandon-terminal-'));
    await writeRun(cwd, {
      runId: 'run-1',
      specId: '42',
      planPath: '/plan.json',
      status: 'promotion_prepared',
    });

    const result = await abandonRun({ cwd, runId: 'run-1' });

    expect(result).toEqual({
      status: 'terminal_run',
      runStatus: 'promotion_prepared',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
    await expect(readFile(runMetadataPath(cwd, 'run-1'), 'utf8')).resolves.toContain('promotion_prepared');
  });

  it('is idempotent for already abandoned runs', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-abandon-idempotent-'));
    await writeRun(cwd, {
      runId: 'run-1',
      specId: '42',
      planPath: '/plan.json',
      status: 'abandoned',
      abandonedAt: '2026-07-07T00:00:00.000Z',
    });

    await expect(abandonRun({ cwd, runId: 'run-1' })).resolves.toEqual({
      status: 'already_abandoned',
      runStatus: 'abandoned',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
  });

  it('marks an active run abandoned without deleting evidence fields', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-run-abandon-active-'));
    await writeRun(cwd, {
      runId: 'run-1',
      specId: '42',
      planPath: '/plan.json',
      status: 'agent_result_ingested',
      worktreeDir: '/worktree',
      reportsPath: '/reports.jsonl',
      activeSliceId: 'task-1',
    });

    const result = await abandonRun({
      cwd,
      runId: 'run-1',
      reason: 'User chose to replan',
      abandonedAt: '2026-07-07T00:00:00.000Z',
    });

    expect(result).toEqual({
      status: 'abandoned',
      runStatus: 'abandoned',
      runId: 'run-1',
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [{ kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' }],
    });
    await expect(readFile(runMetadataPath(cwd, 'run-1'), 'utf8')).resolves.toContain('"status": "abandoned"');
    await expect(readFile(runMetadataPath(cwd, 'run-1'), 'utf8')).resolves.toContain(
      '"worktreeDir": "/worktree"',
    );
    await expect(readFile(runMetadataPath(cwd, 'run-1'), 'utf8')).resolves.toContain(
      '"abandonReason": "User chose to replan"',
    );
  });
});

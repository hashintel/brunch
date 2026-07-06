import { access, mkdir, mkdtemp, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { planFilePath } from '../plan-file.js';
import {
  assertSafeRunId,
  createRun,
  persistRunMetadata,
  runDirPath,
  runMetadataPath,
  type RunMetadata,
} from '../run.js';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('createRun', () => {
  it('does not create a run when the selected spec plan is missing', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-run-missing-'));
    const result = await createRun({ cwd, specId: '42', runId: 'run-1' });

    expect(result).toEqual({
      status: 'missing_plan',
      runStatus: 'not_started',
      planPath: planFilePath(cwd, '42'),
      sideEffects: [],
    });
    expect(await pathExists(runDirPath(cwd, 'run-1'))).toBe(false);
  });

  it('creates only run metadata for a ready plan', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-run-ready-'));
    const planPath = planFilePath(cwd, '42');
    await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
    await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');

    const result = await createRun({ cwd, specId: '42', runId: 'run-1' });

    expect(result).toEqual({
      status: 'created',
      runStatus: 'created',
      runId: 'run-1',
      runDir: runDirPath(cwd, 'run-1'),
      metadataPath: runMetadataPath(cwd, 'run-1'),
      planPath,
      sideEffects: [
        { kind: 'mkdir', path: runDirPath(cwd, 'run-1') },
        { kind: 'write_file', path: runMetadataPath(cwd, 'run-1'), ifExists: 'overwrite' },
      ],
    });
    expect(JSON.parse(await readFile(runMetadataPath(cwd, 'run-1'), 'utf8'))).toEqual({
      runId: 'run-1',
      specId: '42',
      planPath,
      status: 'created',
    });
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'worktree'))).toBe(false);
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'petrinaut'))).toBe(false);
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'reports.jsonl'))).toBe(false);
    expect(await pathExists(join(cwd, '.brunch', 'cook', 'land'))).toBe(false);
  });
});

describe('persistRunMetadata', () => {
  const metadata = (status: RunMetadata['status']): RunMetadata => ({
    runId: 'run-1',
    specId: '42',
    planPath: '/plan.yaml',
    status,
  });

  it('replaces run.json with a fresh file so readers never observe a truncated write', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'brunch-cook-persist-'));
    const metadataPath = join(dir, 'run.json');

    const firstEffect = await persistRunMetadata(metadataPath, metadata('created'));
    expect(firstEffect).toEqual({ kind: 'write_file', path: metadataPath, ifExists: 'overwrite' });
    const firstInode = (await stat(metadataPath)).ino;

    await persistRunMetadata(metadataPath, metadata('worktree_created'));

    // In-place O_TRUNC writes keep the inode; write-temp+rename swaps in a new file.
    expect((await stat(metadataPath)).ino).not.toBe(firstInode);
    expect(JSON.parse(await readFile(metadataPath, 'utf8'))).toEqual(metadata('worktree_created'));
    expect(await readdir(dir)).toEqual(['run.json']);
  });

  it('leaves no temp residue when the replace fails', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'brunch-cook-persist-fail-'));
    const metadataPath = join(dir, 'run.json');
    // A non-empty directory at the destination makes rename fail after the temp write succeeds.
    await mkdir(metadataPath);
    await writeFile(join(metadataPath, 'occupied'), 'x', 'utf8');

    await expect(persistRunMetadata(metadataPath, metadata('created'))).rejects.toThrow();

    expect(await readdir(dir)).toEqual(['run.json']);
    expect(await readdir(metadataPath)).toEqual(['occupied']);
  });
});

describe('assertSafeRunId', () => {
  it('accepts flat path-segment-safe run ids', () => {
    for (const runId of ['run-1', 'run_1', 'RUN.1', 'abc123']) {
      expect(() => assertSafeRunId(runId)).not.toThrow();
    }
  });

  it('rejects run ids that would escape the runs directory', () => {
    for (const runId of ['../escape', 'a/b', '..', 'run/../..', '']) {
      expect(() => assertSafeRunId(runId)).toThrow(/invalid runId/);
    }
  });

  it('rejects traversal run ids when building run paths', () => {
    expect(() => runDirPath('/tmp/x', '../../etc')).toThrow(/invalid runId/);
  });
});

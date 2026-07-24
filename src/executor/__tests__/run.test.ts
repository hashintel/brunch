import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readdir, readFile, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { LaunchCurrentProjection } from '../launch.js';
import { planFilePath, planProvenancePath } from '../plan-file.js';
import {
  assertSafeRunId,
  createRun,
  persistRunMetadata,
  readRunMetadata,
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

const current: LaunchCurrentProjection = {
  specId: '42',
  mode: 'greenfield',
  source: { graphLsn: 11, visibility: 'active' },
  checkStatus: 'ok',
};

async function writeReadyPlan(cwd: string, graphLsn = current.source.graphLsn): Promise<string> {
  const planPath = planFilePath(cwd, '42');
  await mkdir(join(cwd, '.brunch', 'cook', 'specs', '42'), { recursive: true });
  await writeFile(planPath, '{"mode":"greenfield","epics":[],"slices":[]}', 'utf8');
  await writeFile(
    planProvenancePath(cwd, '42'),
    `${JSON.stringify({
      schemaVersion: 1,
      specId: '42',
      mode: 'greenfield',
      source: { graphLsn, visibility: 'active' },
    })}\n`,
    'utf8',
  );
  return planPath;
}

describe('createRun', () => {
  it('does not create a run when the selected spec plan is missing', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-run-missing-'));
    const result = await createRun({ cwd, specId: '42', runId: 'run-1', current });

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
    const planPath = await writeReadyPlan(cwd);

    const result = await createRun({
      cwd,
      specId: '42',
      runId: 'run-1',
      current,
      substrate: 'empty_dir',
      verifyTarget: { command: 'npm', args: ['test'] },
    });

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
      substrate: 'empty_dir',
      verifyTarget: { command: 'npm', args: ['test'] },
    });
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'worktree'))).toBe(false);
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'petrinaut'))).toBe(false);
    expect(await pathExists(join(runDirPath(cwd, 'run-1'), 'reports.jsonl'))).toBe(false);
    expect(await pathExists(join(cwd, '.brunch', 'cook', 'land'))).toBe(false);
  });

  it('does not create a run when the plan provenance is stale', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-run-stale-'));
    const planPath = await writeReadyPlan(cwd, 10);

    const result = await createRun({ cwd, specId: '42', runId: 'run-1', current });

    expect(result).toMatchObject({
      status: 'launch_not_ready',
      runStatus: 'not_started',
      planPath,
      launch: { status: 'stale_plan' },
      sideEffects: [],
    });
    expect(await pathExists(runDirPath(cwd, 'run-1'))).toBe(false);
  });

  it('refuses to overwrite an existing target run id', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-run-existing-'));
    await writeReadyPlan(cwd);
    await mkdir(runDirPath(cwd, 'run-1'), { recursive: true });
    await writeFile(
      runMetadataPath(cwd, 'run-1'),
      `${JSON.stringify({ runId: 'run-1', specId: '42', planPath: '/old-plan.json', status: 'abandoned' })}\n`,
      'utf8',
    );

    const result = await createRun({ cwd, specId: '42', runId: 'run-1', current });

    expect(result).toEqual({
      status: 'target_run_exists',
      runStatus: 'not_started',
      runId: 'run-1',
      runDir: runDirPath(cwd, 'run-1'),
      metadataPath: runMetadataPath(cwd, 'run-1'),
      sideEffects: [],
    });
    await expect(readFile(runMetadataPath(cwd, 'run-1'), 'utf8')).resolves.toContain('abandoned');
  });

  it('rejects a changed target-visible public packet before creating run state', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-run-invalid-packet-'));
    await writeReadyPlan(cwd);
    const publicDir = join(cwd, '.brunch', 'execution-comparison', 'public');
    const specification = '# Approved\n';
    const contract = '{"schemaVersion":1}\n';
    const files = [
      { path: 'public-contract.json', sha256: digest(contract) },
      { path: 'spec.md', sha256: digest(specification) },
    ];
    await mkdir(publicDir, { recursive: true });
    await writeFile(join(publicDir, 'public-contract.json'), contract, 'utf8');
    await writeFile(join(publicDir, 'spec.md'), `${specification}changed\n`, 'utf8');
    await writeFile(
      join(publicDir, 'packet-manifest.json'),
      JSON.stringify({
        schemaVersion: 1,
        packetSha256: digest(files.map((file) => `${file.path}:${file.sha256}\n`).join('')),
        files,
      }),
      'utf8',
    );

    const result = await createRun({ cwd, specId: '42', runId: 'run-1', current });

    expect(result).toEqual({
      status: 'public_packet_invalid',
      runStatus: 'not_started',
      runId: 'run-1',
      message: 'Target-visible public packet file spec.md failed hashing.',
      sideEffects: [],
    });
    expect(await pathExists(runDirPath(cwd, 'run-1'))).toBe(false);
  });

  it('rejects a partial public packet directory instead of treating it as absent', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-run-partial-packet-'));
    await writeReadyPlan(cwd);
    const publicDir = join(cwd, '.brunch', 'execution-comparison', 'public');
    await mkdir(publicDir, { recursive: true });
    await writeFile(join(publicDir, 'spec.md'), '# Spec\n', 'utf8');

    const result = await createRun({ cwd, specId: '42', runId: 'run-1', current });

    expect(result).toMatchObject({
      status: 'public_packet_invalid',
      message: 'Target-visible public packet manifest is unreadable.',
      sideEffects: [],
    });
    expect(await pathExists(runDirPath(cwd, 'run-1'))).toBe(false);
  });

  it('rejects symlinked public packet source files', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-run-source-symlink-'));
    await writeReadyPlan(cwd);
    const publicDir = join(cwd, '.brunch', 'execution-comparison', 'public');
    const outside = await mkdtemp(join(tmpdir(), 'brunch-cook-run-source-outside-'));
    const specification = '# Outside\n';
    const contract = '{"schemaVersion":1}\n';
    const files = [
      { path: 'public-contract.json', sha256: digest(contract) },
      { path: 'spec.md', sha256: digest(specification) },
    ];
    await mkdir(publicDir, { recursive: true });
    await writeFile(join(publicDir, 'public-contract.json'), contract, 'utf8');
    await writeFile(join(outside, 'spec.md'), specification, 'utf8');
    await symlink(join(outside, 'spec.md'), join(publicDir, 'spec.md'));
    await writeFile(
      join(publicDir, 'packet-manifest.json'),
      JSON.stringify({
        schemaVersion: 1,
        packetSha256: digest(files.map((file) => `${file.path}:${file.sha256}\n`).join('')),
        files,
      }),
      'utf8',
    );

    const result = await createRun({ cwd, specId: '42', runId: 'run-1', current });

    expect(result).toMatchObject({
      status: 'public_packet_invalid',
      message: 'Target-visible public packet file spec.md is invalid.',
      sideEffects: [],
    });
    expect(await pathExists(runDirPath(cwd, 'run-1'))).toBe(false);
  });

  it('rejects symlinked public packet source ancestors', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cook-run-source-ancestor-symlink-'));
    await writeReadyPlan(cwd);
    const outside = await mkdtemp(join(tmpdir(), 'brunch-cook-run-source-ancestor-outside-'));
    await symlink(outside, join(cwd, '.brunch', 'execution-comparison'));

    const result = await createRun({ cwd, specId: '42', runId: 'run-1', current });

    expect(result).toMatchObject({
      status: 'public_packet_invalid',
      message: 'Target-visible public packet directory is invalid.',
      sideEffects: [],
    });
    expect(await pathExists(runDirPath(cwd, 'run-1'))).toBe(false);
  });
});

describe('persistRunMetadata', () => {
  const metadata = (status: RunMetadata['status']): RunMetadata => ({
    runId: 'run-1',
    specId: '42',
    planPath: '/plan.json',
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

  it('rejects corrupted persisted packet paths before any slice can stage them', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'brunch-cook-corrupt-packet-metadata-'));
    const metadataPath = join(dir, 'run.json');
    await writeFile(
      metadataPath,
      JSON.stringify({
        ...metadata('created'),
        publicPacket: {
          reference: {
            path: '../../escape',
            packetSha256: `sha256:${'a'.repeat(64)}`,
            files: [],
          },
          contents: [],
        },
      }),
      'utf8',
    );

    await expect(readRunMetadata(metadataPath)).resolves.toBeUndefined();
  });
});

function digest(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

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

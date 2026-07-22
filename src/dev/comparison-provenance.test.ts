import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import {
  captureComparisonProvenance,
  parseComparisonProvenance,
  runComparisonProvenanceCli,
} from './comparison-provenance.js';

const execFileAsync = promisify(execFile);
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => await rm(root, { recursive: true, force: true })));
});

describe('comparison provenance capture', () => {
  it('captures a clean untagged controller checkout', async () => {
    const repository = await createControllerRepository();
    const result = await captureComparisonProvenance({
      runDirectory: join(repository.root, '.fixtures', 'run-clean'),
      comparisonKind: 'elicitation',
      runId: 'mission-20260722T140000Z-a1b2',
      controllerRoot: repository.root,
      capturedAt: '2026-07-22T14:00:00.000Z',
    });

    expect(result.provenance).toEqual({
      schemaVersion: 1,
      comparisonKind: 'elicitation',
      runId: 'mission-20260722T140000Z-a1b2',
      capturedAt: '2026-07-22T14:00:00.000Z',
      rootPackage: {
        name: '@hashintel/brunch-test',
        version: '1.0.0-alpha.9',
      },
      exactTag: null,
      controller: {
        commitSha: repository.commitSha,
        commitUrl: `https://github.com/hashintel/brunch/commit/${repository.commitSha}`,
        branch: 'main',
        dirty: false,
      },
    });
    expect(
      parseComparisonProvenance(JSON.parse(await readFile(result.provenancePath, 'utf8')) as unknown),
    ).toEqual(result.provenance);
  });

  it('captures an exact release tag', async () => {
    const repository = await createControllerRepository({ tag: 'v1.0.0-alpha.9' });
    const { provenance } = await captureComparisonProvenance({
      runDirectory: join(repository.root, '.fixtures', 'run-tagged'),
      comparisonKind: 'execution',
      runId: 'petri-editor-20260722T140000Z-a1b2',
      controllerRoot: repository.root,
    });

    expect(provenance.exactTag).toBe('v1.0.0-alpha.9');
    expect(provenance.rootPackage.version).toBe('1.0.0-alpha.9');
  });

  it('records dirty state before writing the provenance artifact', async () => {
    const repository = await createControllerRepository();
    await writeFile(join(repository.root, 'dirty.txt'), 'uncommitted\n');

    const { provenance } = await captureComparisonProvenance({
      runDirectory: join(repository.root, '.fixtures', 'run-dirty'),
      comparisonKind: 'end_to_end',
      runId: 'petri-e2e-20260722T140000Z',
      controllerRoot: repository.root,
    });

    expect(provenance.controller.dirty).toBe(true);
  });

  it('rejects a second write to the same run identity', async () => {
    const repository = await createControllerRepository();
    const input = {
      runDirectory: join(repository.root, '.fixtures', 'run-collision'),
      comparisonKind: 'execution' as const,
      runId: 'collision-run',
      controllerRoot: repository.root,
    };

    await captureComparisonProvenance(input);
    await expect(captureComparisonProvenance(input)).rejects.toThrow('comparison provenance already exists');
  });

  it('rejects malformed capture input and malformed retained provenance', async () => {
    const repository = await createControllerRepository();
    await expect(
      captureComparisonProvenance({
        runDirectory: join(repository.root, '.fixtures', 'run-invalid'),
        comparisonKind: 'execution',
        runId: '../escape',
        controllerRoot: repository.root,
      }),
    ).rejects.toThrow('comparison run id');
    await expect(
      runComparisonProvenanceCli([
        'capture',
        '--run-directory',
        join(repository.root, '.fixtures', 'run-invalid-kind'),
        '--comparison-kind',
        'unknown',
        '--run-id',
        'valid-run',
        '--controller-root',
        repository.root,
      ]),
    ).rejects.toThrow('comparison kind');
    expect(() =>
      parseComparisonProvenance({
        schemaVersion: 1,
        comparisonKind: 'execution',
        runId: 'valid-run',
        capturedAt: 'not-a-date',
        rootPackage: { name: '@hashintel/brunch', version: '1.0.0-alpha.9' },
        exactTag: null,
        controller: {
          commitSha: repository.commitSha,
          commitUrl: `https://github.com/hashintel/brunch/commit/${repository.commitSha}`,
          branch: 'main',
          dirty: false,
        },
      }),
    ).toThrow('canonical ISO timestamp');
  });

  it('rejects malformed root package metadata', async () => {
    const repository = await createControllerRepository();
    await writeFile(join(repository.root, 'package.json'), '{"name":"missing-version"}\n');

    await expect(
      captureComparisonProvenance({
        runDirectory: join(repository.root, '.fixtures', 'run-malformed-package'),
        comparisonKind: 'elicitation',
        runId: 'malformed-package',
        controllerRoot: repository.root,
      }),
    ).rejects.toThrow('controller root package version');
  });
});

async function createControllerRepository(input: { readonly tag?: string } = {}): Promise<{
  readonly root: string;
  readonly commitSha: string;
}> {
  const root = await mkdtemp(join(tmpdir(), 'brunch-comparison-provenance-'));
  roots.push(root);
  await writeFile(
    join(root, 'package.json'),
    `${JSON.stringify(
      {
        name: '@hashintel/brunch-test',
        version: '1.0.0-alpha.9',
        repository: {
          type: 'git',
          url: 'git+https://github.com/hashintel/brunch.git',
        },
      },
      null,
      2,
    )}\n`,
  );
  await git(root, ['init', '--initial-branch=main']);
  await git(root, ['config', 'user.name', 'Comparison Test']);
  await git(root, ['config', 'user.email', 'comparison@example.test']);
  await git(root, ['add', 'package.json']);
  await git(root, ['commit', '-m', 'fixture']);
  if (input.tag !== undefined) await git(root, ['tag', input.tag]);
  return {
    root,
    commitSha: await git(root, ['rev-parse', 'HEAD']),
  };
}

async function git(cwd: string, args: readonly string[]): Promise<string> {
  const result = await execFileAsync('git', args, { cwd, encoding: 'utf8' });
  return result.stdout.trim();
}

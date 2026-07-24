import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import { changedPathsFromGit, selectCiTestLanes } from './ci-test-lanes.mjs';

const execFileAsync = promisify(execFile);
const temporaryRoots = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(async (path) => await rm(path, { recursive: true })));
});

describe('CI test lane selection', () => {
  it('always selects comparison oracles for merge-group candidates', () => {
    expect(
      selectCiTestLanes({
        eventName: 'merge_group',
        diffComplete: true,
        changedPaths: ['memory/PLAN.md'],
      }),
    ).toMatchObject({ comparison: true, reason: 'merge-group-full-gate' });
  });

  it('omits comparison oracles for a complete closed non-runtime-only pull-request diff', () => {
    expect(
      selectCiTestLanes({
        eventName: 'pull_request',
        diffComplete: true,
        changedPaths: [
          '.agents/skills/linear-pr-cleanup/SKILL.md',
          '.changeset/quiet-oracles-rest.md',
          'docs/praxis/comparison-runs.md',
          'memory/PLAN.md',
          'AGENTS.md',
        ],
      }),
    ).toMatchObject({ comparison: false, reason: 'closed-non-runtime-diff' });
  });

  it.each([
    ['runtime source', ['src/executor/run.ts']],
    ['comparison controller', ['src/dev/execution-comparison/operator-cli.ts']],
    ['comparison fixture', ['testing/execution-comparisons/cases/example/public-contract.json']],
    ['test source', ['src/executor/__tests__/run.test.ts']],
    ['package manifest', ['package.json']],
    ['package lockfile', ['package-lock.json']],
    ['workflow', ['.github/workflows/test.yml']],
    ['build configuration', ['tsconfig.build.json']],
    ['unknown root', ['new-root-config.json']],
    ['rename crossing from runtime into docs', ['src/old.ts', 'docs/old.ts']],
    ['rename crossing from docs into runtime', ['docs/new.ts', 'src/new.ts']],
  ])('selects comparison oracles for %s changes', (_name, changedPaths) => {
    expect(
      selectCiTestLanes({
        eventName: 'pull_request',
        diffComplete: true,
        changedPaths,
      }),
    ).toMatchObject({ comparison: true, reason: 'runtime-or-unknown-path' });
  });

  it.each([
    ['incomplete diff', { eventName: 'pull_request', diffComplete: false, changedPaths: ['memory/PLAN.md'] }],
    ['empty diff', { eventName: 'pull_request', diffComplete: true, changedPaths: [] }],
    [
      'unknown event',
      { eventName: 'workflow_dispatch', diffComplete: true, changedPaths: ['memory/PLAN.md'] },
    ],
  ])('fails open for %s', (_name, input) => {
    expect(selectCiTestLanes(input)).toMatchObject({ comparison: true });
  });

  it('treats both sides of an allowlist-boundary rename as changed paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-ci-lanes-'));
    temporaryRoots.push(root);
    await execFileAsync('git', ['init', '-q', '-b', 'main'], { cwd: root });
    await execFileAsync('git', ['config', 'user.email', 'ci@brunch.invalid'], { cwd: root });
    await execFileAsync('git', ['config', 'user.name', 'Brunch CI'], { cwd: root });
    await mkdir(join(root, 'docs'));
    await writeFile(join(root, 'docs', 'note.md'), 'note\n');
    await execFileAsync('git', ['add', '--all'], { cwd: root });
    await execFileAsync('git', ['commit', '-q', '-m', 'base'], { cwd: root });
    const { stdout: baseSha } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root });

    await mkdir(join(root, 'src'));
    await rename(join(root, 'docs', 'note.md'), join(root, 'src', 'note.ts'));
    await execFileAsync('git', ['add', '--all'], { cwd: root });
    await execFileAsync('git', ['commit', '-q', '-m', 'rename'], { cwd: root });
    const { stdout: headSha } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root });

    const diff = await changedPathsFromGit({
      baseSha: baseSha.trim(),
      headSha: headSha.trim(),
      cwd: root,
    });

    expect(diff).toEqual({
      complete: true,
      paths: ['docs/note.md', 'src/note.ts'],
    });
    expect(
      selectCiTestLanes({
        eventName: 'pull_request',
        diffComplete: diff.complete,
        changedPaths: diff.paths,
      }),
    ).toMatchObject({ comparison: true });
  });
});

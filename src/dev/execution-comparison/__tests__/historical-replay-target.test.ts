import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runCommand } from '../../../app/command-runner.js';
import { openWorkspaceDb } from '../../../graph/index.js';
import { queryGraph } from '../../../graph/queries.js';
import { prepareHistoricalReplayTarget } from '../historical-replay-target.js';
import { prepareExecutionTarget, resolveExecutionCase } from '../operator-cli.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => await rm(root, { recursive: true, force: true })));
});

describe('learning-first historical replay preparation', () => {
  it('creates a remote-free Brunch target from the pinned tree and exact packet', async () => {
    const fixture = await createBrunchFixture();
    const selected = await resolveExecutionCase('brunch-host-landing', fixture.casesRoot);
    let installCalled = false;
    const ready = await prepareHistoricalReplayTarget(
      {
        lane: 'brunch',
        selectedCase: selected,
        sourceRepositoryDir: fixture.sourceDir,
        targetDir: fixture.targetDir,
        controllerRoot: fixture.controllerDir,
      },
      {
        dependencyInstallRunner: async () => {
          installCalled = true;
          return { exitCode: 0, stdout: '', stderr: '' };
        },
      },
    );
    if (ready.lane !== 'brunch') throw new Error('expected Brunch target');

    expect(ready).toMatchObject({
      status: 'ready',
      caseId: 'brunch-host-landing-v1',
      sourceCommit: fixture.sourceCommit,
      sourceTree: fixture.sourceTree,
      dependencyPreparation: { recipe: 'none', status: 'not_required' },
      launch: {
        command: 'npx',
        args: expect.arrayContaining(['--workspace', fixture.targetDir, '--spec-id']),
      },
    });
    expect(ready.launch.args).not.toContain('--solution-isolation');
    expect(await git(fixture.targetDir, ['remote'])).toBe('');
    expect(await readFile(join(fixture.targetDir, 'spec.md'))).toEqual(fixture.specification);
    expect(installCalled).toBe(false);
    const graph = queryGraph(await openWorkspaceDb(fixture.targetDir), ready.specId);
    expect(graph.nodes.find(({ source }) => source === 'e2e-handoff [exact-spec]')).toMatchObject({
      kind: 'requirement',
      body: fixture.specification.toString('utf8'),
    });
  }, 30_000);

  it('returns a restricted Claude launch from the same pinned packet', async () => {
    const fixture = await createBrunchFixture();
    const ready = await prepareExecutionTarget({
      lane: 'claude_code',
      caseReference: 'brunch-host-landing',
      casesRoot: fixture.casesRoot,
      sourceRepositoryDir: fixture.sourceDir,
      targetDir: fixture.targetDir,
      controllerRoot: fixture.controllerDir,
    });
    if (ready.lane !== 'claude_code' || ready.preparation !== 'historical_replay') {
      throw new Error('expected historical Claude target');
    }

    expect(ready.launch.args).toEqual(
      expect.arrayContaining(['--strict-mcp-config', '--disallowedTools', 'WebFetch,WebSearch']),
    );
    expect(JSON.stringify(ready.launch)).toContain(fixture.sourceDir);
    expect(await git(fixture.targetDir, ['remote'])).toBe('');
  }, 30_000);

  it('removes an owned target when pinned source identity is wrong', async () => {
    const fixture = await createBrunchFixture();
    const selected = await resolveExecutionCase('brunch-host-landing', fixture.casesRoot);
    Object.assign(selected.packet.contract.case.repository, { parentTree: 'f'.repeat(40) });

    await expect(
      prepareHistoricalReplayTarget({
        lane: 'claude_code',
        selectedCase: selected,
        sourceRepositoryDir: fixture.sourceDir,
        targetDir: fixture.targetDir,
        controllerRoot: fixture.controllerDir,
      }),
    ).rejects.toMatchObject({ status: 'setup_failed', phase: 'source_materialization' });
    await expect(readFile(join(fixture.targetDir, 'spec.md'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

async function createBrunchFixture(): Promise<{
  readonly casesRoot: string;
  readonly controllerDir: string;
  readonly sourceDir: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly targetDir: string;
  readonly specification: Buffer;
}> {
  const root = await mkdtemp(join(tmpdir(), 'brunch-historical-replay-'));
  roots.push(root);
  const sourceDir = join(root, 'source');
  const controllerDir = join(root, 'controller');
  const casesRoot = join(root, 'cases');
  const caseDir = join(casesRoot, 'brunch-host-landing');
  const targetDir = join(root, 'target');
  await Promise.all([mkdir(sourceDir), mkdir(controllerDir), mkdir(caseDir, { recursive: true })]);
  await writeFile(join(sourceDir, 'package.json'), '{"name":"historical-source","private":true}\n');
  await writeFile(join(sourceDir, 'source.ts'), 'export const historical = true;\n');
  await git(sourceDir, ['init', '--initial-branch=main']);
  await git(sourceDir, ['add', '--all']);
  await git(sourceDir, [
    '-c',
    'user.name=Historical Fixture',
    '-c',
    'user.email=historical@example.invalid',
    'commit',
    '-m',
    'Pinned source',
  ]);
  const sourceCommit = await git(sourceDir, ['rev-parse', 'HEAD']);
  const sourceTree = await git(sourceDir, ['rev-parse', 'HEAD^{tree}']);
  const specification = Buffer.from('# Exact approved host landing specification\n\nBytes survive.  \n');
  await writeFile(join(caseDir, 'spec.md'), specification);
  await writeFile(
    join(caseDir, 'public-contract.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        case: {
          id: 'brunch-host-landing-v1',
          specification: 'spec.md',
          specificationSha256: createHash('sha256').update(specification).digest('hex'),
          provider: 'anthropic',
          model: 'claude-opus-4-8',
          product: 'brunch',
          mode: 'brownfield',
          scope: 'single_feature',
          surface: 'backend',
          repository: { substrate: 'pinned_git', parentCommit: sourceCommit, parentTree: sourceTree },
        },
        budgets: { elapsedMinutes: 90, mechanicalInterventions: 2, substantiveHumanInterventions: 0 },
        delivery: { runtimeNetwork: 'forbidden', dependencyInstallNetwork: 'forbidden' },
        acceptance: { publicCommand: '/brunch:land', executionTerminal: 'promotion_prepared' },
        rules: ['Work only in the target repository.', 'Stop after promotion_prepared without landing.'],
      },
      null,
      2,
    )}\n`,
  );
  return { casesRoot, controllerDir, sourceDir, sourceCommit, sourceTree, targetDir, specification };
}

async function git(cwd: string, args: readonly string[]): Promise<string> {
  const result = await runCommand('git', args, { cwd });
  if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { runCommand, type CommandRunner } from '../../../app/command-runner.js';
import {
  PINNED_DEPENDENCY_PREPARATION,
  preparePinnedExecutionWorkspace,
} from '../../end-to-end-comparison/pinned-source-preparation.js';

const HASH_PARENT_COMMIT = '5c7a2d9db5caa851c38938f4b1bac19005b0e978';
const HASH_PARENT_TREE = 'a3e08cf75e00cc9016c931f4665341506e03533e';
const sourceRepositoryDir = fileURLToPath(new URL('../../../../../hash/', import.meta.url));
const contractTemplatePath = fileURLToPath(
  new URL(
    '../../../../testing/execution-comparisons/cases/petrinaut-optimization/public-contract.json',
    import.meta.url,
  ),
);
const roots: string[] = [];

afterAll(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map(async (root) => await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })),
  );
}, 60_000);

describe('pinned HASH source preparation', () => {
  it('gives Brunch and Claude separate history-free materializations of the same full parent tree', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-petrinaut-pinned-source-'));
    roots.push(root);
    const controllerRoot = join(root, 'controller');
    const handoffRoot = join(root, 'handoff');
    await Promise.all([mkdir(controllerRoot), mkdir(handoffRoot)]);
    const specification = Buffer.from('# Exact approved specification\n\nSpacing survives.  \n');
    const specificationPath = join(handoffRoot, 'spec.md');
    await writeFile(specificationPath, specification);
    const installs: { command: string; args: readonly string[]; cwd: string }[] = [];
    const dependencyInstallRunner: CommandRunner = async (command, args, options) => {
      installs.push({ command, args, cwd: options.cwd });
      return { exitCode: 0, stdout: '', stderr: '' };
    };

    const prepared = await Promise.all(
      (['brunch', 'claude_code'] as const).map(
        async (lane) =>
          await preparePinnedExecutionWorkspace({
            lane,
            sourceRepositoryDir,
            sourceCommit: HASH_PARENT_COMMIT,
            expectedSourceTree: HASH_PARENT_TREE,
            targetDir: join(root, lane),
            controllerRoot,
            specificationPath,
            publicContractTemplatePath: contractTemplatePath,
            dependencyInstallRunner,
          }),
      ),
    );

    for (const target of prepared) {
      expect(target).toMatchObject({
        sourceCommit: HASH_PARENT_COMMIT,
        sourceTree: HASH_PARENT_TREE,
        lane: expect.stringMatching(/^(?:brunch|claude_code)$/u),
      });
      expect(await git(target.targetDir, ['rev-list', '--count', 'HEAD'])).toBe('2');
      expect(await git(target.targetDir, ['rev-parse', `${target.materializedCommit}^{tree}`])).not.toBe(
        target.sourceTree,
      );
      expect(await git(target.targetDir, ['remote'])).toBe('');
      expect(await git(target.targetDir, ['for-each-ref', '--format=%(refname)'])).toBe('refs/heads/main');
      expect(await git(target.targetDir, ['status', '--porcelain'])).toBe('');
      expect(
        (await git(target.targetDir, ['diff', '--name-only', target.materializedCommit, target.baseSha]))
          .split('\n')
          .filter(Boolean)
          .sort(),
      ).toEqual(['public-contract.json', 'spec.md']);
      expect(await readFile(join(target.targetDir, 'spec.md'))).toEqual(specification);
      expect(JSON.parse(await readFile(join(target.targetDir, '.comparison-source.json'), 'utf8'))).toEqual({
        recipeVersion: 1,
        sourceCommit: HASH_PARENT_COMMIT,
        sourceTree: HASH_PARENT_TREE,
      });
      expect(target.baseSha).not.toBe(target.materializedCommit);
      expect(target.dependencyPreparation).toEqual({
        ...PINNED_DEPENDENCY_PREPARATION,
        status: 'passed',
        exitCode: 0,
      });
    }
    expect(prepared.map(({ targetDir }) => targetDir)).toEqual([
      join(root, 'brunch'),
      join(root, 'claude_code'),
    ]);
    expect(installs.sort((left, right) => left.cwd.localeCompare(right.cwd))).toEqual(
      prepared
        .map(({ targetDir }) => ({
          command: 'corepack',
          args: ['yarn', 'install', '--immutable', '--mode=skip-build'],
          cwd: targetDir,
        }))
        .sort((left, right) => left.cwd.localeCompare(right.cwd)),
    );
  }, 120_000);

  it.each([
    [
      'install failure',
      async (): Promise<CommandRunner> => async () => ({
        exitCode: 23,
        stdout: '',
        stderr: 'immutable install failed',
      }),
      'controller dependency preparation failed (23)',
    ],
    [
      'tracked mutation',
      async (): Promise<CommandRunner> => async (_command, _args, options) => {
        await writeFile(join(options.cwd, 'package.json'), '{"mutated":true}\n');
        return { exitCode: 0, stdout: '', stderr: '' };
      },
      'modified tracked source',
    ],
  ])('fails closed and removes the target after %s', async (_name, createRunner, message) => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-pinned-install-failure-'));
    roots.push(root);
    const source = await createTinyPinnedSource(root);
    const controllerRoot = join(root, 'controller');
    const handoffRoot = join(root, 'handoff');
    const targetDir = join(root, 'target');
    await Promise.all([mkdir(controllerRoot), mkdir(handoffRoot)]);
    const specificationPath = join(handoffRoot, 'spec.md');
    await writeFile(specificationPath, '# Exact approved specification\n');

    await expect(
      preparePinnedExecutionWorkspace({
        lane: 'claude_code',
        sourceRepositoryDir: source.repositoryDir,
        sourceCommit: source.commit,
        expectedSourceTree: source.tree,
        targetDir,
        controllerRoot,
        specificationPath,
        publicContractTemplatePath: contractTemplatePath,
        dependencyInstallRunner: await createRunner(),
      }),
    ).rejects.toThrow(message);
    await expect(readFile(join(targetDir, 'package.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

async function git(cwd: string, args: readonly string[]): Promise<string> {
  const result = await runCommand('git', args, { cwd });
  if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

async function createTinyPinnedSource(root: string): Promise<{
  readonly repositoryDir: string;
  readonly commit: string;
  readonly tree: string;
}> {
  const repositoryDir = join(root, 'source');
  await mkdir(repositoryDir);
  await writeFile(join(repositoryDir, 'package.json'), '{"private":true}\n');
  await git(repositoryDir, ['init', '--initial-branch=main']);
  await git(repositoryDir, ['add', '--all']);
  await git(repositoryDir, [
    '-c',
    'user.name=Comparison Test',
    '-c',
    'user.email=comparison@example.invalid',
    'commit',
    '-m',
    'source',
  ]);
  return {
    repositoryDir,
    commit: await git(repositoryDir, ['rev-parse', 'HEAD']),
    tree: await git(repositoryDir, ['rev-parse', 'HEAD^{tree}']),
  };
}

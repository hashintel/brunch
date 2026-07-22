import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { runCommand, type CommandRunner } from '../../../app/command-runner.js';
import {
  assertExecuteProjectionPlanReady,
  projectExecuteGraph,
} from '../../../executor/execute-projection.js';
import { openWorkspaceDb } from '../../../graph/index.js';
import { queryGraph } from '../../../graph/queries.js';
import {
  parseExecutionComparisonArgs,
  resolvePinnedBrunchPreflight,
} from '../../execution-comparison-brunch.js';
import { runExecutionComparisonOperatorCli } from '../../execution-comparison-operator.js';
import { listExecutionCases, prepareExecutionTarget, resolveExecutionCase } from '../operator-cli.js';

const casesRoot = fileURLToPath(new URL('../../../../testing/execution-comparisons/cases/', import.meta.url));
const frozenCase = join(casesRoot, 'minimal-petri-net-editor');
const controllerRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const hashSourceRepository = fileURLToPath(new URL('../../../../../hash/', import.meta.url));

describe('execution comparison operator case selection', () => {
  it('lists and resolves eligible case ids only inside the cases root', async () => {
    await expect(listExecutionCases(casesRoot)).resolves.toEqual([
      {
        caseId: 'brunch-host-landing-v1',
        directoryId: 'brunch-host-landing',
      },
      {
        caseId: 'minimal-petri-net-editor-v1',
        directoryId: 'minimal-petri-net-editor',
      },
      {
        caseId: 'petrinaut-optimization-v1',
        directoryId: 'petrinaut-optimization',
      },
    ]);
    await expect(resolveExecutionCase('minimal-petri-net-editor', casesRoot)).resolves.toMatchObject({
      caseId: 'minimal-petri-net-editor-v1',
      directoryId: 'minimal-petri-net-editor',
      caseDir: frozenCase,
    });
    await expect(resolveExecutionCase('petrinaut-optimization-v1', casesRoot)).resolves.toMatchObject({
      caseId: 'petrinaut-optimization-v1',
      directoryId: 'petrinaut-optimization',
    });
  });

  it.each(['/tmp/minimal-petri-net-editor', '../minimal-petri-net-editor', 'controller', 'x/controller/y'])(
    'rejects unsafe case reference %s',
    async (reference) => {
      await expect(resolveExecutionCase(reference, casesRoot)).rejects.toThrow(
        /absolute|traversal|controller|case id/u,
      );
    },
  );

  it('rejects an ambiguous public case id without guessing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-execution-case-selection-'));
    try {
      await cp(frozenCase, join(root, 'first'), { recursive: true });
      await cp(frozenCase, join(root, 'second'), { recursive: true });

      await expect(resolveExecutionCase('minimal-petri-net-editor-v1', root)).rejects.toThrow(
        'ambiguous execution case id',
      );
      await expect(resolveExecutionCase('first', root)).resolves.toMatchObject({
        directoryId: 'first',
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('does not follow case or public-file symlinks', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-execution-case-symlink-'));
    try {
      await symlink(frozenCase, join(root, 'linked-case'));
      const linkedFiles = join(root, 'linked-files');
      await mkdir(linkedFiles);
      await symlink(join(frozenCase, 'spec.md'), join(linkedFiles, 'spec.md'));
      await symlink(join(frozenCase, 'public-contract.json'), join(linkedFiles, 'public-contract.json'));

      await expect(listExecutionCases(root)).resolves.toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('execution comparison target preparation', () => {
  it.each(['brunch', 'claude_code'] as const)(
    'keeps controller material out of a fresh %s target',
    async (lane) => {
      const root = await mkdtemp(join(tmpdir(), `brunch-execution-${lane}-`));
      const targetDir = join(root, 'target');
      try {
        const prepared = await prepareExecutionTarget({
          lane,
          caseReference: 'minimal-petri-net-editor',
          casesRoot,
          targetDir,
        });
        const paths = await readdir(targetDir, { recursive: true });

        expect(paths.some((path) => path.toLowerCase().includes('controller'))).toBe(false);
        expect(prepared.packet.files.map((file) => file.path)).toEqual(['public-contract.json', 'spec.md']);
        if (prepared.preparation === 'empty_git') {
          expect(await readFile(join(targetDir, 'spec.md'), 'utf8')).toBe(
            await readFile(join(frozenCase, 'spec.md'), 'utf8'),
          );
          expect(await readFile(join(targetDir, 'public-contract.json'), 'utf8')).toBe(
            await readFile(join(frozenCase, 'public-contract.json'), 'utf8'),
          );
          expect(prepared.baseSha).toMatch(/^[a-f0-9]{40}$/u);
        } else if (prepared.preparation === 'legacy_brunch') {
          expect(prepared.specId).toBe(1);
        }
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );

  it('requires the explicit source repository only for pinned cases', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-pinned-source-option-'));
    try {
      await expect(
        runExecutionComparisonOperatorCli([
          'prepare',
          '--case',
          'petrinaut-optimization-v1',
          '--lane',
          'claude_code',
          '--target',
          join(root, 'petrinaut'),
        ]),
      ).rejects.toThrow('requires --source-repository');
      await expect(
        runExecutionComparisonOperatorCli([
          'prepare',
          '--case',
          'minimal-petri-net-editor-v1',
          '--lane',
          'claude_code',
          '--target',
          join(root, 'petri'),
          '--source-repository',
          hashSourceRepository,
        ]),
      ).rejects.toThrow('valid only for pinned execution cases');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects pinned targets overlapping controller or source roots before materialization', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-pinned-source-boundary-'));
    const sourceRoot = join(root, 'source');
    const sourceLink = join(root, 'source-link');
    await mkdir(sourceRoot);
    await symlink(sourceRoot, sourceLink);
    try {
      await expect(
        prepareExecutionTarget({
          lane: 'claude_code',
          caseReference: 'petrinaut-optimization-v1',
          casesRoot,
          targetDir: join(root, 'relative-source-target'),
          controllerRoot,
          sourceRepositoryDir: 'relative-source',
          dependencyInstallRunner: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
        }),
      ).rejects.toThrow('must be an absolute path');
      await expect(
        prepareExecutionTarget({
          lane: 'claude_code',
          caseReference: 'petrinaut-optimization-v1',
          casesRoot,
          targetDir: join(controllerRoot, '.unsafe-petrinaut-target'),
          controllerRoot,
          sourceRepositoryDir: sourceRoot,
          dependencyInstallRunner: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
        }),
      ).rejects.toThrow('controller and target roots must be disjoint');
      await expect(
        prepareExecutionTarget({
          lane: 'claude_code',
          caseReference: 'petrinaut-optimization-v1',
          casesRoot,
          targetDir: join(root, 'linked-source-target'),
          controllerRoot,
          sourceRepositoryDir: sourceLink,
          dependencyInstallRunner: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
        }),
      ).rejects.toThrow('real directory, not a symlink');
      await expect(
        prepareExecutionTarget({
          lane: 'claude_code',
          caseReference: 'petrinaut-optimization-v1',
          casesRoot,
          targetDir: join(sourceRoot, 'target'),
          controllerRoot,
          sourceRepositoryDir: sourceRoot,
          dependencyInstallRunner: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
        }),
      ).rejects.toThrow('controller and target roots must be disjoint');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each(['brunch', 'claude_code'] as const)(
    'materializes and controller-installs the pinned Petrinaut source for %s',
    async (lane) => {
      const root = await mkdtemp(join(tmpdir(), `brunch-petrinaut-operator-${lane}-`));
      const targetDir = join(root, 'target');
      const installCalls: { command: string; args: readonly string[]; cwd: string }[] = [];
      const installRunner: CommandRunner = async (command, args, options) => {
        installCalls.push({ command, args, cwd: options.cwd });
        return { exitCode: 0, stdout: '', stderr: '' };
      };
      try {
        const prepared = await prepareExecutionTarget({
          lane,
          caseReference: 'petrinaut-optimization-v1',
          casesRoot,
          targetDir,
          controllerRoot,
          sourceRepositoryDir: hashSourceRepository,
          dependencyInstallRunner: installRunner,
        });

        expect(prepared).toMatchObject({
          lane,
          caseId: 'petrinaut-optimization-v1',
          sourceCommit: '5c7a2d9db5caa851c38938f4b1bac19005b0e978',
          sourceTree: 'a3e08cf75e00cc9016c931f4665341506e03533e',
          dependencyPreparation: {
            command: 'corepack',
            args: ['yarn', 'install', '--immutable', '--mode=skip-build'],
            status: 'passed',
            exitCode: 0,
          },
        });
        expect(installCalls).toEqual([
          {
            command: 'corepack',
            args: ['yarn', 'install', '--immutable', '--mode=skip-build'],
            cwd: targetDir,
          },
        ]);
        expect(await readFile(join(targetDir, 'spec.md'))).toEqual(
          await readFile(join(casesRoot, 'petrinaut-optimization', 'spec.md')),
        );
        expect(await readFile(join(targetDir, 'public-contract.json'))).toEqual(
          await readFile(join(casesRoot, 'petrinaut-optimization', 'public-contract.json')),
        );
        expect(await git(targetDir, ['rev-list', '--count', 'HEAD'])).toBe('2');
        expect(await git(targetDir, ['remote'])).toBe('');
        expect(await git(targetDir, ['for-each-ref', '--format=%(refname)'])).toBe('refs/heads/main');
        expect(await git(targetDir, ['status', '--porcelain', '--untracked-files=no'])).toBe('');
        if (lane === 'brunch') {
          expect(prepared).toMatchObject({ lane: 'brunch', specId: expect.any(Number) });
          if (!('specId' in prepared)) throw new Error('pinned Brunch preparation omitted specId');
          expect(prepared.specId).toBeGreaterThan(0);
          await expect(
            resolvePinnedBrunchPreflight({
              workspaceDir: prepared.targetDir,
              specId: prepared.specId,
            }),
          ).resolves.toEqual({
            action: 'newSession',
            specId: prepared.specId,
          });
          expect(
            parseExecutionComparisonArgs([
              '--workspace',
              prepared.targetDir,
              '--spec-id',
              String(prepared.specId),
              '--solution-isolation',
              'v1',
              '--forbidden-root',
              controllerRoot,
            ]),
          ).toEqual({
            workspaceDir: prepared.targetDir,
            specId: prepared.specId,
            forbiddenRoots: [controllerRoot],
            solutionIsolation: 'v1',
          });
          const db = await openWorkspaceDb(targetDir);
          const graph = queryGraph(db, prepared.specId);
          expect(graph.nodes.find(({ source }) => source === 'e2e-handoff [exact-spec]')).toMatchObject({
            kind: 'requirement',
            body: await readFile(join(targetDir, 'spec.md'), 'utf8'),
          });
          const projection = projectExecuteGraph({
            specId: prepared.specId,
            graphLsn: graph.lsn,
            mode: 'brownfield',
            nodes: graph.nodes,
            edges: graph.edges,
          });
          expect(() => assertExecuteProjectionPlanReady(projection)).not.toThrow();
        } else {
          expect('specId' in prepared).toBe(false);
        }
      } finally {
        await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
      }
    },
    120_000,
  );
});

async function git(cwd: string, args: readonly string[]): Promise<string> {
  const result = await runCommand('git', args, { cwd });
  if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

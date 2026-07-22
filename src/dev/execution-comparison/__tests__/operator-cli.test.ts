import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { runExecutionComparisonOperatorCli } from '../../execution-comparison-operator.js';
import { listExecutionCases, prepareExecutionTarget, resolveExecutionCase } from '../operator-cli.js';

const casesRoot = fileURLToPath(new URL('../../../../testing/execution-comparisons/cases/', import.meta.url));
const frozenCase = join(casesRoot, 'minimal-petri-net-editor');
const controllerRoot = fileURLToPath(new URL('../../../../', import.meta.url));

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
          controllerRoot,
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
        prepareExecutionTarget(
          {
            lane: 'claude_code',
            caseReference: 'petrinaut-optimization-v1',
            casesRoot,
            targetDir: join(root, 'relative-source-target'),
            controllerRoot,
            sourceRepositoryDir: 'relative-source',
          },
          {
            dependencyInstallRunner: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
          },
        ),
      ).rejects.toThrow('must be an absolute path');
      await expect(
        prepareExecutionTarget(
          {
            lane: 'claude_code',
            caseReference: 'petrinaut-optimization-v1',
            casesRoot,
            targetDir: join(controllerRoot, '.unsafe-petrinaut-target'),
            controllerRoot,
            sourceRepositoryDir: sourceRoot,
          },
          {
            dependencyInstallRunner: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
          },
        ),
      ).rejects.toThrow('controller and target roots must be disjoint');
      await expect(
        prepareExecutionTarget(
          {
            lane: 'claude_code',
            caseReference: 'petrinaut-optimization-v1',
            casesRoot,
            targetDir: join(root, 'linked-source-target'),
            controllerRoot,
            sourceRepositoryDir: sourceLink,
          },
          {
            dependencyInstallRunner: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
          },
        ),
      ).rejects.toThrow('real directory, not a symlink');
      await expect(
        prepareExecutionTarget(
          {
            lane: 'claude_code',
            caseReference: 'petrinaut-optimization-v1',
            casesRoot,
            targetDir: join(sourceRoot, 'target'),
            controllerRoot,
            sourceRepositoryDir: sourceRoot,
          },
          {
            dependencyInstallRunner: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
          },
        ),
      ).rejects.toThrow('controller and target roots must be disjoint');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('Petrinaut preflight operator command', () => {
  it('requires absolute closed roots and dispatches no provider or arbitrary command input', async () => {
    const root = await mkdtemp(join(tmpdir(), 'brunch-preflight-cli-'));
    const sourceRepositoryDir = join(root, 'source');
    const workRoot = join(root, 'work');
    const outputRoot = join(root, 'evidence');
    await Promise.all([mkdir(sourceRepositoryDir), mkdir(workRoot), mkdir(outputRoot)]);
    const parentTargetDir = join(workRoot, 'parent');
    const referenceTargetDir = join(workRoot, 'reference');
    const calls: unknown[] = [];
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      await runExecutionComparisonOperatorCli(
        [
          'petrinaut-preflight',
          '--source-repository',
          sourceRepositoryDir,
          '--parent-target',
          parentTargetDir,
          '--reference-target',
          referenceTargetDir,
          '--output-root',
          outputRoot,
        ],
        {
          runPetrinautPreflight: async (input) => {
            calls.push(input);
            return {
              receiptFile: join(outputRoot, 'petrinaut-historical-preflight-receipt.json'),
              receipt: {
                schemaVersion: 1,
                caseId: 'petrinaut-optimization-v1',
                status: 'passed',
                setupStatus: 'valid',
                commandTrace: [
                  'prepare_parent_target',
                  'materialize_reference',
                  'prepare_reference_dependencies',
                  'run_compiled_oracle',
                  'cleanup_workspaces',
                ],
                cleanup: {
                  parentWorkspace: 'removed',
                  referenceWorkspace: 'removed',
                },
                evidence: {},
              },
            };
          },
        },
      );

      expect(calls).toEqual([
        {
          sourceRepositoryDir,
          parentTargetDir,
          referenceTargetDir,
          outputRoot,
        },
      ]);
      expect(JSON.stringify(calls)).not.toMatch(/claude|brunch.*provider|command|referenceCommit/iu);
      await expect(
        runExecutionComparisonOperatorCli(
          [
            'petrinaut-preflight',
            '--source-repository',
            sourceRepositoryDir,
            '--parent-target',
            parentTargetDir,
            '--reference-target',
            referenceTargetDir,
            '--output-root',
            outputRoot,
          ],
          {
            runPetrinautPreflight: async () => ({
              receiptFile: join(outputRoot, 'invalid-receipt.json'),
              receipt: {
                schemaVersion: 1,
                caseId: 'petrinaut-optimization-v1',
                status: 'setup_failed',
                setupStatus: 'invalid',
                commandTrace: [
                  'prepare_parent_target',
                  'materialize_reference',
                  'prepare_reference_dependencies',
                  'run_compiled_oracle',
                  'cleanup_workspaces',
                ],
                cleanup: {
                  parentWorkspace: 'not_created',
                  referenceWorkspace: 'not_created',
                },
                evidence: {},
                failure: {
                  phase: 'parent_preparation',
                  messageSha256: `sha256:${'f'.repeat(64)}`,
                },
              },
            }),
          },
        ),
      ).rejects.toThrow('setup_failed');
      await expect(
        runExecutionComparisonOperatorCli(
          [
            'petrinaut-preflight',
            '--source-repository',
            'relative-source',
            '--parent-target',
            parentTargetDir,
            '--reference-target',
            referenceTargetDir,
            '--output-root',
            outputRoot,
          ],
          { runPetrinautPreflight: async () => Promise.reject(new Error('must not dispatch')) },
        ),
      ).rejects.toThrow('absolute');
      await expect(
        runExecutionComparisonOperatorCli([
          'petrinaut-preflight',
          '--source-repository',
          sourceRepositoryDir,
          '--parent-target',
          parentTargetDir,
          '--reference-target',
          referenceTargetDir,
          '--output-root',
          outputRoot,
          '--command',
          'yarn anything',
        ]),
      ).rejects.toThrow('unknown execution comparison operator option: --command');
    } finally {
      stdout.mockRestore();
      await rm(root, { recursive: true, force: true });
    }
  });
});

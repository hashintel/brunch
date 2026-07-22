import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { runCommand, type CommandRunner } from '../../../app/command-runner.js';
import { createNetworkDeniedCommandRunner } from '../../end-to-end-comparison/solution-isolation.js';
import { resolveExecutionCase, type ResolvedExecutionCase } from '../operator-cli.js';
import {
  PETRINAUT_HISTORICAL_REFERENCE_COMMIT,
  parsePetrinautHistoricalPreflightReceipt,
  runPetrinautHistoricalPreflight,
  type PetrinautHistoricalPreflightDependencies,
} from '../petrinaut-historical-preflight.js';

const roots: string[] = [];
const frozenCasesRoot = fileURLToPath(
  new URL('../../../../testing/execution-comparisons/cases/', import.meta.url),
);
const frozenParentCommit = '5c7a2d9db5caa851c38938f4b1bac19005b0e978';
const frozenParentTree = 'a3e08cf75e00cc9016c931f4665341506e03533e';

afterEach(async () => {
  await Promise.all(roots.splice(0).map(async (root) => await rm(root, { recursive: true, force: true })));
});

describe('Petrinaut historical provider preflight', () => {
  it('prepares the parent, calibrates a disjoint reference, retains redacted evidence, and cleans up', async () => {
    const fixture = await createFixture();
    const selectedCase = await selectedCaseForFixture(fixture);
    const order: string[] = [];
    const forbiddenRootCalls: string[][] = [];
    let parentRemovedBeforeReferenceInstall = false;

    const result = await runPetrinautHistoricalPreflight(
      {
        sourceRepositoryDir: fixture.sourceDir,
        parentTargetDir: fixture.parentTargetDir,
        referenceTargetDir: fixture.referenceTargetDir,
        controllerRoot: fixture.controllerDir,
        receiptFile: fixture.receiptFile,
      },
      {
        runner: fixtureRunner(fixture),
        selectedCase,
        referenceCommit: fixture.referenceCommit,
        dependencyInstallRunner: async (command, args, options) => {
          order.push(options.cwd === fixture.parentTargetDir ? 'parent-install' : 'reference-install');
          expect({ command, args }).toEqual({
            command: 'corepack',
            args: ['yarn', 'install', '--immutable', '--mode=skip-build'],
          });
          if (options.cwd === fixture.referenceTargetDir) {
            try {
              await readFile(fixture.parentTargetDir);
            } catch (error) {
              parentRemovedBeforeReferenceInstall =
                typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
            }
          }
          await writeFile(join(options.cwd, '.pnp.cjs'), '// immutable install artifact\n');
          return {
            exitCode: 0,
            stdout: `installed ${options.cwd}\n`,
            stderr: 'bounded warning\n',
          };
        },
        createVerifier: (forbiddenRoots) => {
          forbiddenRootCalls.push([...forbiddenRoots]);
          return createNetworkDeniedCommandRunner({
            platform: 'darwin',
            forbiddenReadRoots: forbiddenRoots,
            run: fakeSandboxRunner,
          });
        },
        loadOraclePack: async () => ({
          oracleId: 'petrinaut-optimization-oracles-v1',
          packSha256: `sha256:${'c'.repeat(64)}`,
        }),
        runOracle: async ({ candidateRoot }) => {
          order.push('oracle');
          expect(candidateRoot).toBe(fixture.referenceTargetDir);
          return passingOracleReport();
        },
      },
    );

    expect(PETRINAUT_HISTORICAL_REFERENCE_COMMIT).toBe('276e17d7b0f80c8a80d5abe01849bbb67c6169d0');
    expect(order).toEqual(['parent-install', 'reference-install', 'oracle']);
    expect(forbiddenRootCalls).toHaveLength(1);
    expect(forbiddenRootCalls[0]).toContain(fixture.referenceTargetDir);
    expect(parentRemovedBeforeReferenceInstall).toBe(true);
    expect(result.receipt).toMatchObject({
      schemaVersion: 1,
      caseId: 'petrinaut-optimization-v1',
      status: 'passed',
      setupStatus: 'valid',
      parent: {
        sourceCommit: frozenParentCommit,
        sourceTree: frozenParentTree,
        dependencyPreparation: {
          recipe: 'petrinaut-yarn-immutable-v1',
          status: 'passed',
          exitCode: 0,
        },
      },
      reference: {
        sourceCommit: fixture.referenceCommit,
        sourceTree: fixture.referenceTree,
        dependencyPreparation: {
          recipe: 'petrinaut-yarn-immutable-v1',
          status: 'passed',
          exitCode: 0,
        },
      },
      oracle: {
        id: 'petrinaut-optimization-oracles-v1',
        packSha256: `sha256:${'c'.repeat(64)}`,
        reportStatus: 'passed',
      },
      cleanup: {
        parentWorkspace: 'removed',
        referenceWorkspace: 'removed',
      },
    });
    expect(result.receipt.commandTrace).toEqual([
      'prepare_parent_target',
      'materialize_reference',
      'prepare_reference_dependencies',
      'run_compiled_oracle',
      'cleanup_workspaces',
    ]);
    expect(result.receipt.commandTrace.join('\n')).not.toMatch(/claude|brunch.*provider|lane/iu);
    await expect(readFile(fixture.parentTargetDir)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(fixture.referenceTargetDir)).rejects.toMatchObject({ code: 'ENOENT' });

    const rawReceipt = await readFile(fixture.receiptFile, 'utf8');
    expect(parsePetrinautHistoricalPreflightReceipt(JSON.parse(rawReceipt))).toEqual(result.receipt);
    expect(rawReceipt).not.toContain(fixture.sourceDir);
    expect(rawReceipt).not.toContain(fixture.parentTargetDir);
    expect(rawReceipt).not.toContain(fixture.referenceTargetDir);
    expect(rawReceipt).not.toContain(fixture.controllerDir);
    expect(rawReceipt).not.toContain('.comparison-source.json');
    if (
      result.receipt.parent === undefined ||
      result.receipt.reference === undefined ||
      result.receipt.oracle === undefined
    ) {
      throw new Error('passing receipt omitted required evidence');
    }
    expect(result.receipt.oracle.reportSha256).toBe(sha256(`${JSON.stringify(passingOracleReport())}\n`));
    for (const [key, filename] of [
      ['parentDependency', 'parent-dependency.json'],
      ['referenceDependency', 'reference-dependency.json'],
      ['oracleSummary', 'oracle-summary.json'],
    ] as const) {
      const metadata = result.receipt.evidence[key];
      expect(metadata?.file).toBe(filename);
      if (metadata === undefined) throw new Error(`${key} evidence missing`);
      const retained = await readFile(join(dirname(fixture.receiptFile), metadata.file), 'utf8');
      expect(sha256(retained)).toBe(metadata.sha256);
      expect(Buffer.byteLength(retained, 'utf8')).toBe(metadata.bytes);
      expect(retained).not.toContain(fixture.sourceDir);
      expect(retained).not.toContain(fixture.parentTargetDir);
      expect(retained).not.toContain(fixture.referenceTargetDir);
      expect(retained).not.toContain(fixture.controllerDir);
    }
    expect(rawReceipt).toContain('"file": "parent-dependency.json"');
    expect(rawReceipt).toContain('"file": "reference-dependency.json"');
    expect(rawReceipt).toContain('"file": "oracle-summary.json"');
    const { parent: _parent, ...missingParent } = result.receipt;
    expect(() => parsePetrinautHistoricalPreflightReceipt(missingParent)).toThrow();
    expect(() =>
      parsePetrinautHistoricalPreflightReceipt({
        ...result.receipt,
        launch: { command: 'claude', cwd: fixture.parentTargetDir },
      }),
    ).toThrow();
  }, 30_000);

  it('retains setup_failed evidence and never calibrates after parent preparation fails', async () => {
    const fixture = await createFixture();
    let oracleCalled = false;

    const result = await runFixturePreflight(fixture, {
      dependencyInstallRunner: async () => ({
        exitCode: 9,
        stdout: '',
        stderr: `parent install failed in ${fixture.parentTargetDir}\n`,
      }),
      runOracle: async () => {
        oracleCalled = true;
        return passingOracleReport();
      },
    });

    expect(result.receipt).toMatchObject({
      status: 'setup_failed',
      setupStatus: 'invalid',
      failure: {
        phase: 'parent_preparation',
        dependencyStage: 'install',
      },
      cleanup: {
        parentWorkspace: 'not_created',
        referenceWorkspace: 'not_created',
      },
    });
    expect(result.receipt.parent).toBeUndefined();
    expect(result.receipt.reference?.dependencyPreparation).toBeUndefined();
    expect(result.receipt.oracle).toBeUndefined();
    expect(oracleCalled).toBe(false);
    await expect(readFile(fixture.receiptFile, 'utf8')).resolves.toContain('"setup_failed"');
    const evidence = result.receipt.evidence.parentDependency;
    expect(evidence?.file).toBe('parent-dependency.json');
    if (evidence === undefined) throw new Error('parent dependency evidence missing');
    const evidenceBytes = await readFile(join(dirname(fixture.receiptFile), evidence.file), 'utf8');
    expect(sha256(evidenceBytes)).toBe(evidence.sha256);
    expect(evidenceBytes).toContain('"failureStage": "install"');
    expect(evidenceBytes).toContain('"exitCode": 9');
    expect(evidenceBytes).not.toContain(fixture.parentTargetDir);
  }, 30_000);

  it('cleans both workspaces and retains the exact phase when reference installation fails', async () => {
    const fixture = await createFixture();
    let installs = 0;
    let oracleCalled = false;
    const sensitiveMarker = `token=${randomUUID()}`;

    const result = await runFixturePreflight(fixture, {
      dependencyInstallRunner: async () => {
        installs += 1;
        return installs === 1
          ? { exitCode: 0, stdout: 'parent ok\n', stderr: '' }
          : {
              exitCode: 7,
              stdout: 'x'.repeat(200_000),
              stderr: `reference install failed in ${fixture.referenceTargetDir}; ${sensitiveMarker}\n`,
            };
      },
      runOracle: async () => {
        oracleCalled = true;
        return passingOracleReport();
      },
    });

    expect(result.receipt).toMatchObject({
      status: 'setup_failed',
      failure: {
        phase: 'reference_dependency_preparation',
        dependencyStage: 'install',
      },
      cleanup: {
        parentWorkspace: 'removed',
        referenceWorkspace: 'removed',
      },
    });
    expect(result.receipt.parent).toBeDefined();
    expect(result.receipt.reference?.dependencyPreparation).toMatchObject({
      status: 'failed',
      failureStage: 'install',
      exitCode: 7,
    });
    expect(result.receipt.oracle).toBeUndefined();
    expect(oracleCalled).toBe(false);
    const evidence = result.receipt.evidence.referenceDependency;
    expect(evidence).toMatchObject({
      file: 'reference-dependency.json',
      truncated: true,
      bytes: expect.any(Number),
      sha256: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
    });
    if (evidence === undefined) {
      throw new Error('reference dependency evidence missing');
    }
    expect(evidence.bytes).toBeLessThan(140_000);
    const evidenceBytes = await readFile(join(dirname(fixture.receiptFile), evidence.file), 'utf8');
    expect(sha256(evidenceBytes)).toBe(evidence.sha256);
    expect(evidenceBytes).toContain('"failureStage": "install"');
    expect(evidenceBytes).toContain('"exitCode": 7');
    expect(evidenceBytes).toContain('reference install failed');
    expect(evidenceBytes).not.toContain(fixture.referenceTargetDir);
    expect(evidenceBytes).not.toContain(sensitiveMarker);
    expect(JSON.stringify(result.receipt)).not.toContain(fixture.referenceTargetDir);
  }, 30_000);

  it('retains a successful install result separately from tracked-source cleanliness rejection', async () => {
    const fixture = await createFixture();
    let installs = 0;

    const result = await runFixturePreflight(fixture, {
      dependencyInstallRunner: async (_command, _args, options) => {
        installs += 1;
        if (installs === 2) {
          await writeFile(join(options.cwd, 'package.json'), '{"name":"mutated-reference"}\n');
        }
        return {
          exitCode: 0,
          stdout: `immutable install passed in ${options.cwd}\n`,
          stderr: '',
        };
      },
    });

    expect(result.receipt).toMatchObject({
      status: 'setup_failed',
      failure: {
        phase: 'reference_dependency_preparation',
        dependencyStage: 'tracked_source_cleanliness',
      },
      reference: {
        dependencyPreparation: {
          status: 'failed',
          exitCode: 0,
          failureStage: 'tracked_source_cleanliness',
        },
      },
    });
    const evidence = result.receipt.evidence.referenceDependency;
    if (evidence === undefined) throw new Error('reference dependency evidence missing');
    const retained = await readFile(join(dirname(fixture.receiptFile), evidence.file), 'utf8');
    expect(sha256(retained)).toBe(evidence.sha256);
    expect(retained).toContain('"exitCode": 0');
    expect(retained).toContain('"failureStage": "tracked_source_cleanliness"');
    expect(retained).toContain('"trackedSourceStatus": "M package.json"');
    expect(retained).not.toContain(fixture.referenceTargetDir);
  }, 30_000);

  it('retains sanitized command output for an oracle preparation failure', async () => {
    const fixture = await createFixture();
    const report = setupFailedOracleReport();

    const result = await runFixturePreflight(fixture, {
      dependencyInstallRunner: passingInstall,
      runOracle: async ({ onPreparationResult }) => {
        await onPreparationResult?.({
          id: 'petrinaut-ui-build',
          commandResult: {
            exitCode: 1,
            stdout: 'x'.repeat(50_000),
            stderr: `build failed in ${fixture.referenceTargetDir}; token=oracle-secret\n`,
          },
        });
        return report;
      },
    });

    const evidence = result.receipt.evidence.oracleSummary;
    if (evidence === undefined) throw new Error('oracle summary evidence missing');
    expect(evidence.truncated).toBe(true);
    expect(evidence.bytes).toBeLessThan(100_000);
    const retained = await readFile(join(dirname(fixture.receiptFile), evidence.file), 'utf8');
    expect(sha256(retained)).toBe(evidence.sha256);
    expect(retained).toContain('"id": "petrinaut-ui-build"');
    expect(retained).toContain('"exitCode": 1');
    expect(retained).toContain('build failed');
    expect(retained).not.toContain(fixture.referenceTargetDir);
    expect(retained).not.toContain('oracle-secret');
  }, 30_000);

  it('rejects historical identity or path leakage in the parent target before calibration', async () => {
    const fixture = await createFixture();
    let installs = 0;
    let oracleCalled = false;

    const result = await runFixturePreflight(fixture, {
      dependencyInstallRunner: async (_command, _args, options) => {
        installs += 1;
        if (installs === 1) {
          await writeFile(
            join(options.cwd, 'historical-reference.txt'),
            `${fixture.referenceCommit}\n${fixture.referenceTargetDir}\n`,
          );
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      },
      runOracle: async () => {
        oracleCalled = true;
        return passingOracleReport();
      },
    });

    expect(result.receipt).toMatchObject({
      status: 'setup_failed',
      failure: { phase: 'reference_materialization' },
      cleanup: {
        parentWorkspace: 'removed',
        referenceWorkspace: 'removed',
      },
    });
    expect(result.receipt.reference?.dependencyPreparation).toBeUndefined();
    expect(result.receipt.oracle).toBeUndefined();
    expect(oracleCalled).toBe(false);
    const rawReceipt = await readFile(fixture.receiptFile, 'utf8');
    expect(rawReceipt).not.toContain(fixture.referenceTargetDir);
  }, 30_000);

  it.each([
    ['setup failure', setupFailedOracleReport(), 'setup_failed'],
    ['calibration assertion', assertionFailedOracleReport(), 'assertion_failed'],
  ] as const)(
    'preserves the %s distinction from the unchanged oracle',
    async (_name, report, status) => {
      const fixture = await createFixture();
      const result = await runFixturePreflight(fixture, {
        dependencyInstallRunner: passingInstall,
        runOracle: async () => report,
      });

      expect(result.receipt.status).toBe(status);
      expect(result.receipt.setupStatus).toBe('invalid');
      expect(result.receipt.oracle).toMatchObject({
        reportStatus: status,
        id: 'petrinaut-optimization-oracles-v1',
      });
      expect(result.receipt.failure).toBeUndefined();
      expect(result.receipt.cleanup).toEqual({
        parentWorkspace: 'removed',
        referenceWorkspace: 'removed',
      });
    },
    30_000,
  );

  it('rejects output collisions before creating either workspace', async () => {
    const fixture = await createFixture();
    await writeFile(fixture.receiptFile, 'caller-owned evidence\n');

    await expect(
      runFixturePreflight(fixture, {
        dependencyInstallRunner: passingInstall,
      }),
    ).rejects.toMatchObject({ code: 'EEXIST' });
    await expect(readFile(fixture.receiptFile, 'utf8')).resolves.toBe('caller-owned evidence\n');
    await expect(readFile(fixture.parentTargetDir)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(fixture.referenceTargetDir)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects retained evidence collisions before running dependency preparation', async () => {
    const fixture = await createFixture();
    const evidenceFile = join(dirname(fixture.receiptFile), 'parent-dependency.json');
    await writeFile(evidenceFile, 'caller-owned evidence\n');
    let installCalled = false;

    await expect(
      runFixturePreflight(fixture, {
        dependencyInstallRunner: async () => {
          installCalled = true;
          return { exitCode: 0, stdout: '', stderr: '' };
        },
      }),
    ).rejects.toThrow('retained evidence parent-dependency.json');
    expect(installCalled).toBe(false);
    await expect(readFile(evidenceFile, 'utf8')).resolves.toBe('caller-owned evidence\n');
    await expect(readFile(fixture.receiptFile)).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it.each([
    ['parent/reference', (fixture: Awaited<ReturnType<typeof createFixture>>) => fixture.parentTargetDir],
    [
      'source/parent',
      (fixture: Awaited<ReturnType<typeof createFixture>>) => join(fixture.sourceDir, 'target'),
    ],
    [
      'output/reference',
      (fixture: Awaited<ReturnType<typeof createFixture>>) => join(dirname(fixture.receiptFile), 'reference'),
    ],
  ])('rejects %s root overlap before materialization', async (_name, conflictingReference) => {
    const fixture = await createFixture();
    const referenceTargetDir = conflictingReference(fixture);

    await expect(
      runPetrinautHistoricalPreflight(
        {
          sourceRepositoryDir: fixture.sourceDir,
          parentTargetDir: fixture.parentTargetDir,
          referenceTargetDir,
          controllerRoot: fixture.controllerDir,
          receiptFile: fixture.receiptFile,
        },
        {
          selectedCase: await selectedCaseForFixture(fixture),
          referenceCommit: fixture.referenceCommit,
          runner: fixtureRunner(fixture),
          dependencyInstallRunner: passingInstall,
          createVerifier: portableVerifier,
          loadOraclePack: fixedOraclePack,
          runOracle: async () => passingOracleReport(),
        },
      ),
    ).rejects.toThrow('disjoint');
    await expect(readFile(fixture.receiptFile)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

async function createFixture(): Promise<{
  readonly root: string;
  readonly sourceDir: string;
  readonly controllerDir: string;
  readonly parentTargetDir: string;
  readonly referenceTargetDir: string;
  readonly receiptFile: string;
  readonly parentCommit: string;
  readonly referenceCommit: string;
  readonly referenceTree: string;
}> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'brunch-petrinaut-preflight-')));
  roots.push(root);
  const sourceDir = join(root, 'source');
  const controllerDir = join(root, 'controller');
  const workRoot = join(root, 'work');
  const evidenceRoot = join(root, 'evidence');
  await Promise.all([mkdir(sourceDir), mkdir(controllerDir), mkdir(workRoot), mkdir(evidenceRoot)]);

  await writeFile(join(sourceDir, 'package.json'), '{"name":"petrinaut-fixture","private":true}\n');
  await writeFile(join(sourceDir, 'parent.ts'), 'export const parent = true;\n');
  await git(sourceDir, ['init', '--initial-branch=main']);
  await git(sourceDir, ['add', '--all']);
  await commit(sourceDir, 'Pinned parent');
  const parentCommit = await git(sourceDir, ['rev-parse', 'HEAD']);
  await writeFile(join(sourceDir, 'reference.ts'), 'export const mergedReference = true;\n');
  await git(sourceDir, ['add', '--all']);
  await commit(sourceDir, 'Merged reference');
  const referenceCommit = await git(sourceDir, ['rev-parse', 'HEAD']);
  const referenceTree = await git(sourceDir, ['rev-parse', 'HEAD^{tree}']);

  return {
    root,
    sourceDir,
    controllerDir,
    parentTargetDir: join(workRoot, 'parent'),
    referenceTargetDir: join(workRoot, 'reference'),
    receiptFile: join(evidenceRoot, 'receipt.json'),
    parentCommit,
    referenceCommit,
    referenceTree,
  };
}

async function selectedCaseForFixture(
  _fixture: Awaited<ReturnType<typeof createFixture>>,
): Promise<ResolvedExecutionCase> {
  return await resolveExecutionCase('petrinaut-optimization', frozenCasesRoot);
}

async function runFixturePreflight(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  dependencies: PetrinautHistoricalPreflightDependencies,
) {
  return await runPetrinautHistoricalPreflight(
    {
      sourceRepositoryDir: fixture.sourceDir,
      parentTargetDir: fixture.parentTargetDir,
      referenceTargetDir: fixture.referenceTargetDir,
      controllerRoot: fixture.controllerDir,
      receiptFile: fixture.receiptFile,
    },
    {
      selectedCase: await selectedCaseForFixture(fixture),
      referenceCommit: fixture.referenceCommit,
      runner: fixtureRunner(fixture),
      createVerifier: portableVerifier,
      loadOraclePack: fixedOraclePack,
      ...dependencies,
    },
  );
}

function fixtureRunner(fixture: Awaited<ReturnType<typeof createFixture>>): CommandRunner {
  return async (command, args, options) => {
    if (command === 'git' && options.cwd === fixture.sourceDir) {
      if (args.at(-1) === `${frozenParentCommit}^{commit}`) {
        return { exitCode: 0, stdout: `${frozenParentCommit}\n`, stderr: '' };
      }
      if (args.at(-1) === `${frozenParentCommit}^{tree}`) {
        return { exitCode: 0, stdout: `${frozenParentTree}\n`, stderr: '' };
      }
      if (args[0] === 'archive' && args.at(-1) === frozenParentCommit) {
        return await runCommand(command, [...args.slice(0, -1), fixture.parentCommit], options);
      }
    }
    return await runCommand(command, args, options);
  };
}

async function git(cwd: string, args: readonly string[]): Promise<string> {
  const result = await runCommand('git', args, { cwd });
  if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

async function commit(cwd: string, message: string): Promise<void> {
  await git(cwd, [
    '-c',
    'user.name=Petrinaut Preflight Fixture',
    '-c',
    'user.email=petrinaut-preflight@example.invalid',
    'commit',
    '-m',
    message,
  ]);
}

const fakeSandboxRunner: CommandRunner = async (command, args) => {
  if (command !== 'sandbox-exec') throw new Error(`unexpected verifier command: ${command}`);
  if (args[2] === '/usr/bin/curl' && args[3] === '--version') {
    return { exitCode: 0, stdout: 'curl fake\n', stderr: '' };
  }
  return { exitCode: 1, stdout: '', stderr: 'denied by fake sandbox\n' };
};

const portableVerifier: NonNullable<PetrinautHistoricalPreflightDependencies['createVerifier']> = (
  forbiddenReadRoots,
) =>
  createNetworkDeniedCommandRunner({
    platform: 'darwin',
    forbiddenReadRoots,
    run: fakeSandboxRunner,
  });

const fixedOraclePack: NonNullable<
  PetrinautHistoricalPreflightDependencies['loadOraclePack']
> = async () => ({
  oracleId: 'petrinaut-optimization-oracles-v1',
  packSha256: `sha256:${'c'.repeat(64)}`,
});

const passingInstall: CommandRunner = async () => ({
  exitCode: 0,
  stdout: 'immutable install passed\n',
  stderr: '',
});

function passingOracleReport() {
  return {
    schemaVersion: 1 as const,
    caseId: 'petrinaut-optimization-v1' as const,
    oracleId: 'petrinaut-optimization-oracles-v1' as const,
    status: 'passed' as const,
    preparation: [
      {
        id: 'petrinaut-ui-build',
        status: 'passed' as const,
        exitCode: 0,
      },
    ],
    checks: [
      {
        id: 'route-and-accessibility' as const,
        claims: ['AC1'],
        status: 'passed' as const,
        evidence: ['route accessible'],
      },
    ],
    consoleErrors: [],
    failedRequests: [],
  };
}

function setupFailedOracleReport() {
  return {
    ...passingOracleReport(),
    status: 'setup_failed' as const,
    checks: [],
    setupFailure: 'browser server did not become ready',
  };
}

function assertionFailedOracleReport() {
  return {
    ...passingOracleReport(),
    status: 'assertion_failed' as const,
    checks: [
      {
        id: 'route-and-accessibility' as const,
        claims: ['AC1'],
        status: 'failed' as const,
        evidence: ['focused route missing'],
      },
    ],
  };
}

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

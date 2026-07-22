import { createHash } from 'node:crypto';
import { lstat, open, readdir, realpath, rm } from 'node:fs/promises';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { runCommand, type CommandRunner } from '../../app/command-runner.js';
import { materializePinnedSourceTree } from '../end-to-end-comparison/solution-isolation.js';
import { assertControllerIsolation } from '../end-to-end-comparison/study-contract.js';
import {
  HistoricalReplayTargetPreparationError,
  PetrinautDependencyPreparationError,
  prepareHistoricalReplayTarget,
  preparePetrinautHistoricalReplayDependencies,
  type HistoricalReplayTargetDependencies,
  type PetrinautDependencyPreparationObservation,
  type PetrinautDependencyPreparationOutcome,
} from './historical-replay-target.js';
import { resolveExecutionCase, type ResolvedExecutionCase } from './operator-cli.js';
import {
  createPreflightEvidenceWriter,
  PREFLIGHT_EVIDENCE_FILES,
  retainedPreflightEvidenceSchema,
  type RetainedPreflightEvidence,
} from './petrinaut-historical-preflight/evidence.js';
import {
  runPetrinautOptimizationOracle,
  type PetrinautOraclePreparationObservation,
} from './petrinaut-optimization-oracle.js';
import type { PetrinautOptimizationOracleReport } from './petrinaut-optimization-oracle/types.js';

export const PETRINAUT_HISTORICAL_REFERENCE_COMMIT = '276e17d7b0f80c8a80d5abe01849bbb67c6169d0' as const;

const CASE_REFERENCE = 'petrinaut-optimization-v1';
const ORACLE_ID = 'petrinaut-optimization-oracles-v1';
const DEFAULT_CASES_ROOT = fileURLToPath(
  new URL('../../../testing/execution-comparisons/cases/', import.meta.url),
);
const HASH = /^sha256:[a-f0-9]{64}$/u;
const GIT_OBJECT = /^[a-f0-9]{40}$/u;
const COMMAND_TRACE = [
  'prepare_parent_target',
  'materialize_reference',
  'prepare_reference_dependencies',
  'run_compiled_oracle',
  'cleanup_workspaces',
] as const;

const dependencyPreparationBase = z.object({
  recipe: z.literal('petrinaut-yarn-immutable-v1'),
  command: z.literal('corepack'),
  args: z.tuple([
    z.literal('yarn'),
    z.literal('install'),
    z.literal('--immutable'),
    z.literal('--mode=skip-build'),
  ]),
  exitCode: z.number().int(),
});
const dependencyPreparationSchema = z.discriminatedUnion('status', [
  dependencyPreparationBase
    .extend({
      status: z.literal('passed'),
      exitCode: z.literal(0),
    })
    .strict(),
  dependencyPreparationBase
    .extend({
      status: z.literal('failed'),
      failureStage: z.enum(['install', 'tracked_source_cleanliness']),
    })
    .strict(),
]);

const retainedEvidenceSetSchema = z
  .object({
    parentDependency: retainedPreflightEvidenceSchema.optional(),
    referenceDependency: retainedPreflightEvidenceSchema.optional(),
    oracleSummary: retainedPreflightEvidenceSchema.optional(),
  })
  .strict();

const cleanupStatusSchema = z.enum(['removed', 'not_created', 'failed']);
const receiptStatusSchema = z.enum(['passed', 'setup_failed', 'assertion_failed']);
const preflightPhaseSchema = z.enum([
  'parent_preparation',
  'reference_materialization',
  'reference_dependency_preparation',
  'oracle_pack',
  'oracle_calibration',
  'evidence_retention',
  'cleanup',
]);

const historicalIdentitySchema = z
  .object({
    sourceCommit: z.string().regex(GIT_OBJECT),
    sourceTree: z.string().regex(GIT_OBJECT),
  })
  .strict();

export const petrinautHistoricalPreflightReceiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    caseId: z.literal('petrinaut-optimization-v1'),
    status: receiptStatusSchema,
    setupStatus: z.enum(['valid', 'invalid']),
    parent: historicalIdentitySchema
      .extend({
        materializedCommit: z.string().regex(GIT_OBJECT),
        packetCommit: z.string().regex(GIT_OBJECT),
        dependencyPreparation: dependencyPreparationSchema,
      })
      .strict()
      .optional(),
    reference: historicalIdentitySchema
      .extend({
        dependencyPreparation: dependencyPreparationSchema.optional(),
      })
      .strict()
      .optional(),
    oracle: z
      .object({
        id: z.literal(ORACLE_ID),
        packSha256: z.string().regex(HASH),
        reportSha256: z.string().regex(HASH),
        reportStatus: z.enum(['passed', 'setup_failed', 'assertion_failed']),
      })
      .strict()
      .optional(),
    evidence: retainedEvidenceSetSchema,
    commandTrace: z.tuple([
      z.literal('prepare_parent_target'),
      z.literal('materialize_reference'),
      z.literal('prepare_reference_dependencies'),
      z.literal('run_compiled_oracle'),
      z.literal('cleanup_workspaces'),
    ]),
    cleanup: z
      .object({
        parentWorkspace: cleanupStatusSchema,
        referenceWorkspace: cleanupStatusSchema,
      })
      .strict(),
    failure: z
      .object({
        phase: preflightPhaseSchema,
        dependencyStage: z.enum(['install', 'tracked_source_cleanliness']).optional(),
        messageSha256: z.string().regex(HASH),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((receipt, context) => {
    if (receipt.status === 'passed' && receipt.setupStatus !== 'valid') {
      context.addIssue({ code: 'custom', message: 'passed receipt must be setup-valid' });
    }
    if (receipt.status !== 'passed' && receipt.setupStatus !== 'invalid') {
      context.addIssue({ code: 'custom', message: 'failed receipt must be setup-invalid' });
    }
    if (
      (receipt.status === 'passed' || receipt.status === 'assertion_failed') &&
      (receipt.parent === undefined ||
        receipt.reference?.dependencyPreparation?.status !== 'passed' ||
        receipt.oracle === undefined ||
        receipt.evidence.parentDependency === undefined ||
        receipt.evidence.referenceDependency === undefined ||
        receipt.evidence.oracleSummary === undefined)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'completed calibration receipt requires parent, reference, oracle, and retained evidence',
      });
    }
    if (receipt.oracle !== undefined && receipt.oracle.reportStatus !== receipt.status) {
      context.addIssue({
        code: 'custom',
        message: 'receipt status must match the retained oracle report status',
      });
    }
    if (
      receipt.status !== 'setup_failed' &&
      (receipt.cleanup.parentWorkspace !== 'removed' || receipt.cleanup.referenceWorkspace !== 'removed')
    ) {
      context.addIssue({
        code: 'custom',
        message: 'completed calibration receipt requires owned workspace cleanup',
      });
    }
    for (const [key, expectedFile] of Object.entries(PREFLIGHT_EVIDENCE_FILES) as [
      keyof typeof PREFLIGHT_EVIDENCE_FILES,
      (typeof PREFLIGHT_EVIDENCE_FILES)[keyof typeof PREFLIGHT_EVIDENCE_FILES],
    ][]) {
      const retained = receipt.evidence[key];
      if (retained !== undefined && retained.file !== expectedFile) {
        context.addIssue({
          code: 'custom',
          message: `${key} evidence uses the wrong fixed filename`,
        });
      }
    }
    if (
      (receipt.parent?.dependencyPreparation !== undefined ||
        (receipt.failure?.phase === 'parent_preparation' && receipt.failure.dependencyStage !== undefined)) &&
      receipt.evidence.parentDependency === undefined &&
      receipt.failure?.phase !== 'evidence_retention'
    ) {
      context.addIssue({
        code: 'custom',
        message: 'parent dependency result requires retained evidence',
      });
    }
    if (
      (receipt.reference?.dependencyPreparation !== undefined ||
        (receipt.failure?.phase === 'reference_dependency_preparation' &&
          receipt.failure.dependencyStage !== undefined)) &&
      receipt.evidence.referenceDependency === undefined &&
      receipt.failure?.phase !== 'evidence_retention'
    ) {
      context.addIssue({
        code: 'custom',
        message: 'reference dependency result requires retained evidence',
      });
    }
    if (
      (receipt.oracle !== undefined || receipt.failure?.phase === 'oracle_calibration') &&
      receipt.evidence.oracleSummary === undefined &&
      receipt.failure?.phase !== 'evidence_retention'
    ) {
      context.addIssue({
        code: 'custom',
        message: 'oracle calibration requires retained summary evidence',
      });
    }
  });

export type PetrinautHistoricalPreflightReceipt = z.infer<typeof petrinautHistoricalPreflightReceiptSchema>;

export interface PetrinautHistoricalPreflightInput {
  readonly sourceRepositoryDir: string;
  readonly parentTargetDir: string;
  readonly referenceTargetDir: string;
  readonly controllerRoot: string;
  readonly receiptFile: string;
}

interface ClosedOraclePack {
  readonly oracleId: typeof ORACLE_ID;
  readonly packSha256: string;
}

export interface PetrinautHistoricalPreflightDependencies extends HistoricalReplayTargetDependencies {
  /** Test-only frozen-case substitution for self-contained Git fixtures. */
  readonly selectedCase?: ResolvedExecutionCase;
  /** Test-only reference substitution for self-contained Git fixtures. */
  readonly referenceCommit?: string;
  readonly loadOraclePack?: (caseDir: string) => Promise<ClosedOraclePack>;
  readonly runOracle?: (input: {
    readonly candidateRoot: string;
    readonly caseDir: string;
    readonly onPreparationResult?: (
      observation: PetrinautOraclePreparationObservation,
    ) => Promise<void> | void;
  }) => Promise<PetrinautOptimizationOracleReport>;
}

export async function runPetrinautHistoricalPreflight(
  input: PetrinautHistoricalPreflightInput,
  dependencies: PetrinautHistoricalPreflightDependencies = {},
): Promise<{
  readonly receiptFile: string;
  readonly receipt: PetrinautHistoricalPreflightReceipt;
}> {
  const roots = await validateInput(input);
  const receiptHandle = await open(roots.receiptFile, 'wx');
  const runner = dependencies.runner ?? runCommand;
  const dependencyInstallRunner = dependencies.dependencyInstallRunner ?? runCommand;
  const evidenceWriter = createPreflightEvidenceWriter({
    outputRoot: roots.outputRoot,
    redactedRoots: [
      roots.sourceRepositoryDir,
      roots.parentTargetDir,
      roots.referenceTargetDir,
      roots.controllerRoot,
      roots.outputRoot,
    ],
  });
  let phase: z.infer<typeof preflightPhaseSchema> = 'parent_preparation';
  let parent:
    | {
        readonly sourceCommit: string;
        readonly sourceTree: string;
        readonly materializedCommit: string;
        readonly packetCommit: string;
        readonly dependencyPreparation: PetrinautDependencyPreparationOutcome;
      }
    | undefined;
  let reference:
    | {
        readonly sourceCommit: string;
        readonly sourceTree: string;
        readonly dependencyPreparation?: PetrinautDependencyPreparationOutcome;
      }
    | undefined;
  let oracle: PetrinautHistoricalPreflightReceipt['oracle'];
  let parentObservation: PetrinautDependencyPreparationObservation | undefined;
  let referenceObservation: PetrinautDependencyPreparationObservation | undefined;
  let oracleSummary:
    | {
        readonly kind: 'report';
        readonly report: PetrinautOptimizationOracleReport;
      }
    | { readonly kind: 'failure'; readonly error: unknown }
    | undefined;
  let parentRemovedEarly = false;
  const oraclePreparation: PetrinautOraclePreparationObservation[] = [];
  let evidence: {
    readonly parentDependency?: RetainedPreflightEvidence;
    readonly referenceDependency?: RetainedPreflightEvidence;
    readonly oracleSummary?: RetainedPreflightEvidence;
  } = {};
  let status: PetrinautHistoricalPreflightReceipt['status'] = 'setup_failed';
  let failure: PetrinautHistoricalPreflightReceipt['failure'];
  const retainDependencyObservation = async (
    scope: 'parent' | 'reference',
    observation: PetrinautDependencyPreparationObservation,
  ): Promise<void> => {
    if (scope === 'parent') parentObservation = observation;
    else referenceObservation = observation;
    await dependencies.onPetrinautDependencyPreparation?.(observation);
  };

  try {
    const selectedCase =
      dependencies.selectedCase ?? (await resolveExecutionCase(CASE_REFERENCE, DEFAULT_CASES_ROOT));
    if (selectedCase.caseId !== CASE_REFERENCE) {
      throw new Error('Petrinaut preflight received a different frozen case');
    }
    const parentReady = await prepareHistoricalReplayTarget(
      {
        lane: 'claude_code',
        selectedCase,
        sourceRepositoryDir: roots.sourceRepositoryDir,
        targetDir: roots.parentTargetDir,
        controllerRoot: roots.controllerRoot,
        forbiddenRoots: [roots.referenceTargetDir, roots.outputRoot],
      },
      {
        runner,
        dependencyInstallRunner,
        onPetrinautDependencyPreparation: async (observation) =>
          await retainDependencyObservation('parent', observation),
        ...(dependencies.createVerifier === undefined ? {} : { createVerifier: dependencies.createVerifier }),
      },
    );
    if (parentReady.dependencyPreparation.recipe !== 'petrinaut-yarn-immutable-v1') {
      throw new Error('Petrinaut parent used a different dependency recipe');
    }
    parent = {
      sourceCommit: parentReady.sourceCommit,
      sourceTree: parentReady.sourceTree,
      materializedCommit: parentReady.materializedCommit,
      packetCommit: parentReady.baseSha,
      dependencyPreparation: parentReady.dependencyPreparation,
    };

    phase = 'reference_materialization';
    const materializedReference = await materializePinnedSourceTree({
      sourceRepositoryDir: roots.sourceRepositoryDir,
      sourceCommit: dependencies.referenceCommit ?? PETRINAUT_HISTORICAL_REFERENCE_COMMIT,
      targetDir: roots.referenceTargetDir,
      runner,
    });
    reference = {
      sourceCommit: materializedReference.sourceCommit,
      sourceTree: materializedReference.sourceTree,
    };
    await assertParentContainsNoReference(
      roots.parentTargetDir,
      materializedReference.sourceCommit,
      roots.referenceTargetDir,
      runner,
    );
    phase = 'cleanup';
    if ((await removeOwnedWorkspace(roots.parentTargetDir)) !== 'removed') {
      throw new Error('owned parent workspace cleanup failed');
    }
    parentRemovedEarly = true;

    phase = 'reference_dependency_preparation';
    const referencePreparation = await preparePetrinautHistoricalReplayDependencies({
      targetDir: roots.referenceTargetDir,
      runner,
      dependencyInstallRunner,
      onObservation: async (observation) => {
        reference = {
          sourceCommit: materializedReference.sourceCommit,
          sourceTree: materializedReference.sourceTree,
          dependencyPreparation: observation.outcome,
        };
        await retainDependencyObservation('reference', observation);
      },
    });
    reference = {
      sourceCommit: materializedReference.sourceCommit,
      sourceTree: materializedReference.sourceTree,
      dependencyPreparation: referencePreparation,
    };

    phase = 'oracle_pack';
    const oraclePack = await (dependencies.loadOraclePack ?? loadClosedOraclePack)(selectedCase.caseDir);
    if (oraclePack.oracleId !== ORACLE_ID || !HASH.test(oraclePack.packSha256)) {
      throw new Error('Petrinaut preflight received a different compiled oracle pack');
    }

    phase = 'oracle_calibration';
    let report: PetrinautOptimizationOracleReport;
    try {
      report = await (dependencies.runOracle ?? runPetrinautOptimizationOracle)({
        candidateRoot: roots.referenceTargetDir,
        caseDir: selectedCase.caseDir,
        onPreparationResult: (observation) => {
          oraclePreparation.push(observation);
        },
      });
    } catch (error) {
      oracleSummary = { kind: 'failure', error };
      throw error;
    }
    oracleSummary = { kind: 'report', report };
    const reportBytes = `${JSON.stringify(report)}\n`;
    oracle = {
      id: ORACLE_ID,
      packSha256: oraclePack.packSha256,
      reportSha256: sha256(reportBytes),
      reportStatus: report.status,
    };
    status = report.status;
  } catch (error) {
    status = 'setup_failed';
    const dependencyError = findDependencyPreparationError(error);
    failure = {
      phase,
      ...(dependencyError === undefined ? {} : { dependencyStage: dependencyError.outcome.failureStage }),
      messageSha256: sha256(redactedError(error, roots)),
    };
  }

  const cleanup = await cleanupWorkspaces(roots, parentRemovedEarly);
  if (cleanup.parentWorkspace === 'failed' || cleanup.referenceWorkspace === 'failed') {
    status = 'setup_failed';
    failure = {
      phase: 'cleanup',
      messageSha256: sha256('owned workspace cleanup failed'),
    };
  }
  try {
    phase = 'evidence_retention';
    if (parentObservation !== undefined) {
      evidence = {
        ...evidence,
        parentDependency: await evidenceWriter.writeDependency('parent', parentObservation),
      };
    }
    if (referenceObservation !== undefined) {
      evidence = {
        ...evidence,
        referenceDependency: await evidenceWriter.writeDependency('reference', referenceObservation),
      };
    }
    if (oracleSummary !== undefined) {
      evidence = {
        ...evidence,
        oracleSummary:
          oracleSummary.kind === 'report'
            ? await evidenceWriter.writeOracle(oracleSummary.report, oraclePreparation)
            : await evidenceWriter.writeOracleFailure(oracleSummary.error, oraclePreparation),
      };
    }
  } catch (error) {
    status = 'setup_failed';
    failure = {
      phase: 'evidence_retention',
      messageSha256: sha256(redactedError(error, roots)),
    };
  }
  const receipt = parsePetrinautHistoricalPreflightReceipt({
    schemaVersion: 1,
    caseId: CASE_REFERENCE,
    status,
    setupStatus: status === 'passed' ? 'valid' : 'invalid',
    ...(parent === undefined ? {} : { parent }),
    ...(reference === undefined ? {} : { reference }),
    ...(oracle === undefined ? {} : { oracle }),
    evidence,
    commandTrace: COMMAND_TRACE,
    cleanup,
    ...(failure === undefined ? {} : { failure }),
  });
  const receiptBytes = `${JSON.stringify(receipt, null, 2)}\n`;
  try {
    await receiptHandle.writeFile(receiptBytes, 'utf8');
  } finally {
    await receiptHandle.close();
  }
  return { receiptFile: roots.receiptFile, receipt };
}

export function parsePetrinautHistoricalPreflightReceipt(
  value: unknown,
): PetrinautHistoricalPreflightReceipt {
  return petrinautHistoricalPreflightReceiptSchema.parse(value);
}

async function loadClosedOraclePack(caseDir: string): Promise<ClosedOraclePack> {
  const [{ loadControllerOraclePack }, { resolveCompiledExecutionOracle }] = await Promise.all([
    import('./oracle-pack.js'),
    import('../execution-comparison-operator.js'),
  ]);
  const compiled = resolveCompiledExecutionOracle(ORACLE_ID);
  const pack = await loadControllerOraclePack({
    caseDir,
    implementationFiles: compiled.implementationFiles,
  });
  if (pack.manifest.id !== ORACLE_ID) {
    throw new Error('Petrinaut preflight received a different compiled oracle');
  }
  return { oracleId: ORACLE_ID, packSha256: pack.packSha256 };
}

async function validateInput(input: PetrinautHistoricalPreflightInput): Promise<{
  readonly sourceRepositoryDir: string;
  readonly parentTargetDir: string;
  readonly referenceTargetDir: string;
  readonly controllerRoot: string;
  readonly receiptFile: string;
  readonly outputRoot: string;
}> {
  for (const [name, path] of Object.entries(input)) {
    if (!isAbsolute(path)) {
      throw new Error(`Petrinaut preflight ${name} must be an absolute path`);
    }
  }
  const sourceRepositoryDir = await existingRealDirectory(input.sourceRepositoryDir, 'source repository');
  const controllerRoot = await existingRealDirectory(input.controllerRoot, 'controller root');
  const outputRoot = await existingRealDirectory(dirname(input.receiptFile), 'output root');
  const parentRoot = await existingRealDirectory(dirname(input.parentTargetDir), 'parent workspace root');
  const referenceRoot = await existingRealDirectory(
    dirname(input.referenceTargetDir),
    'reference workspace root',
  );
  const parentTargetDir = resolve(parentRoot, basename(input.parentTargetDir));
  const referenceTargetDir = resolve(referenceRoot, basename(input.referenceTargetDir));
  const receiptFile = resolve(outputRoot, basename(input.receiptFile));
  await assertAbsent(parentTargetDir, 'parent target');
  await assertAbsent(referenceTargetDir, 'reference target');
  for (const file of Object.values(PREFLIGHT_EVIDENCE_FILES)) {
    await assertAbsent(resolve(outputRoot, file), `retained evidence ${file}`);
  }
  assertPairwiseDisjoint([
    sourceRepositoryDir,
    controllerRoot,
    parentTargetDir,
    referenceTargetDir,
    outputRoot,
  ]);
  return {
    sourceRepositoryDir,
    parentTargetDir,
    referenceTargetDir,
    controllerRoot,
    receiptFile,
    outputRoot,
  };
}

async function existingRealDirectory(path: string, name: string): Promise<string> {
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`Petrinaut preflight ${name} must be a real directory`);
  }
  return await realpath(path);
}

async function assertAbsent(path: string, name: string): Promise<void> {
  try {
    await lstat(path);
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) return;
    throw error;
  }
  throw new Error(`Petrinaut preflight ${name} must not already exist`);
}

function assertPairwiseDisjoint(roots: readonly string[]): void {
  for (let index = 0; index < roots.length - 1; index += 1) {
    assertControllerIsolation({
      controllerRoot: roots[index]!,
      targetRoots: roots.slice(index + 1),
    });
  }
}

async function assertParentContainsNoReference(
  parentTargetDir: string,
  referenceCommit: string,
  referenceTargetDir: string,
  runner: CommandRunner,
): Promise<void> {
  for (const forbidden of [referenceCommit, referenceTargetDir]) {
    const result = await runner('git', ['grep', '-F', '--quiet', forbidden, '--', '.'], {
      cwd: parentTargetDir,
      timeoutMs: 30_000,
      maxOutputBytes: 16 * 1024,
    });
    if (result.exitCode === 0) {
      throw new Error('historical reference leaked into the parent target');
    }
    if (result.exitCode !== 1) {
      throw new Error(`parent reference-leak scan failed: ${result.stderr || result.stdout}`);
    }
    for (const entry of await readdir(parentTargetDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const handle = await open(resolve(parentTargetDir, entry.name), 'r');
      try {
        const buffer = Buffer.alloc(64 * 1024);
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
        if (buffer.subarray(0, bytesRead).toString('utf8').includes(forbidden)) {
          throw new Error('historical reference leaked into the parent target');
        }
      } finally {
        await handle.close();
      }
    }
  }
}

async function cleanupWorkspaces(
  input: {
    readonly parentTargetDir: string;
    readonly referenceTargetDir: string;
  },
  parentRemovedEarly: boolean,
): Promise<{
  readonly parentWorkspace: 'removed' | 'not_created' | 'failed';
  readonly referenceWorkspace: 'removed' | 'not_created' | 'failed';
}> {
  const [parentWorkspace, referenceWorkspace] = await Promise.all([
    parentRemovedEarly ? Promise.resolve('removed' as const) : removeOwnedWorkspace(input.parentTargetDir),
    removeOwnedWorkspace(input.referenceTargetDir),
  ]);
  return { parentWorkspace, referenceWorkspace };
}

async function removeOwnedWorkspace(path: string): Promise<'removed' | 'not_created' | 'failed'> {
  try {
    await lstat(path);
  } catch (error) {
    return isNodeError(error, 'ENOENT') ? 'not_created' : 'failed';
  }
  try {
    await rm(path, { recursive: true });
    return 'removed';
  } catch {
    return 'failed';
  }
}

function redactedError(
  error: unknown,
  roots: {
    readonly sourceRepositoryDir: string;
    readonly parentTargetDir: string;
    readonly referenceTargetDir: string;
    readonly controllerRoot: string;
    readonly outputRoot: string;
  },
): string {
  let message = error instanceof Error ? error.message : String(error);
  for (const root of Object.values(roots)) {
    message = message.split(root).join('<redacted>');
  }
  return message;
}

function findDependencyPreparationError(error: unknown): PetrinautDependencyPreparationError | undefined {
  if (error instanceof PetrinautDependencyPreparationError) return error;
  if (error instanceof HistoricalReplayTargetPreparationError) {
    return findDependencyPreparationError(error.cause);
  }
  return undefined;
}

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function isNodeError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === code
  );
}

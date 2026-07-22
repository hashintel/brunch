import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { z } from 'zod';

import type { PetrinautDependencyPreparationObservation } from '../historical-replay-target.js';
import type { PetrinautOraclePreparationObservation } from '../petrinaut-optimization-oracle/runner.js';
import type { PetrinautOptimizationOracleReport } from '../petrinaut-optimization-oracle/types.js';

const HASH = /^sha256:[a-f0-9]{64}$/u;
const MAX_STREAM_BYTES = 48 * 1024;
const MAX_STATUS_BYTES = 16 * 1024;
const MAX_ORACLE_STREAM_BYTES = 8 * 1024;

export const PREFLIGHT_EVIDENCE_FILES = {
  parentDependency: 'parent-dependency.json',
  referenceDependency: 'reference-dependency.json',
  oracleSummary: 'oracle-summary.json',
} as const;

export const retainedPreflightEvidenceSchema = z
  .object({
    file: z.enum([
      PREFLIGHT_EVIDENCE_FILES.parentDependency,
      PREFLIGHT_EVIDENCE_FILES.referenceDependency,
      PREFLIGHT_EVIDENCE_FILES.oracleSummary,
    ]),
    sha256: z.string().regex(HASH),
    bytes: z.number().int().positive(),
    truncated: z.boolean(),
  })
  .strict();

export type RetainedPreflightEvidence = z.infer<typeof retainedPreflightEvidenceSchema>;

export function createPreflightEvidenceWriter(input: {
  readonly outputRoot: string;
  readonly redactedRoots: readonly string[];
}): {
  readonly writeDependency: (
    scope: 'parent' | 'reference',
    observation: PetrinautDependencyPreparationObservation,
  ) => Promise<RetainedPreflightEvidence>;
  readonly writeOracle: (
    report: PetrinautOptimizationOracleReport,
    preparation: readonly PetrinautOraclePreparationObservation[],
  ) => Promise<RetainedPreflightEvidence>;
  readonly writeOracleFailure: (
    error: unknown,
    preparation: readonly PetrinautOraclePreparationObservation[],
  ) => Promise<RetainedPreflightEvidence>;
} {
  return {
    writeDependency: async (scope, observation) => {
      const stdout = sanitizeBounded(observation.commandResult.stdout, input.redactedRoots, MAX_STREAM_BYTES);
      const stderr = sanitizeBounded(observation.commandResult.stderr, input.redactedRoots, MAX_STREAM_BYTES);
      const spawnError =
        observation.commandResult.spawnError === undefined
          ? undefined
          : sanitizeBounded(observation.commandResult.spawnError, input.redactedRoots, MAX_STATUS_BYTES);
      const trackedSourceStatus =
        observation.trackedSourceStatus === undefined
          ? undefined
          : sanitizeBounded(observation.trackedSourceStatus, input.redactedRoots, MAX_STATUS_BYTES);
      return await retain(
        input.outputRoot,
        scope === 'parent'
          ? PREFLIGHT_EVIDENCE_FILES.parentDependency
          : PREFLIGHT_EVIDENCE_FILES.referenceDependency,
        {
          schemaVersion: 1,
          kind: 'dependency_preparation',
          scope,
          recipe: observation.outcome.recipe,
          command: observation.outcome.command,
          args: observation.outcome.args,
          status: observation.outcome.status,
          exitCode: observation.outcome.exitCode,
          ...('failureStage' in observation.outcome
            ? { failureStage: observation.outcome.failureStage }
            : {}),
          commandResult: {
            stdout: stdout.value,
            stderr: stderr.value,
            ...(spawnError === undefined ? {} : { spawnError: spawnError.value }),
            aborted: observation.commandResult.aborted === true,
            timedOut: observation.commandResult.timedOut === true,
            outputTruncated:
              observation.commandResult.outputTruncated === true || stdout.truncated || stderr.truncated,
          },
          ...(trackedSourceStatus === undefined ? {} : { trackedSourceStatus: trackedSourceStatus.value }),
        },
        observation.commandResult.outputTruncated === true ||
          stdout.truncated ||
          stderr.truncated ||
          spawnError?.truncated === true ||
          trackedSourceStatus?.truncated === true,
      );
    },
    writeOracle: async (report, preparation) => {
      const setupFailure =
        report.setupFailure === undefined
          ? undefined
          : sanitizeBounded(report.setupFailure, input.redactedRoots, MAX_STATUS_BYTES);
      const consoleErrors = sanitizeList(report.consoleErrors, input.redactedRoots);
      const failedRequests = sanitizeList(report.failedRequests, input.redactedRoots);
      const preparationLogs = sanitizeOraclePreparation(preparation, input.redactedRoots);
      return await retain(
        input.outputRoot,
        PREFLIGHT_EVIDENCE_FILES.oracleSummary,
        {
          schemaVersion: 1,
          kind: 'oracle_summary',
          oracleId: report.oracleId,
          status: report.status,
          preparation: report.preparation,
          preparationLogs: preparationLogs.values,
          checks: report.checks.map(({ id, claims, status, evidence }) => ({
            id,
            claims,
            status,
            evidence: sanitizeList(evidence, input.redactedRoots).values,
          })),
          ...(setupFailure === undefined ? {} : { setupFailure: setupFailure.value }),
          consoleErrors: consoleErrors.values,
          failedRequests: failedRequests.values,
        },
        setupFailure?.truncated === true ||
          consoleErrors.truncated ||
          failedRequests.truncated ||
          preparationLogs.truncated,
      );
    },
    writeOracleFailure: async (error, preparation) => {
      const failure = sanitizeBounded(
        error instanceof Error ? error.message : String(error),
        input.redactedRoots,
        MAX_STATUS_BYTES,
      );
      const preparationLogs = sanitizeOraclePreparation(preparation, input.redactedRoots);
      return await retain(
        input.outputRoot,
        PREFLIGHT_EVIDENCE_FILES.oracleSummary,
        {
          schemaVersion: 1,
          kind: 'oracle_summary',
          oracleId: 'petrinaut-optimization-oracles-v1',
          status: 'setup_failed',
          thrownFailure: failure.value,
          preparationLogs: preparationLogs.values,
        },
        failure.truncated || preparationLogs.truncated,
      );
    },
  };
}

function sanitizeOraclePreparation(
  observations: readonly PetrinautOraclePreparationObservation[],
  roots: readonly string[],
): { readonly values: readonly unknown[]; readonly truncated: boolean } {
  let truncated = false;
  const values = observations.map(({ id, commandResult }) => {
    const stdout = sanitizeBounded(commandResult.stdout, roots, MAX_ORACLE_STREAM_BYTES);
    const stderr = sanitizeBounded(commandResult.stderr, roots, MAX_ORACLE_STREAM_BYTES);
    const spawnError =
      commandResult.spawnError === undefined
        ? undefined
        : sanitizeBounded(commandResult.spawnError, roots, MAX_ORACLE_STREAM_BYTES);
    truncated ||=
      commandResult.outputTruncated === true ||
      stdout.truncated ||
      stderr.truncated ||
      spawnError?.truncated === true;
    return {
      id,
      exitCode: commandResult.exitCode,
      stdout: stdout.value,
      stderr: stderr.value,
      ...(spawnError === undefined ? {} : { spawnError: spawnError.value }),
      aborted: commandResult.aborted === true,
      timedOut: commandResult.timedOut === true,
      outputTruncated: commandResult.outputTruncated === true || stdout.truncated || stderr.truncated,
    };
  });
  return { values, truncated };
}

async function retain(
  outputRoot: string,
  file: RetainedPreflightEvidence['file'],
  value: unknown,
  truncated: boolean,
): Promise<RetainedPreflightEvidence> {
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(join(outputRoot, file), bytes, {
    encoding: 'utf8',
    flag: 'wx',
  });
  return retainedPreflightEvidenceSchema.parse({
    file,
    sha256: sha256(bytes),
    bytes: Buffer.byteLength(bytes, 'utf8'),
    truncated,
  });
}

function sanitizeList(
  values: readonly string[],
  roots: readonly string[],
): { readonly values: readonly string[]; readonly truncated: boolean } {
  let remaining = MAX_STREAM_BYTES;
  let truncated = false;
  const sanitized: string[] = [];
  for (const value of values) {
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    const result = sanitizeBounded(value, roots, remaining);
    sanitized.push(result.value);
    remaining -= Buffer.byteLength(result.value, 'utf8');
    truncated ||= result.truncated;
  }
  return { values: sanitized, truncated };
}

function sanitizeBounded(
  value: string,
  roots: readonly string[],
  maxBytes: number,
): { readonly value: string; readonly truncated: boolean } {
  let sanitized = value;
  for (const root of [...roots].sort((left, right) => right.length - left.length)) {
    sanitized = sanitized.split(root).join('<redacted:path>');
  }
  sanitized = sanitized
    .replace(/:\/\/[^/\s:@]+:[^/\s@]+@/gu, '://<redacted:credential>@')
    .replace(/\b(token|password|authorization|api[_-]?key)\s*[:=]\s*[^\s,;]+/giu, '$1=<redacted:secret>')
    .replace(/(^|[\s("'=])\/(?:[^/\s"'(),;]+\/)*[^/\s"'(),;]*/gmu, '$1<redacted:path>')
    .replace(/[A-Za-z]:\\(?:[^\\\s"'(),;]+\\)*[^\\\s"'(),;]*/gu, '<redacted:path>');
  const buffer = Buffer.from(sanitized, 'utf8');
  if (buffer.byteLength <= maxBytes) {
    return { value: sanitized, truncated: false };
  }
  return {
    value: buffer.subarray(0, maxBytes).toString('utf8'),
    truncated: true,
  };
}

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

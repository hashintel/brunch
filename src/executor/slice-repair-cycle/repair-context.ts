import { createHash, randomUUID } from 'node:crypto';
import { link, open, readFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { durableEnsureDirectory, fsyncDirectory } from '../durable-file.js';
import type {
  ActiveSliceRepairContext,
  PendingSliceRepair,
  SliceRepairContext,
  SliceRepairDiagnostic,
  SliceRepairHistory,
  SliceRepairPolicy,
  SliceRepairTarget,
} from './model.js';
import { assertSliceRepairHistory } from './model.js';

export const REPAIR_DIAGNOSTIC_LIMIT_BYTES = 16 * 1024;
export const REPAIR_CONTEXT_LIMIT_BYTES = 64 * 1024;

export interface RepairContextExpectations {
  readonly runId: string;
  readonly sliceId: string;
  readonly cycle: number;
  readonly sourceCycle: number;
  readonly sourceVerifyArtifactOrdinal: number;
  readonly sourceStageAttempt: number;
  readonly path: string;
  readonly digest: string;
  readonly target: SliceRepairTarget;
  readonly canonicalBytes?: string;
}

export interface TrustedPendingRepairState {
  readonly runDir: string;
  readonly runId: string;
  readonly sliceId: string;
  readonly target?: SliceRepairTarget;
  readonly policy: SliceRepairPolicy;
  readonly history: SliceRepairHistory;
}

export function repairContextPath(args: {
  readonly runDir: string;
  readonly sliceId: string;
  readonly cycle: number;
}): string {
  assertSafeIdentity('sliceId', args.sliceId);
  assertPositiveInteger('cycle', args.cycle);
  return join(args.runDir, 'agent-output', args.sliceId, `repair-cycle-${args.cycle}`, 'context.json');
}

export function buildPendingSliceRepair(args: {
  readonly runDir: string;
  readonly runId: string;
  readonly sliceId: string;
  readonly nextCycle: number;
  readonly sourceCycle: number;
  readonly sourceVerifyArtifactOrdinal: number;
  readonly sourceStageAttempt: number;
  readonly target: SliceRepairTarget;
  readonly exitCode: number;
  readonly stdout: SliceRepairDiagnostic;
  readonly stderr: SliceRepairDiagnostic;
}): PendingSliceRepair {
  assertSafeIdentity('runId', args.runId);
  assertSafeIdentity('sliceId', args.sliceId);
  for (const [label, value] of [
    ['nextCycle', args.nextCycle],
    ['sourceCycle', args.sourceCycle],
    ['sourceVerifyArtifactOrdinal', args.sourceVerifyArtifactOrdinal],
    ['sourceStageAttempt', args.sourceStageAttempt],
  ] as const) {
    assertPositiveInteger(label, value);
  }
  if (args.nextCycle !== args.sourceCycle + 1) {
    throw new Error('repair cycle must immediately follow source cycle');
  }
  assertFiniteInteger('exitCode', args.exitCode);
  assertTarget(args.target);
  assertDiagnostic(args.stdout);
  assertDiagnostic(args.stderr);
  const targetDigest = digestTarget(args.target);
  const context: SliceRepairContext = {
    version: 1,
    runId: args.runId,
    sliceId: args.sliceId,
    cycle: args.nextCycle,
    source: {
      cycle: args.sourceCycle,
      verifyArtifactOrdinal: args.sourceVerifyArtifactOrdinal,
      stageAttempt: args.sourceStageAttempt,
    },
    target: args.target,
    targetDigest,
    diagnostic: {
      exitCode: args.exitCode,
      stdout: args.stdout,
      stderr: args.stderr,
    },
  };
  const contextBytes = canonicalContextBytes(context);
  if (Buffer.byteLength(contextBytes, 'utf8') > REPAIR_CONTEXT_LIMIT_BYTES) {
    throw new Error('repair context exceeds byte limit');
  }
  return {
    phase: 'pending',
    runId: args.runId,
    sliceId: args.sliceId,
    cycle: args.nextCycle,
    sourceCycle: args.sourceCycle,
    sourceVerifyArtifactOrdinal: args.sourceVerifyArtifactOrdinal,
    sourceStageAttempt: args.sourceStageAttempt,
    contextPath: repairContextPath({
      runDir: args.runDir,
      sliceId: args.sliceId,
      cycle: args.nextCycle,
    }),
    contextDigest: digestBytes(contextBytes),
    contextBytes,
  };
}

/**
 * Publishes only complete, fsynced context bytes. A crash can leave an
 * unreferenced same-directory temp, but never a partial final context.
 */
export async function materializePendingSliceRepair(args: {
  readonly pending: PendingSliceRepair;
  readonly trusted: TrustedPendingRepairState;
}): Promise<PendingSliceRepair> {
  const { pending } = args;
  validatePendingSliceRepair({ pending, trusted: args.trusted });
  const directory = dirname(pending.contextPath);
  await durableEnsureDirectory(directory, args.trusted.runDir);

  const tempPath = join(directory, `.context-${process.pid}-${randomUUID()}.tmp`);
  const handle = await open(tempPath, 'wx', 0o600);
  try {
    await handle.writeFile(pending.contextBytes, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }

  try {
    try {
      await link(tempPath, pending.contextPath);
      await fsyncDirectory(directory);
    } catch (error) {
      if (!isAlreadyExists(error)) throw error;
      const existing = await readContextBytes(pending.contextPath);
      if (existing !== pending.contextBytes) {
        throw new Error('repair context conflicts with pending canonical bytes');
      }
    }
  } finally {
    await rm(tempPath, { force: true });
  }
  await fsyncDirectory(directory);
  return { ...pending, phase: 'materialized' };
}

export function validatePendingSliceRepair(args: {
  readonly pending: PendingSliceRepair;
  readonly trusted: TrustedPendingRepairState;
}): SliceRepairContext {
  return validateRepairAuthorityState(args, false);
}

function validateRepairAuthorityState(
  args: {
    readonly pending: PendingSliceRepair;
    readonly trusted: TrustedPendingRepairState;
  },
  allowActiveCycle: boolean,
): SliceRepairContext {
  const { pending, trusted } = args;
  assertSliceRepairHistory(trusted.history, trusted.policy);
  assertSafeIdentity('runId', trusted.runId);
  assertSafeIdentity('sliceId', trusted.sliceId);
  if (!trusted.target) throw new Error('repair target unavailable');
  assertTarget(trusted.target);
  const context = parsePendingContext(pending);
  const cycles = trusted.history[trusted.sliceId];
  const sourceCycle = cycles?.find((cycle) => cycle.cycle === pending.sourceCycle);
  const sourceEndpoint = sourceCycle?.epochs.at(-1);
  const currentCycle = cycles?.at(-1);
  const expectedPath = repairContextPath({
    runDir: trusted.runDir,
    sliceId: trusted.sliceId,
    cycle: pending.cycle,
  });
  if (
    pending.runId !== trusted.runId ||
    pending.sliceId !== trusted.sliceId ||
    pending.cycle !== pending.sourceCycle + 1 ||
    pending.cycle > trusted.policy.maxRepairCycles ||
    sourceCycle?.cycle !== pending.sourceCycle ||
    (allowActiveCycle
      ? currentCycle?.cycle !== pending.sourceCycle && currentCycle?.cycle !== pending.cycle
      : currentCycle?.cycle !== pending.sourceCycle) ||
    (currentCycle?.cycle === pending.cycle &&
      currentCycle.epochs.some((epoch) => epoch.verdict !== undefined)) ||
    sourceEndpoint?.stage !== 'verify' ||
    sourceEndpoint.outcome !== 'succeeded' ||
    sourceEndpoint.verdict !== 'failed' ||
    sourceEndpoint.artifactOrdinalEnd !== pending.sourceVerifyArtifactOrdinal ||
    sourceEndpoint.attempts !== pending.sourceStageAttempt ||
    resolve(pending.contextPath) !== resolve(expectedPath) ||
    !targetsEqual(context.target, trusted.target)
  ) {
    throw new Error('pending repair does not match trusted run state');
  }
  return context;
}

export async function validateActiveSliceRepair(args: {
  readonly authority: PendingSliceRepair;
  readonly reference: ActiveSliceRepairContext;
  readonly trusted: TrustedPendingRepairState;
}): Promise<SliceRepairContext> {
  const { authority, reference, trusted } = args;
  validateRepairAuthorityState({ pending: authority, trusted }, true);
  if (authority.phase !== 'materialized') {
    throw new Error('active repair authority is not materialized');
  }
  if (
    reference.runId !== trusted.runId ||
    reference.sliceId !== trusted.sliceId ||
    reference.cycle !== authority.cycle ||
    reference.sourceCycle !== authority.sourceCycle ||
    reference.sourceVerifyArtifactOrdinal !== authority.sourceVerifyArtifactOrdinal ||
    reference.sourceStageAttempt !== authority.sourceStageAttempt ||
    resolve(reference.path) !== resolve(authority.contextPath) ||
    reference.digest !== authority.contextDigest ||
    !trusted.target ||
    !targetsEqual(reference.target, trusted.target)
  ) {
    throw new Error('active repair reference does not match trusted authority');
  }
  return readValidatedRepairContext({
    runId: trusted.runId,
    sliceId: trusted.sliceId,
    cycle: authority.cycle,
    sourceCycle: authority.sourceCycle,
    sourceVerifyArtifactOrdinal: authority.sourceVerifyArtifactOrdinal,
    sourceStageAttempt: authority.sourceStageAttempt,
    path: authority.contextPath,
    digest: authority.contextDigest,
    target: trusted.target,
    canonicalBytes: authority.contextBytes,
  });
}

export async function readValidatedRepairContext(
  expectations: RepairContextExpectations,
): Promise<SliceRepairContext> {
  assertSafeIdentity('runId', expectations.runId);
  assertSafeIdentity('sliceId', expectations.sliceId);
  const bytes = await readFile(expectations.path);
  if (bytes.byteLength > REPAIR_CONTEXT_LIMIT_BYTES) throw new Error('repair context exceeds byte limit');
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('repair context is not valid UTF-8');
  }
  if (expectations.canonicalBytes !== undefined && text !== expectations.canonicalBytes) {
    throw new Error('repair context bytes do not match trusted authority');
  }
  if (digestBytes(text) !== expectations.digest) throw new Error('repair context digest mismatch');
  const context = parseRepairContext(JSON.parse(text));
  if (canonicalContextBytes(context) !== text) throw new Error('repair context is not canonical');
  if (
    context.runId !== expectations.runId ||
    context.sliceId !== expectations.sliceId ||
    context.cycle !== expectations.cycle ||
    context.source.cycle !== expectations.sourceCycle ||
    context.source.verifyArtifactOrdinal !== expectations.sourceVerifyArtifactOrdinal ||
    context.source.stageAttempt !== expectations.sourceStageAttempt
  ) {
    throw new Error('repair context provenance mismatch');
  }
  if (!targetsEqual(context.target, expectations.target)) throw new Error('repair target mismatch');
  if (
    context.targetDigest !== digestTarget(context.target) ||
    context.targetDigest !== digestTarget(expectations.target)
  ) {
    throw new Error('repair target digest mismatch');
  }
  return context;
}

export function canonicalContextBytes(context: SliceRepairContext): string {
  return JSON.stringify({
    version: context.version,
    runId: context.runId,
    sliceId: context.sliceId,
    cycle: context.cycle,
    source: {
      cycle: context.source.cycle,
      verifyArtifactOrdinal: context.source.verifyArtifactOrdinal,
      stageAttempt: context.source.stageAttempt,
    },
    target: { command: context.target.command, args: [...context.target.args] },
    targetDigest: context.targetDigest,
    diagnostic: {
      exitCode: context.diagnostic.exitCode,
      stdout: context.diagnostic.stdout,
      stderr: context.diagnostic.stderr,
    },
  });
}

export function boundedDiagnostic(value: string): SliceRepairDiagnostic {
  const limit = REPAIR_DIAGNOSTIC_LIMIT_BYTES;
  const originalBytes = Buffer.byteLength(value, 'utf8');
  if (originalBytes <= limit) return { text: value, utf8Bytes: originalBytes, truncated: false };
  let text = '';
  let utf8Bytes = 0;
  for (const character of value) {
    const bytes = Buffer.byteLength(character, 'utf8');
    if (utf8Bytes + bytes > limit) break;
    text += character;
    utf8Bytes += bytes;
  }
  return { text, utf8Bytes, truncated: true };
}

export function digestTarget(target: SliceRepairTarget): string {
  assertTarget(target);
  return digestBytes(JSON.stringify({ command: target.command, args: [...target.args] }));
}

export function digestBytes(bytes: string | Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function parsePendingContext(pending: PendingSliceRepair): SliceRepairContext {
  if (
    (pending.phase !== 'pending' && pending.phase !== 'materialized') ||
    !isSafeIdentity(pending.runId) ||
    !isSafeIdentity(pending.sliceId) ||
    !isPositiveInteger(pending.cycle) ||
    !isPositiveInteger(pending.sourceCycle) ||
    !isPositiveInteger(pending.sourceVerifyArtifactOrdinal) ||
    !isPositiveInteger(pending.sourceStageAttempt) ||
    typeof pending.contextPath !== 'string' ||
    typeof pending.contextDigest !== 'string' ||
    typeof pending.contextBytes !== 'string' ||
    Buffer.byteLength(pending.contextBytes, 'utf8') > REPAIR_CONTEXT_LIMIT_BYTES ||
    digestBytes(pending.contextBytes) !== pending.contextDigest
  ) {
    throw new Error('invalid pending slice repair');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(pending.contextBytes);
  } catch {
    throw new Error('invalid pending repair context bytes');
  }
  const context = parseRepairContext(parsed);
  if (
    canonicalContextBytes(context) !== pending.contextBytes ||
    context.runId !== pending.runId ||
    context.sliceId !== pending.sliceId ||
    context.cycle !== pending.cycle ||
    context.source.cycle !== pending.sourceCycle ||
    context.source.verifyArtifactOrdinal !== pending.sourceVerifyArtifactOrdinal ||
    context.source.stageAttempt !== pending.sourceStageAttempt
  ) {
    throw new Error('pending repair context identity mismatch');
  }
  return context;
}

function parseRepairContext(value: unknown): SliceRepairContext {
  if (!isRecord(value) || value.version !== 1) throw new Error('invalid repair context');
  if (!isSafeIdentity(value.runId) || !isSafeIdentity(value.sliceId) || !isPositiveInteger(value.cycle)) {
    throw new Error('invalid repair context identity');
  }
  if (
    !isRecord(value.source) ||
    !isPositiveInteger(value.source.cycle) ||
    !isPositiveInteger(value.source.verifyArtifactOrdinal) ||
    !isPositiveInteger(value.source.stageAttempt)
  ) {
    throw new Error('invalid repair context source');
  }
  const target = parseTarget(value.target);
  if (typeof value.targetDigest !== 'string' || value.targetDigest !== digestTarget(target)) {
    throw new Error('invalid repair target digest');
  }
  if (
    !isRecord(value.diagnostic) ||
    typeof value.diagnostic.exitCode !== 'number' ||
    !Number.isInteger(value.diagnostic.exitCode) ||
    !Number.isFinite(value.diagnostic.exitCode)
  ) {
    throw new Error('invalid repair diagnostic');
  }
  return {
    version: 1,
    runId: value.runId,
    sliceId: value.sliceId,
    cycle: value.cycle,
    source: {
      cycle: value.source.cycle,
      verifyArtifactOrdinal: value.source.verifyArtifactOrdinal,
      stageAttempt: value.source.stageAttempt,
    },
    target,
    targetDigest: value.targetDigest,
    diagnostic: {
      exitCode: value.diagnostic.exitCode,
      stdout: parseDiagnostic(value.diagnostic.stdout),
      stderr: parseDiagnostic(value.diagnostic.stderr),
    },
  };
}

function parseTarget(value: unknown): SliceRepairTarget {
  if (
    !isRecord(value) ||
    typeof value.command !== 'string' ||
    value.command.length === 0 ||
    !Array.isArray(value.args) ||
    !value.args.every((item) => typeof item === 'string')
  ) {
    throw new Error('invalid repair target');
  }
  return { command: value.command, args: value.args };
}

function parseDiagnostic(value: unknown): SliceRepairDiagnostic {
  if (
    !isRecord(value) ||
    typeof value.text !== 'string' ||
    typeof value.utf8Bytes !== 'number' ||
    !Number.isInteger(value.utf8Bytes) ||
    value.utf8Bytes < 0 ||
    typeof value.truncated !== 'boolean' ||
    value.utf8Bytes !== Buffer.byteLength(value.text, 'utf8') ||
    value.utf8Bytes > REPAIR_DIAGNOSTIC_LIMIT_BYTES ||
    (value.truncated && value.utf8Bytes < REPAIR_DIAGNOSTIC_LIMIT_BYTES - 3)
  ) {
    throw new Error('invalid repair diagnostic bytes');
  }
  return { text: value.text, utf8Bytes: value.utf8Bytes, truncated: value.truncated };
}

function assertDiagnostic(value: SliceRepairDiagnostic): void {
  parseDiagnostic(value);
}

function assertTarget(value: SliceRepairTarget): void {
  parseTarget(value);
}

function targetsEqual(left: SliceRepairTarget, right: SliceRepairTarget): boolean {
  return (
    left.command === right.command &&
    left.args.length === right.args.length &&
    left.args.every((argument, index) => argument === right.args[index])
  );
}

async function readContextBytes(path: string): Promise<string> {
  const bytes = await readFile(path);
  if (bytes.byteLength > REPAIR_CONTEXT_LIMIT_BYTES) return '';
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return '';
  }
}

function isAlreadyExists(error: unknown): boolean {
  return isRecord(error) && error.code === 'EEXIST';
}

function assertSafeIdentity(label: string, value: string): void {
  if (!isSafeIdentity(value)) throw new Error(`invalid ${label}`);
}

function isSafeIdentity(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9._-]+$/.test(value) && !value.includes('..');
}

function assertPositiveInteger(label: string, value: number): void {
  if (!isPositiveInteger(value)) throw new Error(`invalid ${label}`);
}

function assertFiniteInteger(label: string, value: number): void {
  if (!Number.isInteger(value) || !Number.isFinite(value)) throw new Error(`invalid ${label}`);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, normalize } from 'node:path';

export type ExecutionAttemptOutcome = 'success' | 'failure' | 'exhausted' | 'invalid';
export type AssessableNumber = number | 'not_assessable';
export type AssessableSha = string;

export interface ExecutionAttempt {
  readonly schemaVersion: 1;
  readonly attemptId: string;
  readonly caseId: string;
  readonly lane: 'brunch' | 'claude_code';
  readonly publicPacketSha256: string;
  readonly oraclePackSha256: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly budget: {
    readonly elapsedMinutes: number;
    readonly mechanicalInterventions: number;
    readonly substantiveHumanInterventions: number;
  };
  readonly versions: {
    readonly product: string;
    readonly provider: string;
    readonly model: string;
    readonly harness: string;
    readonly actorRecipe: string;
    readonly node: string;
    readonly npm: string;
    readonly os: string;
    readonly architecture: string;
  };
  readonly repository: {
    readonly baseSha: string;
    readonly reviewSha: AssessableSha;
    readonly finalGitRange: string;
  };
  readonly terminal: {
    readonly outcome: ExecutionAttemptOutcome;
    readonly reason: string;
    readonly productStatus: string;
  };
  readonly validity: {
    readonly status: 'valid' | 'invalid';
    readonly reasons: readonly string[];
  };
  readonly commands: readonly {
    readonly id: string;
    readonly status: 'passed' | 'failed' | 'not_run';
    readonly exitCode: AssessableNumber;
    readonly stdoutPath: string;
    readonly stderrPath: string;
  }[];
  readonly browser: {
    readonly status: 'passed' | 'failed' | 'not_run';
    readonly reportPath: string;
  };
  readonly interventions: readonly {
    readonly index: number;
    readonly kind: 'mechanical';
    readonly description: string;
    readonly at: string;
  }[];
  readonly commonMetrics: {
    readonly elapsedMs: number;
    readonly inputTokens: AssessableNumber;
    readonly outputTokens: AssessableNumber;
    readonly costUsd: AssessableNumber;
    readonly permissionPrompts: AssessableNumber;
  };
  readonly evidence: {
    readonly finalTreePath: string;
    readonly finalDiffPath: string;
    readonly visibleProcessPath: string;
  };
  readonly cleanup: {
    readonly status: 'clean' | 'residue';
    readonly liveProcesses: number;
    readonly liveSessions: number;
  };
}

export function parseExecutionAttempt(value: unknown): ExecutionAttempt {
  if (!record(value)) invalid();
  const budget = child(value, 'budget');
  const versions = child(value, 'versions');
  const repository = child(value, 'repository');
  const terminal = child(value, 'terminal');
  const validity = child(value, 'validity');
  const browser = child(value, 'browser');
  const metrics = child(value, 'commonMetrics');
  const evidence = child(value, 'evidence');
  const cleanup = child(value, 'cleanup');
  const outcome = terminal['outcome'];

  if (
    value['schemaVersion'] !== 1 ||
    !safeId(value['attemptId']) ||
    !nonempty(value['caseId']) ||
    (value['lane'] !== 'brunch' && value['lane'] !== 'claude_code') ||
    !sha256(value['publicPacketSha256']) ||
    !sha256(value['oraclePackSha256']) ||
    !orderedTimestamps(value['startedAt'], value['endedAt']) ||
    !positiveInteger(budget['elapsedMinutes']) ||
    !nonnegativeInteger(budget['mechanicalInterventions']) ||
    budget['substantiveHumanInterventions'] !== 0 ||
    !allNonempty(versions, [
      'product',
      'provider',
      'model',
      'harness',
      'actorRecipe',
      'node',
      'npm',
      'os',
      'architecture',
    ]) ||
    !gitSha(repository['baseSha']) ||
    !assessableSha(repository['reviewSha']) ||
    !gitRange(repository['finalGitRange'], repository['baseSha'], repository['reviewSha']) ||
    !outcomeValue(outcome) ||
    !nonempty(terminal['reason']) ||
    !nonempty(terminal['productStatus']) ||
    terminal['productStatus'] === 'landed' ||
    !validityRecord(validity, outcome) ||
    !commandRecords(value['commands']) ||
    !statusValue(browser['status']) ||
    !safeRelativePath(browser['reportPath']) ||
    !interventionRecords(value['interventions'], budget['mechanicalInterventions']) ||
    !nonnegativeInteger(metrics['elapsedMs']) ||
    !assessableNumber(metrics['inputTokens']) ||
    !assessableNumber(metrics['outputTokens']) ||
    !assessableNumber(metrics['costUsd']) ||
    !assessableNumber(metrics['permissionPrompts']) ||
    !allSafePaths(evidence, ['finalTreePath', 'finalDiffPath', 'visibleProcessPath']) ||
    (cleanup['status'] !== 'clean' && cleanup['status'] !== 'residue') ||
    !nonnegativeInteger(cleanup['liveProcesses']) ||
    !nonnegativeInteger(cleanup['liveSessions']) ||
    (cleanup['status'] === 'clean' && (cleanup['liveProcesses'] !== 0 || cleanup['liveSessions'] !== 0))
  ) {
    invalid();
  }

  return value as unknown as ExecutionAttempt;
}

export async function writeExecutionAttemptImmutable(
  attemptsRoot: string,
  value: ExecutionAttempt,
): Promise<string> {
  const attempt = parseExecutionAttempt(value);
  const attemptDir = join(attemptsRoot, attempt.attemptId);
  try {
    await mkdir(attemptDir);
  } catch (error) {
    if (record(error) && error['code'] === 'EEXIST') {
      throw new Error(`execution attempt ${attempt.attemptId} already exists`);
    }
    throw error;
  }
  const artifactPath = join(attemptDir, 'attempt.json');
  await writeFile(artifactPath, `${JSON.stringify(attempt, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  return artifactPath;
}

function validityRecord(value: Record<string, unknown>, outcome: ExecutionAttemptOutcome): boolean {
  if (
    (value['status'] !== 'valid' && value['status'] !== 'invalid') ||
    !Array.isArray(value['reasons']) ||
    !value['reasons'].every(nonempty)
  ) {
    return false;
  }
  return outcome === 'invalid'
    ? value['status'] === 'invalid' && value['reasons'].length > 0
    : value['status'] === 'valid' && value['reasons'].length === 0;
}

function commandRecords(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) return false;
  const ids = new Set<string>();
  return value.every((item) => {
    if (!record(item) || !nonempty(item['id']) || ids.has(item['id'])) return false;
    ids.add(item['id']);
    if (
      !statusValue(item['status']) ||
      !assessableNumber(item['exitCode']) ||
      !safeRelativePath(item['stdoutPath']) ||
      !safeRelativePath(item['stderrPath'])
    ) {
      return false;
    }
    if (item['status'] === 'passed') return item['exitCode'] === 0;
    if (item['status'] === 'failed') return typeof item['exitCode'] === 'number' && item['exitCode'] !== 0;
    return item['exitCode'] === 'not_assessable';
  });
}

function interventionRecords(value: unknown, budget: number): boolean {
  if (!Array.isArray(value) || value.length > budget) return false;
  return value.every(
    (item, index) =>
      record(item) &&
      item['index'] === index + 1 &&
      item['kind'] === 'mechanical' &&
      nonempty(item['description']) &&
      timestamp(item['at']),
  );
}

function gitRange(range: unknown, baseSha: unknown, reviewSha: unknown): boolean {
  if (range === 'not_assessable') return reviewSha === 'not_assessable';
  return (
    typeof range === 'string' &&
    typeof baseSha === 'string' &&
    typeof reviewSha === 'string' &&
    reviewSha !== 'not_assessable' &&
    range === `${baseSha}..${reviewSha}`
  );
}

function allNonempty(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => nonempty(value[key]));
}

function allSafePaths(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => safeRelativePath(value[key]));
}

function child(value: Record<string, unknown>, key: string): Record<string, unknown> {
  const selected = value[key];
  if (!record(selected)) invalid();
  return selected;
}

function orderedTimestamps(start: unknown, end: unknown): boolean {
  return timestamp(start) && timestamp(end) && Date.parse(end) >= Date.parse(start);
}

function timestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function safeRelativePath(value: unknown): value is string {
  if (!nonempty(value) || isAbsolute(value)) return false;
  const normalized = normalize(value);
  return normalized !== '..' && !normalized.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`);
}

function statusValue(value: unknown): value is 'passed' | 'failed' | 'not_run' {
  return value === 'passed' || value === 'failed' || value === 'not_run';
}

function outcomeValue(value: unknown): value is ExecutionAttemptOutcome {
  return value === 'success' || value === 'failure' || value === 'exhausted' || value === 'invalid';
}

function assessableNumber(value: unknown): value is AssessableNumber {
  return value === 'not_assessable' || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
}

function assessableSha(value: unknown): value is AssessableSha {
  return value === 'not_assessable' || gitSha(value);
}

function sha256(value: unknown): value is string {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/u.test(value);
}

function gitSha(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{40}$/u.test(value);
}

function safeId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]*$/u.test(value);
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function nonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function positiveInteger(value: unknown): value is number {
  return nonnegativeInteger(value) && value > 0;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(): never {
  throw new Error('invalid execution attempt artifact');
}

import { lstat, readFile, readdir } from 'node:fs/promises';
import { basename, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';

import { parseExecutionAttempt, type ExecutionAttempt } from './artifact-contract.js';

export interface ExecutionComparisonAttemptSummary {
  readonly attempt: ExecutionAttempt;
  readonly recordPath: string;
}

export interface ExecutionComparisonSummary {
  readonly runDirectory: string;
  readonly runId: string;
  readonly caseId: string;
  readonly reportPath: string;
  readonly attempts: readonly ExecutionComparisonAttemptSummary[];
}

export async function loadExecutionComparisonSummary(
  runDirectoryInput: string,
): Promise<ExecutionComparisonSummary> {
  const runDirectory = resolve(runDirectoryInput);
  const reportPath = join(runDirectory, 'report.md');
  if (!(await isRegularFile(reportPath))) {
    throw new Error(`execution comparison report is missing: ${reportPath}`);
  }

  const attemptsRoot = join(runDirectory, 'attempt-records');
  const entries = await readdir(attemptsRoot, { withFileTypes: true });
  const attempts: ExecutionComparisonAttemptSummary[] = [];
  for (const entry of entries.sort((left, right) => codePointCompare(left.name, right.name))) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const recordPath = join(attemptsRoot, entry.name, 'attempt.json');
    const value = JSON.parse(await readFile(recordPath, 'utf8')) as unknown;
    const attempt = parseExecutionAttempt(value);
    if (attempt.attemptId !== entry.name) {
      throw new Error(`execution attempt directory does not match attempt id: ${entry.name}`);
    }
    attempts.push({ attempt, recordPath });
  }
  if (attempts.length === 0) {
    throw new Error(`execution comparison has no retained attempts: ${attemptsRoot}`);
  }

  attempts.sort((left, right) => {
    const byStart = codePointCompare(left.attempt.startedAt, right.attempt.startedAt);
    return byStart === 0 ? codePointCompare(left.attempt.attemptId, right.attempt.attemptId) : byStart;
  });
  const caseId = attempts[0]!.attempt.caseId;
  const publicPacketSha256 = attempts[0]!.attempt.publicPacketSha256;
  const oraclePackSha256 = attempts[0]!.attempt.oraclePackSha256;
  if (
    attempts.some(
      ({ attempt }) =>
        attempt.caseId !== caseId ||
        attempt.publicPacketSha256 !== publicPacketSha256 ||
        attempt.oraclePackSha256 !== oraclePackSha256,
    )
  ) {
    throw new Error('execution comparison attempts do not share one case and frozen evidence set');
  }

  return {
    runDirectory,
    runId: basename(runDirectory),
    caseId,
    reportPath,
    attempts,
  };
}

export function formatExecutionComparisonSummary(
  summary: ExecutionComparisonSummary,
  baseDirectory: string,
): string {
  const lines = [
    'Execution comparison complete',
    '=============================',
    '',
    `Case: ${summary.caseId}`,
    `Run: ${summary.runId}`,
    '',
    'Results',
    '-------',
  ];

  for (const { attempt } of summary.attempts) {
    const commands = attempt.commands
      .map((command) => `${command.id} ${displayStatus(command.status)}`)
      .join(', ');
    lines.push('', laneLabel(attempt.lane));
    lines.push(`  Status: ${attempt.validity.status}`);
    lines.push(`  Outcome: ${attempt.terminal.outcome}`);
    lines.push(`  Terminal: ${attempt.terminal.productStatus}`);
    lines.push(`  Checks: ${commands}, browser ${displayStatus(attempt.browser.status)}`);
    if (attempt.validity.status === 'invalid') {
      lines.push(`  Reason: ${attempt.validity.reasons[0]}`);
    }
  }

  const cleanup = summary.attempts.every(({ attempt }) => attempt.cleanup.status === 'clean')
    ? 'done'
    : 'residue';
  lines.push('', `Cleanup: ${cleanup}`, '', 'Artifacts', '---------');
  lines.push(`- Report: ${absolutePath(summary.reportPath, baseDirectory)}`);
  for (const { attempt, recordPath } of summary.attempts) {
    lines.push(`- ${laneLabel(attempt.lane)} attempt: ${absolutePath(recordPath, baseDirectory)}`);
    lines.push(`- ${laneLabel(attempt.lane)} oracle: ${absoluteOraclePath(summary, attempt, baseDirectory)}`);
  }
  return `${lines.join('\n')}\n`;
}

function displayStatus(status: 'passed' | 'failed' | 'not_run'): string {
  return status === 'not_run' ? 'not run' : status;
}

function laneLabel(lane: ExecutionAttempt['lane']): string {
  return lane === 'brunch' ? 'Brunch' : 'Claude Code';
}

function absolutePath(path: string, baseDirectory: string): string {
  return resolve(baseDirectory, path);
}

function absoluteOraclePath(
  summary: ExecutionComparisonSummary,
  attempt: ExecutionAttempt,
  baseDirectory: string,
): string {
  const reportPath = normalize(attempt.browser.reportPath);
  if (reportPath.startsWith(`browser${sep}`)) {
    return resolve(summary.runDirectory, 'lanes', attempt.lane, 'attempt-staging', reportPath);
  }

  const repositoryRelative = absolutePath(reportPath, baseDirectory);
  return inside(summary.runDirectory, repositoryRelative)
    ? repositoryRelative
    : resolve(summary.runDirectory, reportPath);
}

function inside(parent: string, child: string): boolean {
  const selected = relative(parent, child);
  return selected === '' || (!isAbsolute(selected) && selected !== '..' && !selected.startsWith(`..${sep}`));
}

async function isRegularFile(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isFile();
  } catch {
    return false;
  }
}

function codePointCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

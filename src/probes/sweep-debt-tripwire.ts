import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import type { TranscriptEntryLike } from '../projections/session/continuity-entry-classifier.js';
import {
  isCaptureSweepWatermarkEntry,
  isSweepConversationalEntry,
} from '../projections/session/sweep-watermark.js';

export type SweepDebtExpectation = 'capture' | 'ignore';

type SweepDebtOutcome = 'pass' | 'fail' | 'uncheckable';

export interface SweepDebtReport {
  readonly expectation: SweepDebtExpectation;
  readonly outcome: SweepDebtOutcome;
  readonly captureEvidence: boolean;
  readonly closingWatermarkIndex: number | null;
  readonly conversationalEntryCount: number;
  readonly reason?: 'no_checkable_closed_interval' | 'conversational_material_after_latest_watermark';
}

export function assessSweepDebt(
  entries: readonly unknown[],
  expectation: SweepDebtExpectation,
): SweepDebtReport {
  const sessionEntries = entries.map(requireEntry);
  const latestWatermarkIndex = findPreviousWatermark(sessionEntries, sessionEntries.length);

  if (
    latestWatermarkIndex !== null &&
    sessionEntries.slice(latestWatermarkIndex + 1).some(isSweepConversationalEntry)
  ) {
    return uncheckable(expectation, 'conversational_material_after_latest_watermark');
  }

  let closingWatermarkIndex = latestWatermarkIndex;
  while (closingWatermarkIndex !== null) {
    const previousWatermarkIndex = findPreviousWatermark(sessionEntries, closingWatermarkIndex);
    const interval = sessionEntries.slice((previousWatermarkIndex ?? -1) + 1, closingWatermarkIndex);
    const conversationalEntryCount = interval.filter(isSweepConversationalEntry).length;

    if (conversationalEntryCount > 0) {
      const captureEvidence = interval.some(isSuccessfulCaptureResult);
      return {
        expectation,
        outcome: captureEvidence === (expectation === 'capture') ? 'pass' : 'fail',
        captureEvidence,
        closingWatermarkIndex,
        conversationalEntryCount,
      };
    }
    closingWatermarkIndex = previousWatermarkIndex;
  }

  return uncheckable(expectation, 'no_checkable_closed_interval');
}

export function parseSessionJsonl(source: string): readonly TranscriptEntryLike[] {
  return source
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        return requireEntry(JSON.parse(line) as unknown);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid session JSONL at line ${index + 1}: ${detail}`);
      }
    });
}

function findPreviousWatermark(entries: readonly TranscriptEntryLike[], beforeIndex: number): number | null {
  for (let index = beforeIndex - 1; index >= 0; index--) {
    if (isCaptureSweepWatermarkEntry(entries[index]!)) return index;
  }
  return null;
}

function isSuccessfulCaptureResult(entry: TranscriptEntryLike): boolean {
  const message = record(entry.message);
  if (message?.role !== 'toolResult') return false;
  const details = record(message.details);
  return (
    (message.toolName === 'mutate_graph' && details?.status === 'success') ||
    (message.toolName === 'update_elicitation_scratchpad' && details?.status === 'ok')
  );
}

function requireEntry(value: unknown): TranscriptEntryLike {
  const entry = record(value);
  if (!entry || typeof entry.type !== 'string') throw new Error('entry must be an object with a string type');
  return entry;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function uncheckable(
  expectation: SweepDebtExpectation,
  reason: NonNullable<SweepDebtReport['reason']>,
): SweepDebtReport {
  return {
    expectation,
    outcome: 'uncheckable',
    captureEvidence: false,
    closingWatermarkIndex: null,
    conversationalEntryCount: 0,
    reason,
  };
}

function parseArguments(argv: readonly string[]): {
  readonly sessionPath: string;
  readonly expectation: SweepDebtExpectation;
} {
  const sessionIndex = argv.indexOf('--session');
  const expectationIndex = argv.indexOf('--expect');
  const sessionPath = sessionIndex >= 0 ? argv[sessionIndex + 1] : undefined;
  const expectation = expectationIndex >= 0 ? argv[expectationIndex + 1] : undefined;
  if (!sessionPath || (expectation !== 'capture' && expectation !== 'ignore')) {
    throw new Error(
      [
        'usage:',
        '  node --import tsx src/probes/sweep-debt-tripwire.ts --session <session.jsonl> --expect capture|ignore',
        '  node dist/probes/sweep-debt-tripwire.js --session <session.jsonl> --expect capture|ignore',
      ].join('\n'),
    );
  }
  return { sessionPath, expectation };
}

async function main(): Promise<void> {
  const { sessionPath, expectation } = parseArguments(process.argv.slice(2));
  const report = assessSweepDebt(parseSessionJsonl(await readFile(sessionPath, 'utf8')), expectation);
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.exitCode = report.outcome === 'pass' ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

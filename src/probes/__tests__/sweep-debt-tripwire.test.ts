import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { prepareCaptureSweepAdvance } from '../../projections/session/sweep-watermark.js';
import { assessSweepDebt, parseSessionJsonl, type SweepDebtExpectation } from '../sweep-debt-tripwire.js';

const marker = {
  type: 'custom',
  customType: 'brunch.capture_sweep_watermark',
  data: { sweptAt: '2026-07-13T12:00:00.000Z' },
};

function message(role: 'user' | 'assistant', content: string) {
  return { type: 'message', message: { role, content } };
}

function toolResult(toolName: string, details: unknown) {
  return { type: 'message', message: { role: 'toolResult', toolName, details } };
}

function assess(entries: readonly unknown[], expectation: SweepDebtExpectation) {
  return assessSweepDebt(entries, expectation);
}

function productionMarker(entries: readonly unknown[]) {
  const advance = prepareCaptureSweepAdvance(entries as Parameters<typeof prepareCaptureSweepAdvance>[0], {
    now: () => new Date('2026-07-13T12:00:00.000Z'),
  });
  if (!advance.marker) throw new Error('expected conversational material to advance');
  return {
    type: 'custom',
    customType: advance.marker.customType,
    data: advance.marker,
  };
}

function productionOrderedInterval(capture: boolean) {
  const bootstrap = [message('user', 'Bootstrap material.')];
  const openingMarker = productionMarker(bootstrap);
  const closedInterval = [
    message('assistant', 'I will handle the scenario.'),
    ...(capture ? [toolResult('mutate_graph', { status: 'success' })] : []),
    message('user', 'Advance once to close this interval.'),
  ];
  const closingMarker = productionMarker([...bootstrap, openingMarker, ...closedInterval]);
  return [
    ...bootstrap,
    openingMarker,
    ...closedInterval,
    closingMarker,
    message('assistant', 'New open tail.'),
  ];
}

describe('sweep-debt tripwire', () => {
  it.each([
    toolResult('mutate_graph', { status: 'success' }),
    toolResult('update_elicitation_scratchpad', { status: 'ok' }),
  ])('passes capture expectation for successful capture evidence %#', (capture) => {
    expect(
      assess([message('user', 'Keep latency under one second.'), capture, marker], 'capture'),
    ).toMatchObject({
      outcome: 'pass',
      captureEvidence: true,
    });
  });

  it.each([
    toolResult('mutate_graph', { status: 'error', code: 'STRUCTURAL_ILLEGAL' }),
    toolResult('mutate_graph', { success: true }),
    toolResult('update_elicitation_scratchpad', { status: 'error' }),
  ])('does not count failed or malformed capture attempts %#', (attempt) => {
    expect(assess([message('user', 'Capture this.'), attempt, marker], 'capture')).toMatchObject({
      outcome: 'fail',
      captureEvidence: false,
    });
  });

  it('judges the latest closed production interval with a newer assistant tail open', () => {
    expect(assess(productionOrderedInterval(true), 'capture')).toMatchObject({
      outcome: 'pass',
      captureEvidence: true,
      openingWatermarkIndex: 1,
      closingWatermarkIndex: 5,
      conversationalEntryCount: 2,
      openConversationalEntryCount: 1,
    });
  });

  it('passes ignore for production ordering only when successful capture evidence is absent', () => {
    expect(assess(productionOrderedInterval(false), 'ignore')).toMatchObject({
      outcome: 'pass',
      captureEvidence: false,
      openingWatermarkIndex: 1,
      closingWatermarkIndex: 4,
      openConversationalEntryCount: 1,
    });
    expect(assess(productionOrderedInterval(true), 'ignore').outcome).toBe('fail');
  });

  it('skips empty bootstrap intervals and selects the latest non-empty closed interval', () => {
    expect(
      assess(
        [
          message('user', 'Earlier material.'),
          marker,
          toolResult('read_graph', { status: 'success' }),
          marker,
        ],
        'ignore',
      ),
    ).toMatchObject({ outcome: 'pass', closingWatermarkIndex: 1 });
  });

  it('reserves uncheckable for sessions with no non-empty closed interval', () => {
    expect(assess([marker, toolResult('read_graph', { status: 'success' }), marker], 'ignore')).toMatchObject(
      {
        outcome: 'uncheckable',
        reason: 'no_checkable_closed_interval',
        openingWatermarkIndex: null,
        closingWatermarkIndex: null,
        openConversationalEntryCount: 0,
      },
    );
    expect(assess([message('user', 'Still open.')], 'ignore')).toMatchObject({
      outcome: 'uncheckable',
      reason: 'no_checkable_closed_interval',
      openConversationalEntryCount: 1,
    });
  });

  it('fails malformed JSONL loudly with its physical one-based line number', () => {
    const valid = message('user', 'valid');
    expect(() => parseSessionJsonl(`${JSON.stringify(valid)}\n  \n{broken}\n`)).toThrow(
      'Invalid session JSONL at line 3',
    );
    expect(parseSessionJsonl(`\n${JSON.stringify(valid)}\n`)).toEqual([valid]);
  });

  it.each([
    { expectation: 'capture' as const, capture: true, expectedStatus: 0 },
    { expectation: 'capture' as const, capture: false, expectedStatus: 1 },
    { expectation: 'ignore' as const, capture: false, expectedStatus: 0 },
    { expectation: 'ignore' as const, capture: true, expectedStatus: 1 },
  ])(
    'CLI reads JSONL and exits honestly for $expectation/$capture',
    async ({ expectation, capture, expectedStatus }) => {
      const directory = await mkdtemp(join(tmpdir(), 'sweep-debt-tripwire-'));
      const sessionPath = join(directory, 'session.jsonl');
      const entries = [
        message('user', 'Scenario material.'),
        ...(capture ? [toolResult('mutate_graph', { status: 'success' })] : []),
        marker,
      ];
      await writeFile(sessionPath, `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`);

      const result = spawnSync(
        process.execPath,
        [
          '--import',
          'tsx',
          'src/probes/sweep-debt-tripwire.ts',
          '--session',
          sessionPath,
          '--expect',
          expectation,
        ],
        { cwd: process.cwd(), encoding: 'utf8' },
      );

      expect(result.status, result.stderr).toBe(expectedStatus);
      expect(JSON.parse(result.stdout)).toMatchObject({ expectation, captureEvidence: capture });
    },
  );

  it.each([
    ['no arguments', () => []],
    [
      'an unknown option',
      (sessionPath: string) => ['--session', sessionPath, '--expect', 'ignore', '--unknown'],
    ],
    ['a positional', (sessionPath: string) => ['--session', sessionPath, '--expect', 'ignore', 'extra']],
    ['a missing session value', () => ['--session', '--expect', 'ignore']],
    ['a missing expectation value', (sessionPath: string) => ['--session', sessionPath, '--expect']],
  ])('rejects %s with the supported source and built invocations', async (_case, makeArgs) => {
    const directory = await mkdtemp(join(tmpdir(), 'sweep-debt-tripwire-'));
    const sessionPath = join(directory, 'session.jsonl');
    await writeFile(sessionPath, `${JSON.stringify(message('user', 'Still open.'))}\n`);

    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/probes/sweep-debt-tripwire.ts', ...makeArgs(sessionPath)],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'node --import tsx src/probes/sweep-debt-tripwire.ts --session <session.jsonl> --expect capture|ignore',
    );
    expect(result.stderr).toContain(
      'node dist/probes/sweep-debt-tripwire.js --session <session.jsonl> --expect capture|ignore',
    );
  });
});

import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { assessSweepDebt, type SweepDebtExpectation } from '../sweep-debt-tripwire.js';

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

  it('passes ignore only when successful capture evidence is absent', () => {
    expect(assess([message('user', 'Ignore this scenario.'), marker], 'ignore').outcome).toBe('pass');
    expect(
      assess(
        [message('user', 'Ignore this scenario.'), toolResult('mutate_graph', { status: 'success' }), marker],
        'ignore',
      ).outcome,
    ).toBe('fail');
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

  it('fails explicitly when no checkable closed interval exists or conversational material remains unclosed', () => {
    expect(assess([marker, toolResult('read_graph', { status: 'success' }), marker], 'ignore').outcome).toBe(
      'uncheckable',
    );
    expect(
      assess([message('user', 'Closed.'), marker, message('user', 'Still open.')], 'ignore'),
    ).toMatchObject({
      outcome: 'uncheckable',
      reason: 'conversational_material_after_latest_watermark',
    });
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

      // `npx tsx …` is the documented invocation. The equivalent Node loader
      // avoids tsx CLI's IPC socket, which is forbidden in the test sandbox.
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
});

import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  parseExecutionAttempt,
  writeExecutionAttemptImmutable,
  type ExecutionAttempt,
  type ExecutionAttemptOutcome,
} from '../artifact-contract.js';

function attempt(outcome: ExecutionAttemptOutcome): ExecutionAttempt {
  const invalid = outcome === 'invalid';
  return {
    schemaVersion: 1,
    attemptId: `brunch-${outcome}-1`,
    caseId: 'minimal-petri-net-editor-v1',
    lane: 'brunch',
    publicPacketSha256: `sha256:${'a'.repeat(64)}`,
    oraclePackSha256: `sha256:${'b'.repeat(64)}`,
    startedAt: '2026-07-20T12:00:00.000Z',
    endedAt: '2026-07-20T12:10:00.000Z',
    budget: {
      elapsedMinutes: 90,
      mechanicalInterventions: 2,
      substantiveHumanInterventions: 0,
    },
    versions: {
      product: '@hashintel/brunch@1.0.0-alpha.5',
      provider: 'anthropic',
      model: 'claude-opus-4-8',
      harness: 'execution-comparison/v1',
      actorRecipe: 'brunch-empty-dir/v1',
      node: '24.18.0',
      npm: '11.6.2',
      os: 'darwin',
      architecture: 'arm64',
    },
    repository: {
      baseSha: '1'.repeat(40),
      reviewSha: outcome === 'success' ? '2'.repeat(40) : 'not_assessable',
      finalGitRange: outcome === 'success' ? `${'1'.repeat(40)}..${'2'.repeat(40)}` : 'not_assessable',
    },
    terminal: {
      outcome,
      reason: `${outcome} fixture`,
      productStatus: outcome === 'success' ? 'promotion_prepared' : 'not_assessable',
    },
    validity: {
      status: invalid ? 'invalid' : 'valid',
      reasons: invalid ? ['controller material entered lane'] : [],
    },
    commands: [
      {
        id: 'test',
        status: outcome === 'success' ? 'passed' : 'not_run',
        exitCode: outcome === 'success' ? 0 : 'not_assessable',
        stdoutPath: 'commands/test.stdout.txt',
        stderrPath: 'commands/test.stderr.txt',
      },
    ],
    browser: {
      status: outcome === 'success' ? 'passed' : 'not_run',
      reportPath: 'browser/report.json',
    },
    interventions: [],
    commonMetrics: {
      elapsedMs: 600_000,
      inputTokens: 'not_assessable',
      outputTokens: 'not_assessable',
      costUsd: 'not_assessable',
      permissionPrompts: 'not_assessable',
    },
    evidence: {
      finalTreePath: 'repository/final-tree.txt',
      finalDiffPath: 'repository/final.diff',
      visibleProcessPath: 'process/visible.jsonl',
    },
    cleanup: {
      status: 'clean',
      liveProcesses: 0,
      liveSessions: 0,
    },
  };
}

describe('execution comparison attempt artifact contract', () => {
  it.each(['success', 'failure', 'exhausted', 'invalid'] as const)(
    'retains a complete immutable %s attempt',
    async (outcome) => {
      const root = await mkdtemp(join(tmpdir(), 'brunch-execution-attempts-'));
      const selected = attempt(outcome);
      const stored = await writeExecutionAttemptImmutable(root, selected);

      expect(parseExecutionAttempt(JSON.parse(await readFile(stored, 'utf8')))).toEqual(selected);
      await expect(writeExecutionAttemptImmutable(root, selected)).rejects.toThrow('already exists');
    },
  );

  it('fails closed on landing, invalidity drift, and fabricated unavailable metrics', () => {
    expect(() =>
      parseExecutionAttempt({
        ...attempt('success'),
        terminal: { outcome: 'success', reason: 'wrong terminal', productStatus: 'landed' },
      }),
    ).toThrow('invalid execution attempt');
    expect(() =>
      parseExecutionAttempt({
        ...attempt('invalid'),
        validity: { status: 'valid', reasons: [] },
      }),
    ).toThrow('invalid execution attempt');
    expect(() =>
      parseExecutionAttempt({
        ...attempt('success'),
        commonMetrics: { ...attempt('success').commonMetrics, costUsd: null },
      }),
    ).toThrow('invalid execution attempt');
  });
});

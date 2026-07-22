import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { runCommand } from '../../../app/command-runner.js';
import {
  PETRINAUT_FOCUSED_PREPARATION,
  runPetrinautOptimizationOracle,
} from '../petrinaut-optimization-oracle.js';
import {
  createInventedLabelsPetrinautCandidate,
  createKnownGoodPetrinautCandidate,
} from '../petrinaut-optimization-oracle/fixture.js';

const caseDir = fileURLToPath(
  new URL('../../../../testing/execution-comparisons/cases/petrinaut-optimization/', import.meta.url),
);
const roots: string[] = [];

afterAll(async () => {
  await Promise.all(roots.splice(0).map(async (root) => await rm(root, { recursive: true, force: true })));
});

describe('standalone Petrinaut optimization browser oracle', () => {
  it('proves the focused route, request, stream, failure, cancellation, origin, and accessibility leaves', async () => {
    const candidateRoot = await mkdtemp(join(tmpdir(), 'brunch-petrinaut-known-good-'));
    roots.push(candidateRoot);
    await createKnownGoodPetrinautCandidate(candidateRoot);

    const report = await runPetrinautOptimizationOracle({ candidateRoot, caseDir });

    expect(report.status, report.setupFailure ?? JSON.stringify(report, null, 2)).toBe('passed');
    expect(report.preparation.map(({ id }) => id)).toEqual(PETRINAUT_FOCUSED_PREPARATION.map(({ id }) => id));
    expect(report.preparation.every(({ status }) => status === 'passed')).toBe(true);
    expect(report.checks.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: 'route-and-accessibility', status: 'passed' },
      { id: 'scenario-configuration', status: 'passed' },
      { id: 'request-contract', status: 'passed' },
      { id: 'progress-and-completion', status: 'passed' },
      { id: 'service-error', status: 'passed' },
      { id: 'cancel-and-abort', status: 'passed' },
      { id: 'private-origin-secrecy', status: 'passed' },
    ]);
    expect(report.checks.find(({ id }) => id === 'request-contract')?.evidence).toEqual(
      expect.arrayContaining([
        'captured flat fixed/optimized bindings',
        'captured saved and custom objectives with direction',
      ]),
    );
    expect(report.checks.find(({ id }) => id === 'progress-and-completion')?.evidence).toEqual(
      expect.arrayContaining(['progressive trial rendered', 'best-so-far rendered', 'completion rendered']),
    );
    expect(report.checks.find(({ id }) => id === 'cancel-and-abort')?.evidence).toEqual(
      expect.arrayContaining(['host request aborted', 'cancelled state rendered']),
    );
    expect(report.checks.find(({ id }) => id === 'private-origin-secrecy')?.evidence).toEqual(
      expect.arrayContaining([
        'browser traffic remained same-origin',
        'DOM omitted private optimizer origin',
      ]),
    );
    expect(report.consoleErrors).toEqual([]);
  }, 120_000);

  it('uses semantic DOM readiness while background traffic remains non-idle beyond five seconds', async () => {
    const candidateRoot = await mkdtemp(join(tmpdir(), 'brunch-petrinaut-background-readiness-'));
    roots.push(candidateRoot);
    await createKnownGoodPetrinautCandidate(candidateRoot, {
      backgroundRequestDurationMs: 6_000,
    });

    const report = await runPetrinautOptimizationOracle({
      candidateRoot,
      caseDir,
    });

    expect(report.status, report.setupFailure ?? JSON.stringify(report, null, 2)).toBe('passed');
    expect(report.failedRequests).toEqual([]);
    expect(report.checks.every(({ status }) => status === 'passed')).toBe(true);
  }, 120_000);

  it('fails an invented-labels rival that would satisfy the pre-D138 accessibility fiction', async () => {
    const candidateRoot = await mkdtemp(join(tmpdir(), 'brunch-petrinaut-invented-labels-'));
    roots.push(candidateRoot);
    await createInventedLabelsPetrinautCandidate(candidateRoot);

    const report = await runPetrinautOptimizationOracle({ candidateRoot, caseDir });

    expect(report.status).toBe('assertion_failed');
    expect(report.checks.find(({ id }) => id === 'route-and-accessibility')?.status).toBe('failed');
  }, 120_000);

  it.each([
    [
      'omission',
      (steps: typeof PETRINAUT_FOCUSED_PREPARATION) => steps.filter(({ id }) => id !== 'refractive-build'),
    ],
    [
      'reordering',
      (steps: typeof PETRINAUT_FOCUSED_PREPARATION) => {
        const reordered = [...steps];
        const optimizerIndex = reordered.findIndex(({ id }) => id === 'optimizer-client-build');
        const refractiveIndex = reordered.findIndex(({ id }) => id === 'refractive-build');
        [reordered[optimizerIndex], reordered[refractiveIndex]] = [
          reordered[refractiveIndex]!,
          reordered[optimizerIndex]!,
        ];
        return reordered;
      },
    ],
  ] as const)(
    'rejects focused Refractive %s before browser setup',
    async (_name, mutate) => {
      const candidateRoot = await mkdtemp(join(tmpdir(), 'brunch-petrinaut-sensitive-'));
      roots.push(candidateRoot);
      await createKnownGoodPetrinautCandidate(candidateRoot);
      const results = [];
      for (const step of mutate(PETRINAUT_FOCUSED_PREPARATION)) {
        const result = await runCommand(step.command, step.args, {
          cwd: candidateRoot,
          timeoutMs: 30_000,
          maxOutputBytes: 16 * 1024,
        });
        results.push(result);
        if (result.exitCode !== 0) break;
      }
      expect(results.at(-1)).toMatchObject({ exitCode: 1 });
      expect(results.at(-1)?.stderr).toContain('focused preparation ran out of order');
    },
    30_000,
  );
});

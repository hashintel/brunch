import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import {
  PETRINAUT_FOCUSED_PREPARATION,
  runPetrinautOptimizationOracle,
} from '../petrinaut-optimization-oracle.js';
import { createKnownGoodPetrinautCandidate } from '../petrinaut-optimization-oracle/fixture.js';

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
});

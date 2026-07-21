import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { runPetriEditorBrowserOracle } from '../browser-oracle.js';

const caseDir = fileURLToPath(
  new URL('../../../../testing/execution-comparisons/cases/minimal-petri-net-editor/', import.meta.url),
);
const fixtureDir = fileURLToPath(
  new URL(
    '../../../../testing/execution-comparisons/cases/minimal-petri-net-editor/controller/fixtures/known-good/',
    import.meta.url,
  ),
);

afterAll(async () => {
  await rm(`${fixtureDir}/dist`, { recursive: true, force: true });
});

describe('controller-owned Petri editor browser oracle', () => {
  it('runs every claim-linked journey in a fresh context against a known-good app', async () => {
    const report = await runPetriEditorBrowserOracle({ appDir: fixtureDir, caseDir });

    expect(report.status).toBe('passed');
    expect(report.commands).toEqual([
      expect.objectContaining({ id: 'test', status: 'passed', exitCode: 0 }),
      expect.objectContaining({ id: 'build', status: 'passed', exitCode: 0 }),
    ]);
    expect(report.checks).toEqual([
      expect.objectContaining({ id: 'mount', claims: ['AC14'], status: 'passed' }),
      expect.objectContaining({ id: 'node-lifecycle', claims: ['AC15'], status: 'passed' }),
      expect.objectContaining({
        id: 'weighted-fire-reset-reload',
        claims: ['AC17', 'AC18', 'AC19', 'AC20', 'AC21', 'AC23'],
        status: 'passed',
      }),
      expect.objectContaining({
        id: 'invalid-and-cascade',
        claims: ['AC16', 'AC17', 'AC24', 'AC25'],
        status: 'passed',
      }),
      expect.objectContaining({ id: 'round-trip-and-clear', claims: ['AC22', 'AC26'], status: 'passed' }),
    ]);
    for (const check of report.checks) {
      expect(check.startupConsoleErrors).toEqual([]);
      expect(check.failedModuleLoads).toEqual([]);
      expect(check.externalRuntimeRequests).toEqual([]);
    }
    expect(report.startupConsoleErrors).toEqual([]);
    expect(report.failedModuleLoads).toEqual([]);
    expect(report.externalRuntimeRequests).toEqual([]);
  });
});

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
  it('runs the unchanged build, browser, persistence, and Petri journey against a known-good app', async () => {
    const report = await runPetriEditorBrowserOracle({ appDir: fixtureDir, caseDir });

    expect(report.status).toBe('passed');
    expect(report.commands).toEqual([
      expect.objectContaining({ id: 'test', status: 'passed', exitCode: 0 }),
      expect.objectContaining({ id: 'build', status: 'passed', exitCode: 0 }),
    ]);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'mount', status: 'passed' }),
        expect.objectContaining({ id: 'node-lifecycle', status: 'passed' }),
        expect.objectContaining({ id: 'weighted-fire-reset-reload', status: 'passed' }),
        expect.objectContaining({ id: 'invalid-and-cascade', status: 'passed' }),
        expect.objectContaining({ id: 'round-trip-and-clear', status: 'passed' }),
      ]),
    );
    expect(report.startupConsoleErrors).toEqual([]);
    expect(report.failedModuleLoads).toEqual([]);
    expect(report.externalRuntimeRequests).toEqual([]);
  });
});

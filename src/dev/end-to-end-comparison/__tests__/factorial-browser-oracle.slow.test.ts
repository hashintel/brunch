import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { runPetriEditorBrowserOracle } from '../../execution-comparison/browser-oracle.js';
import { MATRIX_CELL_IDS } from '../matrix-contract.js';

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

describe('synthetic end-to-end factorial oracle composition', () => {
  it('projects one unchanged known-good oracle result across all four synthetic cells', async () => {
    const report = await runPetriEditorBrowserOracle({ appDir: fixtureDir, caseDir });
    const reports = MATRIX_CELL_IDS.map((cellId) => ({ cellId, report }));

    expect(reports.map(({ cellId }) => cellId)).toEqual(MATRIX_CELL_IDS);
    for (const { report } of reports) {
      expect(report.status).toBe('passed');
      expect(report.checks).toHaveLength(5);
      expect(report.checks.every((check) => check.status === 'passed')).toBe(true);
    }
  }, 240_000);
});

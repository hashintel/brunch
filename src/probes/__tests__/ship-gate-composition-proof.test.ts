import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ShipGateCompositionReport } from '../ship-gate-composition-proof.js';
import { runShipGateCompositionProof } from '../ship-gate-composition-proof.js';

describe('ship gate composition proof contract', () => {
  it('rejects unsafe artifact run ids before constructing paths', async () => {
    await expect(runShipGateCompositionProof({ runId: '../escape' })).rejects.toThrow(
      'Artifact runId must be a portable single path segment',
    );
  });

  it.skipIf(process.env.BRUNCH_RUN_SHIP_GATE !== '1')(
    'writes a portable composition report through the middle-loop proof',
    async () => {
      const fixtureRoot = await mkdtemp(join(tmpdir(), 'brunch-ship-gate-fixtures-'));
      const workspaceCwd = await mkdtemp(join(tmpdir(), 'brunch-ship-gate-workspace-'));

      const report = await runShipGateCompositionProof({
        fixtureRoot,
        workspaceCwd,
        runId: 'artifact-contract',
        cliPath: 'dist/app/brunch.js',
        seedCliPath: 'dist/graph/seed-fixtures.js',
      });

      expect(report).toMatchObject({
        schemaVersion: 1,
        probeId: 'ship-gate-composition',
        runId: 'artifact-contract',
        cwd: '<ephemeral-workspace>',
        setup: {
          publicSeedCli: 'node dist/graph/seed-fixtures.js',
          seeds: ['workspace-spread/alpha-grounding', 'workspace-spread/beta-commitments'],
        },
        betaTitlesAbsentFromAlpha: true,
        runtimeStateObservable: true,
        artifacts: {
          runDir: 'runs/ship-gate-composition/artifact-contract',
          reportJson: 'runs/ship-gate-composition/artifact-contract/report.json',
        },
      });
      expect(report.alpha.nodeTitles.length).toBeGreaterThan(0);
      expect(report.beta.nodeTitles.length).toBeGreaterThan(0);
      expect(report.alpha.specId).not.toBe(report.beta.specId);
      expect(report.selectedSpecId).toBe(report.beta.specId);

      const persisted = JSON.parse(
        await readFile(join(fixtureRoot, 'runs/ship-gate-composition/artifact-contract/report.json'), 'utf8'),
      ) as ShipGateCompositionReport;
      expect(persisted.cwd).toBe('<ephemeral-workspace>');
      expect(JSON.stringify(persisted)).not.toContain(fixtureRoot);
      expect(persisted.steps.map((step) => step.request.method)).toEqual([
        'workspace.selectionState',
        'workspace.activate',
        'graph.overview',
        'session.runtimeState',
        'workspace.activate',
        'workspace.selectionState',
        'graph.overview',
      ]);
    },
  );
});

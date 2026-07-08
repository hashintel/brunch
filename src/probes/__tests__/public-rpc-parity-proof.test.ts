import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { runPublicRpcParityProof } from '../public-rpc-parity-proof.js';

describe('public Brunch RPC structured-exchange parity proof', () => {
  it('rejects unsafe artifact run ids before constructing paths', async () => {
    await expect(runPublicRpcParityProof({ runId: '../escape' })).rejects.toThrow(
      'Artifact runId must be a portable single path segment',
    );
  });
  it('drives each deterministic structured-exchange permutation from a fresh cwd', async () => {
    const report = await runPublicRpcParityProof();

    expect(report).toMatchObject({
      schemaVersion: 1,
      probeId: 'public-rpc-parity',
      runId: expect.any(String),
      generatedAt: expect.any(String),
      mission: expect.stringContaining('public JSON-RPC only'),
      evaluationFocus: expect.stringContaining('Tuple transcript/projection parity'),
      maxTurnBudget: 3,
      completedTurns: 3,
      friction: [],
      specId: expect.any(Number),
      sessionId: expect.any(String),
    });
    expect(Date.parse(report.generatedAt)).not.toBeNaN();
    expect(report.toolCoverage).toEqual(['ask', 'present_question']);
    expect(report.exchangeIds).toEqual([
      'deterministic-grounding-choice-1',
      'deterministic-grounding-text-2',
      'deterministic-grounding-multi-3',
    ]);
    expect(new Set(report.exchangeIds).size).toBe(3);
    expect(report.artifacts).toBeUndefined();
  });

  it('writes a reviewable artifact bundle when given a fixture root', async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'brunch-fixtures-'));

    const report = await runPublicRpcParityProof({
      fixtureRoot,
      runId: 'artifact-test',
    });

    const artifacts = report.artifacts;
    expect(artifacts).toEqual({
      runDir: `runs/public-rpc-parity/${report.runId}`,
      sessionJsonl: `runs/public-rpc-parity/${report.runId}/session.jsonl`,
      reportJson: `runs/public-rpc-parity/${report.runId}/report.json`,
    });
    if (artifacts === undefined) throw new Error('Expected artifact paths');

    expect(artifacts.runDir.endsWith(join('runs', report.probeId, report.runId))).toBe(true);
    expect(basename(artifacts.runDir)).toBe(report.runId);
    expect(basename(dirname(artifacts.runDir))).toBe(report.probeId);

    const sessionJsonl = await readFile(join(fixtureRoot, artifacts.sessionJsonl), 'utf8');
    const persistedReport = JSON.parse(
      await readFile(join(fixtureRoot, artifacts.reportJson), 'utf8'),
    ) as typeof report;
    // Persisted refs stay fixture-root-relative and the temp cwd is scrubbed.
    expect(JSON.stringify(persistedReport.artifacts)).not.toContain(fixtureRoot);
    expect(persistedReport.cwd).toBe('<ephemeral-workspace>');

    expect(sessionJsonl).toContain('"toolName":"ask"');
    expect(persistedReport).toMatchObject({
      schemaVersion: 1,
      probeId: 'public-rpc-parity',
      runId: report.runId,
      generatedAt: report.generatedAt,
      mission: report.mission,
      completedTurns: 3,
      exchangeIds: report.exchangeIds,
      artifacts: report.artifacts,
    });
    expect(persistedReport.exchangeIds).toEqual(report.exchangeIds);
    expect(persistedReport.exchangeIds).toHaveLength(3);
    expect(new Set(persistedReport.exchangeIds).size).toBe(3);
    for (const exchangeId of persistedReport.exchangeIds) {
      expect(sessionJsonl).toContain(exchangeId);
    }
  });
});

import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { runCaptureResponseToGraphProof } from './capture-response-to-graph-proof.js';

describe('capture response to graph proof', () => {
  it('proves public RPC activation, trigger, submit, and overview path without graph/capture imports', async () => {
    const report = await runCaptureResponseToGraphProof({ runId: 'unit-proof' });

    expect(report).toMatchObject({
      schemaVersion: 1,
      probeId: 'capture-response-to-graph',
      runId: 'unit-proof',
      specId: expect.any(Number),
      sessionId: expect.any(String),
      exchangeId: 'deterministic-grounding-text-2',
      capture: { status: 'captured', nodeCount: 4, lsn: expect.any(Number) },
      graph: {
        nodeCount: 4,
        codes: ['G1', 'CTX1', 'CON1', 'CR1'],
        lsn: expect.any(Number),
      },
      updates: expect.arrayContaining([
        { topic: 'graph.overview', specId: expect.any(Number), lsn: expect.any(Number) },
        { topic: 'graph.nodeNeighborhood', specId: expect.any(Number), lsn: expect.any(Number) },
      ]),
      friction: [],
    });
    expect(report.graph.lsn).toBeGreaterThanOrEqual(report.capture.lsn);
  });

  it('writes transcript, capture outcome, graph evidence, lsn, and friction artifacts', async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'brunch-capture-fixtures-'));

    const report = await runCaptureResponseToGraphProof({ fixtureRoot, runId: 'artifact-test' });

    expect(report.artifacts).toEqual({
      runDir: 'runs/capture-response-to-graph/artifact-test',
      sessionJsonl: 'runs/capture-response-to-graph/artifact-test/session.jsonl',
      transcriptMarkdown: 'runs/capture-response-to-graph/artifact-test/transcript.md',
      reportJson: 'runs/capture-response-to-graph/artifact-test/report.json',
    });
    if (!report.artifacts) throw new Error('expected artifacts');

    const sessionJsonl = await readFile(join(fixtureRoot, report.artifacts.sessionJsonl), 'utf8');
    const transcript = await readFile(join(fixtureRoot, report.artifacts.transcriptMarkdown), 'utf8');
    const persistedReport = JSON.parse(
      await readFile(join(fixtureRoot, report.artifacts.reportJson), 'utf8'),
    ) as typeof report;

    expect(sessionJsonl).toContain('Goal: Help product teams turn elicitation answers into graph truth.');
    expect(transcript).toContain('Tool result: request_answer');
    expect(persistedReport.capture).toEqual(report.capture);
    expect(persistedReport.graph.codes).toEqual(['G1', 'CTX1', 'CON1', 'CR1']);
    expect(persistedReport.friction).toEqual([]);
    // Persisted refs stay fixture-root-relative and the temp cwd is scrubbed.
    expect(JSON.stringify(persistedReport.artifacts)).not.toContain(fixtureRoot);
    expect(persistedReport.cwd).toBe('<ephemeral-workspace>');
  });
});

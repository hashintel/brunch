import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { runSubmitMessageCaptureProof } from './submit-message-capture-proof.js';

describe('submit message capture proof', () => {
  it('proves public RPC submitMessage captures ordinary labeled text into graph truth', async () => {
    const report = await runSubmitMessageCaptureProof({ runId: 'unit-proof' });

    expect(report).toMatchObject({
      schemaVersion: 1,
      probeId: 'submit-message-capture',
      runId: 'unit-proof',
      specId: expect.any(Number),
      sessionId: expect.any(String),
      messageId: expect.any(String),
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
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'brunch-submit-message-fixtures-'));

    const report = await runSubmitMessageCaptureProof({ fixtureRoot, runId: 'artifact-test' });

    expect(report.artifacts).toEqual({
      runDir: 'runs/submit-message-capture/artifact-test',
      sessionJsonl: 'runs/submit-message-capture/artifact-test/session.jsonl',
      transcriptMarkdown: 'runs/submit-message-capture/artifact-test/transcript.md',
      reportJson: 'runs/submit-message-capture/artifact-test/report.json',
    });
    if (!report.artifacts) throw new Error('expected artifacts');

    const sessionJsonl = await readFile(join(fixtureRoot, report.artifacts.sessionJsonl), 'utf8');
    const transcript = await readFile(join(fixtureRoot, report.artifacts.transcriptMarkdown), 'utf8');
    const persistedReport = JSON.parse(
      await readFile(join(fixtureRoot, report.artifacts.reportJson), 'utf8'),
    ) as typeof report;

    expect(sessionJsonl).toContain('Goal: Keep ordinary user messages on the same capture path.');
    expect(transcript).toContain('User');
    expect(persistedReport.capture).toEqual(report.capture);
    expect(persistedReport.graph.codes).toEqual(['G1', 'CTX1', 'CON1', 'CR1']);
    expect(persistedReport.friction).toEqual([]);
    expect(JSON.stringify(persistedReport.artifacts)).not.toContain(fixtureRoot);
    expect(persistedReport.cwd).toBe('<ephemeral-workspace>');
  });
});

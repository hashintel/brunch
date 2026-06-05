import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { GraphOverview } from '../graph/snapshot.js';
import {
  summarizeProposeGraphCommitProof,
  writeProposeGraphCommitProofArtifacts,
  type ProposeGraphCommitProofReport,
} from './propose-graph-commit-proof.js';

function messageEntry(toolName: string, details: unknown, content: string): string {
  return JSON.stringify({
    type: 'message',
    message: {
      role: 'toolResult',
      toolName,
      content,
      details,
    },
  });
}

const successfulOverview: GraphOverview = {
  nodes: [
    {
      id: 1,
      specId: 1,
      plane: 'intent',
      kind: 'goal',
      title: 'Clarify launch readiness',
      basis: 'explicit',
      createdAtLsn: 1,
      updatedAtLsn: 1,
    },
    {
      id: 2,
      specId: 1,
      plane: 'intent',
      kind: 'requirement',
      title: 'Expose rollback criteria',
      basis: 'explicit',
      createdAtLsn: 1,
      updatedAtLsn: 1,
    },
  ],
  edges: [
    {
      id: 1,
      specId: 1,
      category: 'dependency',
      sourceId: 2,
      targetId: 1,
      basis: 'explicit',
      createdAtLsn: 1,
      updatedAtLsn: 1,
    },
  ],
  nodeCount: 2,
  edgeCount: 1,
  lsn: 1,
};

describe('propose-graph commit proof report', () => {
  it('classifies bounded retry evidence from commit_graph tool results', () => {
    const sessionText = [
      messageEntry(
        'commit_graph',
        {
          status: 'structural_illegal',
          diagnostics: [{ field: 'edges[0].stance', message: 'stance is required for support edges' }],
        },
        'STRUCTURAL_ILLEGAL',
      ),
      messageEntry(
        'commit_graph',
        {
          status: 'success',
          lsn: 1,
          nodes: { goal: 1, rollback: 2 },
          edges: [1],
        },
        'Graph committed successfully',
      ),
    ].join('\n');

    const report = summarizeProposeGraphCommitProof({
      runId: 'run-1',
      generatedAt: '2026-06-02T00:00:00.000Z',
      cwd: '/tmp/brunch-proof',
      specId: 7,
      sessionId: 'session-1',
      maxAttempts: 2,
      sessionText,
      overview: successfulOverview,
      prompt: 'Commit the accepted concept.',
      model: 'test-model',
    });

    expect(report.success).toBe(true);
    expect(report.attempts).toHaveLength(2);
    expect(report.firstAttemptStatus).toBe('structural_illegal');
    expect(report.finalStatus).toBe('success');
    expect(report.retryCount).toBe(1);
    expect(report.finalGraph).toMatchObject({ nodeCount: 2, edgeCount: 1, lsn: 1 });
    expect(report.committedNodeTitles).toEqual(['Clarify launch readiness', 'Expose rollback criteria']);
    expect(report.attempts[0]?.diagnostics).toEqual([
      { field: 'edges[0].stance', message: 'stance is required for support edges' },
    ]);
  });

  it('fails closed when no commit_graph attempt succeeds', () => {
    const sessionText = messageEntry(
      'commit_graph',
      {
        status: 'structural_illegal',
        diagnostics: [{ field: 'nodes[0].kind', message: 'invalid kind' }],
      },
      'STRUCTURAL_ILLEGAL',
    );

    const report = summarizeProposeGraphCommitProof({
      runId: 'run-2',
      generatedAt: '2026-06-02T00:00:00.000Z',
      cwd: '/tmp/brunch-proof',
      specId: 7,
      sessionId: 'session-1',
      maxAttempts: 1,
      sessionText,
      overview: { ...successfulOverview, nodes: [], edges: [], nodeCount: 0, edgeCount: 0, lsn: 0 },
      prompt: 'Commit the accepted concept.',
    });

    expect(report.success).toBe(false);
    expect(report.firstAttemptStatus).toBe('structural_illegal');
    expect(report.finalStatus).toBe('structural_illegal');
    expect(report.finalGraph).toMatchObject({ nodeCount: 0, edgeCount: 0, lsn: 0 });
  });

  it('writes replayable probe artifacts', async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'brunch-propose-graph-artifacts-'));
    const report: ProposeGraphCommitProofReport = {
      schemaVersion: 1,
      probeId: 'propose-graph-commit',
      runId: 'artifact-run',
      generatedAt: '2026-06-02T00:00:00.000Z',
      mission: 'Prove the propose-graph strategy can commit graph truth through commit_graph.',
      evaluationFocus: 'A14-L structural legality for direct commitGraph batches.',
      success: true,
      cwd: '/tmp/brunch-proof',
      specId: 7,
      sessionId: 'session-1',
      prompt: 'Commit the accepted concept.',
      maxAttempts: 2,
      attemptCount: 1,
      retryCount: 0,
      firstAttemptStatus: 'success',
      finalStatus: 'success',
      attempts: [{ index: 1, status: 'success', lsn: 1, nodeRefs: { goal: 1 }, edgeIds: [] }],
      finalGraph: { nodeCount: 1, edgeCount: 0, lsn: 1 },
      committedNodeTitles: ['Clarify launch readiness'],
      friction: [],
    };

    const artifacts = await writeProposeGraphCommitProofArtifacts({
      fixtureRoot,
      runId: report.runId,
      sessionText: messageEntry(
        'commit_graph',
        { status: 'success', lsn: 1, nodes: { goal: 1 }, edges: [] },
        'Graph committed successfully',
      ),
      report,
    });

    expect(await readFile(artifacts.reportJson, 'utf8')).toContain('propose-graph-commit');
    expect(await readFile(artifacts.sessionJsonl, 'utf8')).toContain('commit_graph');
    expect(await readFile(artifacts.transcriptMarkdown, 'utf8')).toContain('Graph committed successfully');
  });
});

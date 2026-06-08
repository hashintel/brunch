import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { GraphSlice } from '../graph/queries.js';
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

const successfulOverview: GraphSlice = {
  nodes: [
    {
      id: 1,
      specId: 1,
      plane: 'intent',
      kind: 'goal',
      kindOrdinal: 1,
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
      kindOrdinal: 1,
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
          createdNodes: { goal: { id: 1, code: 'G1' }, rollback: { id: 2, code: 'R1' } },
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

  it('classifies existing-code scenario evidence from transcript and final graph', () => {
    const sessionText = [
      messageEntry(
        'read_graph',
        { nodeCount: 1 },
        '- [G1] intent/goal: "Selected-spec launch readiness goal"',
      ),
      JSON.stringify({
        type: 'message',
        message: {
          role: 'assistant',
          content: 'Calling commit_graph with {"source":{"existingCode":"G1"},"target":"r1"}',
        },
      }),
      messageEntry(
        'commit_graph',
        {
          status: 'success',
          lsn: 2,
          createdNodes: { r1: { id: 2, code: 'R1' } },
          edges: [1],
        },
        'Graph committed successfully',
      ),
    ].join('\n');

    const report = summarizeProposeGraphCommitProof({
      runId: 'existing-code-run',
      generatedAt: '2026-06-04T00:00:00.000Z',
      cwd: '/tmp/brunch-proof',
      specId: 7,
      sessionId: 'session-1',
      maxAttempts: 2,
      sessionText,
      overview: successfulOverview,
      prompt: 'Use G1 as an existingCode.',
      scenarioId: 'existing-code-ref',
      expectedExistingCode: 'G1',
    });

    expect(report.success).toBe(true);
    expect(report.scenarioId).toBe('existing-code-ref');
    expect(report.projectedCodeEvidence).toEqual({
      codes: ['G1'],
      seenInTranscript: true,
      usedInCommitParams: true,
      existingCodeEdgePresent: true,
    });
    expect(report.committedNodes).toEqual([
      { code: 'G1', title: 'Clarify launch readiness' },
      { code: 'R1', title: 'Expose rollback criteria' },
    ]);
  });

  it('classifies retry-diagnostics scenario first/final statuses and diagnostics', () => {
    const sessionText = [
      messageEntry(
        'commit_graph',
        {
          status: 'structural_illegal',
          diagnostics: [{ field: 'edges[0].stance', message: 'stance is required for proof edges' }],
        },
        'STRUCTURAL_ILLEGAL',
      ),
      messageEntry(
        'commit_graph',
        {
          status: 'success',
          lsn: 2,
          createdNodes: { p1: { id: 1, code: 'CR1' }, p2: { id: 2, code: 'G1' } },
          edges: [1],
        },
        'Graph committed successfully',
      ),
    ].join('\n');

    const report = summarizeProposeGraphCommitProof({
      runId: 'retry-run',
      generatedAt: '2026-06-04T00:00:00.000Z',
      cwd: '/tmp/brunch-proof',
      specId: 7,
      sessionId: 'session-1',
      maxAttempts: 2,
      sessionText,
      overview: successfulOverview,
      prompt: 'Retry after diagnostics.',
      scenarioId: 'retry-diagnostics',
    });

    expect(report.success).toBe(true);
    expect(report.firstAttemptStatus).toBe('structural_illegal');
    expect(report.finalStatus).toBe('success');
    expect(report.retryCount).toBe(1);
    expect(report.attempts[0]?.diagnostics).toEqual([
      { field: 'edges[0].stance', message: 'stance is required for proof edges' },
    ]);
    expect(report.finalGraph).toMatchObject({ nodeCount: 2, edgeCount: 1, lsn: 1 });
    expect(report.friction).toEqual([]);
  });

  it('classifies ambiguity no-overcommit as clarification without graph writes', () => {
    const sessionText = JSON.stringify({
      type: 'message',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'I need more concrete accepted facts before I can commit graph truth.' },
        ],
      },
    });

    const report = summarizeProposeGraphCommitProof({
      runId: 'ambiguity-run',
      generatedAt: '2026-06-04T00:00:00.000Z',
      cwd: '/tmp/brunch-proof',
      specId: 7,
      sessionId: 'session-1',
      maxAttempts: 2,
      sessionText,
      overview: { ...successfulOverview, nodes: [], edges: [], lsn: 1 },
      prompt: 'Maybe update the graph if useful.',
      scenarioId: 'ambiguity-no-overcommit',
    });

    expect(report.success).toBe(true);
    expect(report.ambiguityOutcome).toBe('no_op_or_clarification');
    expect(report.attemptCount).toBe(0);
    expect(report.finalGraph).toMatchObject({ nodeCount: 0, edgeCount: 0, lsn: 1 });
    expect(report.friction).toEqual([]);
  });

  it('classifies ambiguity overcommit when unsupported graph writes succeed', () => {
    const report = summarizeProposeGraphCommitProof({
      runId: 'ambiguity-overcommit-run',
      generatedAt: '2026-06-04T00:00:00.000Z',
      cwd: '/tmp/brunch-proof',
      specId: 7,
      sessionId: 'session-1',
      maxAttempts: 2,
      sessionText: messageEntry(
        'commit_graph',
        { status: 'success', lsn: 1, createdNodes: { g1: { id: 1, code: 'G1' } }, edges: [] },
        'Graph committed successfully',
      ),
      overview: successfulOverview,
      prompt: 'Maybe update the graph if useful.',
      scenarioId: 'ambiguity-no-overcommit',
    });

    expect(report.success).toBe(false);
    expect(report.ambiguityOutcome).toBe('overcommit');
    expect(report.friction).toContain('Ambiguity scenario outcome was overcommit.');
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
      overview: { ...successfulOverview, nodes: [], edges: [], lsn: 0 },
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
      scenarioId: 'direct-commit',
      attempts: [{ index: 1, status: 'success', lsn: 1, nodeRefs: { goal: 1 }, edgeIds: [] }],
      finalGraph: { nodeCount: 1, edgeCount: 0, lsn: 1 },
      committedNodeTitles: ['Clarify launch readiness'],
      committedNodes: [{ code: 'G1', title: 'Clarify launch readiness' }],
      projectedCodeEvidence: {
        codes: ['G1'],
        seenInTranscript: true,
        usedInCommitParams: true,
      },
      friction: [],
    };

    const artifacts = await writeProposeGraphCommitProofArtifacts({
      fixtureRoot,
      runId: report.runId,
      sessionText: messageEntry(
        'commit_graph',
        { status: 'success', lsn: 1, createdNodes: { goal: { id: 1, code: 'G1' } }, edges: [] },
        'Graph committed successfully',
      ),
      report,
    });

    expect(artifacts).toEqual({
      runDir: 'runs/propose-graph-commit/artifact-run',
      sessionJsonl: 'runs/propose-graph-commit/artifact-run/session.jsonl',
      transcriptMarkdown: 'runs/propose-graph-commit/artifact-run/transcript.md',
      reportJson: 'runs/propose-graph-commit/artifact-run/report.json',
    });
    expect(await readFile(join(fixtureRoot, artifacts.reportJson), 'utf8')).toContain('propose-graph-commit');
    expect(await readFile(join(fixtureRoot, artifacts.sessionJsonl), 'utf8')).toContain('commit_graph');
    expect(await readFile(join(fixtureRoot, artifacts.transcriptMarkdown), 'utf8')).toContain(
      'Graph committed successfully',
    );
  });
});

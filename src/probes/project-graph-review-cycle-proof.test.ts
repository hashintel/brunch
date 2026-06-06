import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { GraphOverview } from '../graph/snapshot.js';
import type { JsonRpcResponse } from '../rpc/protocol.js';
import {
  summarizeProjectGraphReviewCycleProof,
  writeProjectGraphReviewCycleArtifacts,
  type ProjectGraphReviewCycleReport,
} from './project-graph-review-cycle-proof.js';

const baseOverview: GraphOverview = {
  nodes: [
    {
      id: 1,
      specId: 7,
      plane: 'intent',
      kind: 'goal',
      kindOrdinal: 1,
      title: 'Macro view explains derivation history',
      basis: 'explicit',
      createdAtLsn: 2,
      updatedAtLsn: 2,
    },
  ],
  edges: [],
  nodeCount: 1,
  edgeCount: 0,
  lsn: 2,
};

const approvedOverview: GraphOverview = {
  nodes: [
    ...baseOverview.nodes,
    {
      id: 2,
      specId: 7,
      plane: 'intent',
      kind: 'requirement',
      kindOrdinal: 1,
      title: 'Macro view names impasse resolution state',
      basis: 'explicit',
      createdAtLsn: 3,
      updatedAtLsn: 3,
    },
  ],
  edges: [
    {
      id: 1,
      specId: 7,
      sourceId: 2,
      targetId: 1,
      category: 'support',
      stance: 'for',
      basis: 'explicit',
      createdAtLsn: 3,
      updatedAtLsn: 3,
    },
  ],
  nodeCount: 2,
  edgeCount: 1,
  lsn: 3,
};

const runtimeState = {
  operationalMode: 'elicit',
  agentStrategy: 'project-graph',
  agentLens: 'intent',
  agentGoal: 'commit-converge',
} as const;

function toolResultEntry(toolName: string, details: unknown): string {
  return JSON.stringify({
    type: 'message',
    message: {
      role: 'toolResult',
      toolName,
      content: [{ type: 'text', text: JSON.stringify(details) }],
      details,
    },
  });
}

function presentReviewSetEntry(): string {
  return toolResultEntry('present_review_set', {
    schema: 'brunch.structured_exchange.present',
    v: 1,
    exchange_id: 'review-1',
    tool_meta: { curr: 'present_review_set', next: 'request_review' },
    display: { heading: 'Derived macro-view requirement' },
    review_set: {
      nodes: [
        {
          draft_id: 'req-resolution-state',
          plane: 'intent',
          kind: 'requirement',
          title: 'Macro view names impasse resolution state',
        },
      ],
      edges: [
        {
          category: 'support',
          source: { draft_id: 'req-resolution-state' },
          target: { existing_code: 'G1' },
          stance: 'for',
        },
      ],
    },
  });
}

function requestReviewEntry(): string {
  return toolResultEntry('request_review', {
    schema: 'brunch.structured_exchange.request',
    v: 1,
    exchange_id: 'review-1',
    tool_meta: { prev: 'present_review_set', curr: 'request_review' },
    answered: { decision: 'approve', comment: 'Probe approval.' },
  });
}

function pendingReviewResponse(): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id: 1,
    result: {
      status: 'pending',
      exchange: {
        exchangeId: 'review-1',
        mode: 'review',
        reviewSet: {
          nodes: [{ draft_id: 'req-resolution-state' }],
          edges: [{ category: 'support' }],
        },
      },
    },
  };
}

function approvedResponse(): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id: 2,
    result: {
      status: 'accepted',
      exchangeId: 'review-1',
      answer: { review: { decision: 'approve', comment: 'Probe approval.' } },
      capture: { status: 'no_capture', reason: 'review responses do not run synchronous capture' },
      review: { status: 'approved', lsn: 3, createdNodes: { 'req-resolution-state': { id: 2 } } },
    },
  };
}

describe('project-graph review-cycle proof report', () => {
  it('requires present_review_set transcript evidence, public RPC approval, and explicit graph readback', () => {
    const report = summarizeProjectGraphReviewCycleProof({
      runId: 'project-graph-review-test',
      generatedAt: '2026-06-06T00:00:00.000Z',
      cwd: '/tmp/brunch-project-graph-review-test',
      seedSlug: 'macro-view-grounded-intent',
      specId: 7,
      sessionId: 'session-1',
      prompt: 'Present a review set.',
      runtimeState,
      model: 'test-model',
      sessionText: [presentReviewSetEntry(), requestReviewEntry()].join('\n'),
      baseOverview,
      finalOverview: approvedOverview,
      pendingResponse: pendingReviewResponse(),
      approvalResponse: approvedResponse(),
      productUpdates: [{ topic: 'graph.overview', specId: 7, lsn: 3 }],
    });

    expect(report.success).toBe(true);
    expect(report.toolEvidence).toMatchObject({
      presentReviewSetCount: 1,
      requestReviewCount: 1,
      successfulPresentReviewSetCount: 1,
    });
    expect(report.pendingReview).toMatchObject({
      observed: true,
      exchangeId: 'review-1',
      nodeDraftCount: 1,
      edgeDraftCount: 1,
    });
    expect(report.approval).toMatchObject({ attempted: true, status: 'approved', lsn: 3 });
    expect(report.graphDelta).toEqual({ lsnAdvanced: true, nodeDelta: 1, edgeDelta: 1 });
    expect(report.createdNodes).toEqual([
      {
        id: 2,
        code: 'R1',
        plane: 'intent',
        kind: 'requirement',
        title: 'Macro view names impasse resolution state',
        basis: 'explicit',
      },
    ]);
    expect(report.friction).toEqual([]);
  });

  it('fails closed when the agent never leaves a pending review exchange to approve', () => {
    const report = summarizeProjectGraphReviewCycleProof({
      runId: 'project-graph-review-test',
      generatedAt: '2026-06-06T00:00:00.000Z',
      cwd: '/tmp/brunch-project-graph-review-test',
      seedSlug: 'macro-view-grounded-intent',
      specId: 7,
      sessionId: 'session-1',
      prompt: 'Present a review set.',
      runtimeState,
      sessionText: toolResultEntry('present_review_set', {
        status: 'structural_illegal',
        diagnostics: [{ field: 'edgeDrafts', message: 'invalid edge category' }],
      }),
      baseOverview,
      finalOverview: baseOverview,
      pendingResponse: { jsonrpc: '2.0', id: 1, result: { status: 'idle', exchange: null } },
    });

    expect(report.success).toBe(false);
    expect(report.approval).toEqual({ attempted: false });
    expect(report.friction).toContain(
      'Public RPC did not observe a pending review exchange after the agent turn.',
    );
    expect(report.friction).toContain('Review approval was not attempted through public RPC.');
    expect(report.friction).toContain(
      'Graph LSN did not advance for the selected spec after review approval.',
    );
  });

  it('writes session, transcript, report, and graph snapshot artifacts', async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'brunch-project-graph-review-artifacts-'));
    const report: ProjectGraphReviewCycleReport = summarizeProjectGraphReviewCycleProof({
      runId: 'artifact-run',
      generatedAt: '2026-06-06T00:00:00.000Z',
      cwd: fixtureRoot,
      seedSlug: 'macro-view-grounded-intent',
      specId: 7,
      sessionId: 'session-1',
      prompt: 'Present a review set.',
      runtimeState,
      sessionText: [presentReviewSetEntry(), requestReviewEntry()].join('\n'),
      baseOverview,
      finalOverview: approvedOverview,
      pendingResponse: pendingReviewResponse(),
      approvalResponse: approvedResponse(),
    });

    const artifacts = await writeProjectGraphReviewCycleArtifacts({
      fixtureRoot,
      runId: report.runId,
      sessionText: [presentReviewSetEntry(), requestReviewEntry()].join('\n'),
      report,
      graphSnapshot: approvedOverview,
    });

    expect(artifacts.runDir).toBe('runs/project-graph-review-cycle/artifact-run');
    await expect(readFile(join(fixtureRoot, artifacts.sessionJsonl), 'utf8')).resolves.toContain(
      'present_review_set',
    );
    await expect(readFile(join(fixtureRoot, artifacts.transcriptMarkdown), 'utf8')).resolves.toContain(
      '## Raw session JSONL',
    );
    await expect(readFile(join(fixtureRoot, artifacts.reportJson), 'utf8')).resolves.toContain(
      'project-graph-review-cycle',
    );
    await expect(readFile(join(fixtureRoot, artifacts.graphSnapshotJson), 'utf8')).resolves.toContain(
      'Macro view names impasse resolution state',
    );
  });

  it('persists portable, fixture-relative artifact references in report JSON', async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'brunch-project-graph-review-portable-'));
    const report: ProjectGraphReviewCycleReport = summarizeProjectGraphReviewCycleProof({
      runId: 'portable-run',
      generatedAt: '2026-06-06T00:00:00.000Z',
      cwd: fixtureRoot,
      seedSlug: 'macro-view-grounded-intent',
      specId: 7,
      sessionId: 'session-1',
      prompt: 'Present a review set.',
      runtimeState,
      sessionText: [presentReviewSetEntry(), requestReviewEntry()].join('\n'),
      baseOverview,
      finalOverview: approvedOverview,
      pendingResponse: pendingReviewResponse(),
      approvalResponse: approvedResponse(),
    });

    const artifacts = await writeProjectGraphReviewCycleArtifacts({
      fixtureRoot,
      runId: report.runId,
      sessionText: [presentReviewSetEntry(), requestReviewEntry()].join('\n'),
      report,
      graphSnapshot: approvedOverview,
    });

    const expectedRefs = {
      runDir: 'runs/project-graph-review-cycle/portable-run',
      sessionJsonl: 'runs/project-graph-review-cycle/portable-run/session.jsonl',
      transcriptMarkdown: 'runs/project-graph-review-cycle/portable-run/transcript.md',
      reportJson: 'runs/project-graph-review-cycle/portable-run/report.json',
      graphSnapshotJson: 'runs/project-graph-review-cycle/portable-run/graph-snapshot.json',
    };
    expect(artifacts).toEqual(expectedRefs);

    const persisted = JSON.parse(await readFile(join(fixtureRoot, expectedRefs.reportJson), 'utf8')) as {
      artifacts: typeof expectedRefs;
    };
    expect(persisted.artifacts).toEqual(expectedRefs);
    expect(JSON.stringify(persisted.artifacts)).not.toContain(fixtureRoot);
  });
});

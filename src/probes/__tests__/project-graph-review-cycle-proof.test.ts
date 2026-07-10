import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { GraphSlice } from '../../graph/queries.js';
import type { JsonRpcResponse } from '../../rpc/protocol.js';
import {
  materializeScopeHandoffWorkerRequest,
  summarizeProjectGraphReviewCycleProof,
  writeProjectGraphReviewCycleArtifacts,
  type ProjectGraphReviewCycleReport,
} from '../project-graph-review-cycle-proof.js';

const baseOverview: GraphSlice = {
  nodes: [
    {
      id: 1,
      specId: 7,
      plane: 'intent',
      kind: 'goal',
      kindOrdinal: 1,
      title: 'Macro view explains derivation history',
      basis: 'explicit',
      settlement: 'settled',
      createdAtLsn: 2,
      updatedAtLsn: 2,
    },
  ],
  edges: [],

  lsn: 2,
};

const approvedOverview: GraphSlice = {
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
      settlement: 'settled',
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
      category: 'rationale',
      stance: 'for',
      basis: 'explicit',
      settlement: 'settled',
      createdAtLsn: 3,
      updatedAtLsn: 3,
    },
  ],

  lsn: 3,
};

const scopeBaseOverview: GraphSlice = {
  nodes: [
    {
      id: 1,
      specId: 9,
      plane: 'intent',
      kind: 'requirement',
      kindOrdinal: 1,
      title: 'Show the selected spec before deeper work begins',
      basis: 'explicit',
      settlement: 'settled',
      createdAtLsn: 5,
      updatedAtLsn: 5,
    },
    {
      id: 2,
      specId: 9,
      plane: 'design',
      kind: 'module',
      kindOrdinal: 1,
      title: 'Selected spec entry summary renderer',
      basis: 'explicit',
      settlement: 'settled',
      createdAtLsn: 5,
      updatedAtLsn: 5,
    },
    {
      id: 3,
      specId: 9,
      plane: 'oracle',
      kind: 'check',
      kindOrdinal: 1,
      title: 'Selected spec entry proof',
      basis: 'explicit',
      settlement: 'settled',
      createdAtLsn: 5,
      updatedAtLsn: 5,
    },
    {
      id: 6,
      specId: 9,
      plane: 'intent',
      kind: 'criterion',
      kindOrdinal: 1,
      title: 'Selected spec appears before downstream work',
      basis: 'explicit',
      settlement: 'settled',
      createdAtLsn: 5,
      updatedAtLsn: 5,
    },
  ],
  edges: [
    {
      id: 5,
      specId: 9,
      sourceId: 6,
      targetId: 1,
      category: 'witness',
      stance: 'for',
      basis: 'explicit',
      settlement: 'settled',
      createdAtLsn: 5,
      updatedAtLsn: 5,
    },
  ],
  lsn: 5,
};

const scopeApprovedOverview: GraphSlice = {
  nodes: [
    ...scopeBaseOverview.nodes,
    {
      id: 4,
      specId: 9,
      plane: 'plan',
      kind: 'frontier',
      kindOrdinal: 1,
      title: 'Selected spec handoff frontier',
      basis: 'explicit',
      settlement: 'settled',
      createdAtLsn: 6,
      updatedAtLsn: 6,
    },
    {
      id: 5,
      specId: 9,
      plane: 'plan',
      kind: 'scope',
      kindOrdinal: 1,
      title: 'Selected spec execution handoff',
      body: 'Render the selected spec identity before downstream work begins.',
      basis: 'explicit',
      settlement: 'settled',
      createdAtLsn: 6,
      updatedAtLsn: 6,
    },
  ],
  edges: [
    ...scopeBaseOverview.edges,
    {
      id: 1,
      specId: 9,
      sourceId: 4,
      targetId: 5,
      category: 'composition',
      basis: 'explicit',
      settlement: 'settled',
      createdAtLsn: 6,
      updatedAtLsn: 6,
    },
    {
      id: 2,
      specId: 9,
      sourceId: 1,
      targetId: 5,
      category: 'realization',
      basis: 'explicit',
      settlement: 'settled',
      createdAtLsn: 6,
      updatedAtLsn: 6,
    },
    {
      id: 3,
      specId: 9,
      sourceId: 3,
      targetId: 5,
      category: 'dependency',
      basis: 'explicit',
      settlement: 'settled',
      createdAtLsn: 6,
      updatedAtLsn: 6,
    },
    {
      id: 4,
      specId: 9,
      sourceId: 5,
      targetId: 2,
      category: 'composition',
      basis: 'explicit',
      settlement: 'settled',
      createdAtLsn: 6,
      updatedAtLsn: 6,
    },
    {
      id: 6,
      specId: 9,
      sourceId: 6,
      targetId: 5,
      category: 'dependency',
      basis: 'explicit',
      settlement: 'settled',
      createdAtLsn: 6,
      updatedAtLsn: 6,
    },
  ],
  lsn: 6,
};

const scopeApprovedOverviewMissingDesignAnchor: GraphSlice = {
  ...scopeApprovedOverview,
  edges: scopeApprovedOverview.edges.filter((edge) => edge.id !== 4),
};

const runtimeState = {
  operationalMode: 'specify',
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
    tool_meta: { curr: 'present_review_set', next: 'request_response' },
    display: { heading: 'Derived macro-view requirement' },
    review_set: {
      nodes: [
        {
          draft_id: 'req-resolution-state',
          proposed_code: 'REQ1',
          plane: 'intent',
          kind: 'requirement',
          title: 'Macro view names impasse resolution state',
        },
      ],
      edges: [
        {
          category: 'rationale',
          support: { draft_id: 'req-resolution-state' },
          claim: { existing_code: 'G1' },
          stance: 'for',
        },
      ],
    },
  });
}

function requestResponseReviewEntry(): string {
  return toolResultEntry('request_response', {
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
          nodes: [{ draft_id: 'req-resolution-state', proposed_code: 'REQ1' }],
          edges: [{ category: 'rationale' }],
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
      review: { status: 'approved', lsn: 3, createdNodes: { 'req-resolution-state': { id: 2 } } },
    },
  };
}

function scopePresentReviewSetEntry(
  includeVerificationLink = true,
  anchors: { readonly design: string; readonly verification: string } = {
    design: 'MOD1',
    verification: 'CH1',
  },
): string {
  return toolResultEntry('present_review_set', {
    schema: 'brunch.structured_exchange.present',
    v: 1,
    exchange_id: 'scope-review-1',
    tool_meta: { curr: 'present_review_set', next: 'ask' },
    display: { heading: 'Commit the selected-spec handoff package' },
    review_set: {
      nodes: [
        {
          draft_id: 'frontier-selected-spec-handoff',
          proposed_code: 'F1',
          plane: 'plan',
          kind: 'frontier',
          title: 'Selected spec handoff frontier',
        },
        {
          draft_id: 'scope-selected-spec-handoff',
          proposed_code: 'SCP1',
          plane: 'plan',
          kind: 'scope',
          title: 'Selected spec execution handoff',
        },
      ],
      edges: [
        {
          category: 'composition',
          whole: { draft_id: 'frontier-selected-spec-handoff' },
          part: { draft_id: 'scope-selected-spec-handoff' },
        },
        {
          category: 'realization',
          abstract: { existing_code: 'REQ1' },
          concrete: { draft_id: 'scope-selected-spec-handoff' },
        },
        {
          category: 'composition',
          whole: { draft_id: 'scope-selected-spec-handoff' },
          part: { existing_code: anchors.design },
        },
        {
          category: 'dependency',
          dependency: { existing_code: 'AC1' },
          dependent: { draft_id: 'scope-selected-spec-handoff' },
        },
        ...(includeVerificationLink
          ? [
              {
                category: 'dependency',
                dependency: { existing_code: anchors.verification },
                dependent: { draft_id: 'scope-selected-spec-handoff' },
              },
            ]
          : []),
      ],
    },
  });
}

function scopePendingReviewResponse(): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id: 1,
    result: {
      status: 'pending',
      exchange: {
        exchangeId: 'scope-review-1',
        mode: 'review',
        reviewSet: {
          nodes: [
            { draft_id: 'frontier-selected-spec-handoff', proposed_code: 'F1' },
            { draft_id: 'scope-selected-spec-handoff', proposed_code: 'SCP1' },
          ],
          edges: [
            { category: 'composition' },
            { category: 'realization' },
            { category: 'composition' },
            { category: 'dependency' },
            { category: 'dependency' },
          ],
        },
      },
    },
  };
}

function scopeApprovedResponse(): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id: 2,
    result: {
      status: 'accepted',
      exchangeId: 'scope-review-1',
      answer: { review: { decision: 'approve', comment: 'Scope handoff approved.' } },
      review: {
        status: 'approved',
        lsn: 6,
        createdNodes: {
          'frontier-selected-spec-handoff': { id: 4 },
          'scope-selected-spec-handoff': { id: 5 },
        },
      },
    },
  };
}

describe('project-graph review-cycle proof report', () => {
  it('requires present_review_set transcript evidence, public RPC approval, and explicit graph readback', () => {
    const report = summarizeProjectGraphReviewCycleProof({
      runId: 'project-graph-review-test',
      generatedAt: '2026-06-06T00:00:00.000Z',
      cwd: '/tmp/brunch-project-graph-review-test',
      seedVariant: 'grounded-intent',
      specId: 7,
      sessionId: 'session-1',
      prompt: 'Present a review set.',
      runtimeState,
      model: 'test-model',
      sessionText: [presentReviewSetEntry(), requestResponseReviewEntry()].join('\n'),
      baseOverview,
      finalOverview: approvedOverview,
      pendingResponse: pendingReviewResponse(),
      approvalResponse: approvedResponse(),
      productUpdates: [{ topic: 'graph.overview', specId: 7, lsn: 3 }],
    });

    expect(report.success).toBe(true);
    expect(report.toolEvidence).toMatchObject({
      presentReviewSetCount: 1,
      requestResponseCount: 1,
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
        code: 'REQ1',
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
      seedVariant: 'grounded-intent',
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

  it('writes session, transcript, report, and graph overview artifacts', async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'brunch-project-graph-review-artifacts-'));
    const report: ProjectGraphReviewCycleReport = summarizeProjectGraphReviewCycleProof({
      runId: 'artifact-run',
      generatedAt: '2026-06-06T00:00:00.000Z',
      cwd: fixtureRoot,
      seedVariant: 'grounded-intent',
      specId: 7,
      sessionId: 'session-1',
      prompt: 'Present a review set.',
      runtimeState,
      sessionText: [presentReviewSetEntry(), requestResponseReviewEntry()].join('\n'),
      baseOverview,
      finalOverview: approvedOverview,
      pendingResponse: pendingReviewResponse(),
      approvalResponse: approvedResponse(),
    });

    const artifacts = await writeProjectGraphReviewCycleArtifacts({
      fixtureRoot,
      runId: report.runId,
      sessionText: [presentReviewSetEntry(), requestResponseReviewEntry()].join('\n'),
      report,
      graphOverview: approvedOverview,
    });

    expect(artifacts.runDir).toBe('runs/project-graph-review-cycle/artifact-run');
    await expect(readFile(join(fixtureRoot, artifacts.sessionJsonl), 'utf8')).resolves.toContain(
      'present_review_set',
    );
    await expect(readFile(join(fixtureRoot, artifacts.reportJson), 'utf8')).resolves.toContain(
      'project-graph-review-cycle',
    );
    await expect(readFile(join(fixtureRoot, artifacts.graphOverviewJson), 'utf8')).resolves.toContain(
      'Macro view names impasse resolution state',
    );

    await expect(
      writeProjectGraphReviewCycleArtifacts({
        fixtureRoot,
        runId: '../escape',
        sessionText: '',
        report: { ...report, runId: '../escape' },
        graphOverview: approvedOverview,
      }),
    ).rejects.toThrow('Artifact runId must be a portable single path segment');
  });

  it('persists portable, fixture-relative artifact references in report JSON', async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'brunch-project-graph-review-portable-'));
    const report: ProjectGraphReviewCycleReport = summarizeProjectGraphReviewCycleProof({
      runId: 'portable-run',
      generatedAt: '2026-06-06T00:00:00.000Z',
      cwd: fixtureRoot,
      seedVariant: 'grounded-intent',
      specId: 7,
      sessionId: 'session-1',
      prompt: 'Present a review set.',
      runtimeState,
      sessionText: [presentReviewSetEntry(), requestResponseReviewEntry()].join('\n'),
      baseOverview,
      finalOverview: approvedOverview,
      pendingResponse: pendingReviewResponse(),
      approvalResponse: approvedResponse(),
    });

    const artifacts = await writeProjectGraphReviewCycleArtifacts({
      fixtureRoot,
      runId: report.runId,
      sessionText: [presentReviewSetEntry(), requestResponseReviewEntry()].join('\n'),
      report,
      graphOverview: approvedOverview,
    });

    const expectedRefs = {
      runDir: 'runs/project-graph-review-cycle/portable-run',
      sessionJsonl: 'runs/project-graph-review-cycle/portable-run/session.jsonl',
      reportJson: 'runs/project-graph-review-cycle/portable-run/report.json',
      graphOverviewJson: 'runs/project-graph-review-cycle/portable-run/graph-overview.json',
    };
    expect(artifacts).toEqual(expectedRefs);

    const persisted = JSON.parse(await readFile(join(fixtureRoot, expectedRefs.reportJson), 'utf8')) as {
      artifacts: typeof expectedRefs;
    };
    expect(persisted.artifacts).toEqual(expectedRefs);
    expect(JSON.stringify(persisted.artifacts)).not.toContain(fixtureRoot);
  });

  it('can require a committed scope handoff package in the presented review set', () => {
    const report = summarizeProjectGraphReviewCycleProof({
      runId: 'scope-handoff-review-test',
      generatedAt: '2026-07-09T00:00:00.000Z',
      cwd: '/tmp/brunch-scope-handoff-review-test',
      seedVariant: 'scope-handoff-ready',
      specId: 9,
      sessionId: 'session-scope-1',
      prompt: 'Present a scope handoff review set.',
      runtimeState,
      sessionText: [scopePresentReviewSetEntry(), requestResponseReviewEntry()].join('\n'),
      baseOverview: scopeBaseOverview,
      finalOverview: scopeApprovedOverview,
      pendingResponse: scopePendingReviewResponse(),
      approvalResponse: scopeApprovedResponse(),
      reviewSetExpectation: 'scope_handoff',
    });

    expect(report.success).toBe(true);
    expect(report.scopeHandoffReviewSet).toMatchObject({
      observed: true,
      frontierDraftCount: 1,
      scopeDraftCount: 1,
      frontierScopeCompositionCount: 1,
      requirementAnchorCount: 1,
      designAnchorCount: 1,
      verificationAnchorCount: 1,
      committedRequirementAnchorCount: 1,
      committedDesignAnchorCount: 1,
      committedVerificationAnchorCount: 1,
      committedFrontierCount: 1,
      committedScopeCount: 1,
    });
    expect(report.scopeHandoffExecutor).toEqual({
      checkStatus: 'ok',
      findingCodes: [],
      sliceCount: 1,
      scopeSliceCount: 1,
      readyScopeSliceCount: 1,
      criterionTargetCount: 1,
      designContextCount: 1,
      verificationContextCount: 1,
      workerRequestStatus: 'not_attempted',
    });
    expect(report.friction).toEqual([]);
  });

  it('materializes the committed scope through the production worker-request boundary', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-scope-handoff-worker-request-'));

    const evidence = await materializeScopeHandoffWorkerRequest({
      cwd,
      runId: 'scope-handoff-executor-test',
      specId: 9,
      overview: scopeApprovedOverview,
    });

    expect(evidence).toMatchObject({
      checkStatus: 'ok',
      readyScopeSliceCount: 1,
      workerRequestStatus: 'ready',
      workerRequest: {
        scopeId: 'SCP1',
        criterionCount: 1,
        designContextCount: 1,
        verificationContextCount: 1,
      },
    });
  });

  it('accepts every supported design and verification anchor kind', () => {
    const baseOverview: GraphSlice = {
      ...scopeBaseOverview,
      nodes: scopeBaseOverview.nodes.map((node) =>
        node.id === 2
          ? { ...node, kind: 'interface' }
          : node.id === 3
            ? { ...node, kind: 'vv_method' }
            : node,
      ),
    };
    const finalOverview: GraphSlice = {
      ...scopeApprovedOverview,
      nodes: scopeApprovedOverview.nodes.map((node) =>
        node.id === 2
          ? { ...node, kind: 'interface' }
          : node.id === 3
            ? { ...node, kind: 'vv_method' }
            : node,
      ),
    };
    const report = summarizeProjectGraphReviewCycleProof({
      runId: 'scope-handoff-kind-review-test',
      generatedAt: '2026-07-09T00:00:00.000Z',
      cwd: '/tmp/brunch-scope-handoff-kind-review-test',
      seedVariant: 'scope-handoff-ready',
      specId: 9,
      sessionId: 'session-scope-kinds',
      prompt: 'Present a scope handoff review set.',
      runtimeState,
      sessionText: [
        scopePresentReviewSetEntry(true, { design: 'API1', verification: 'VV1' }),
        requestResponseReviewEntry(),
      ].join('\n'),
      baseOverview,
      finalOverview,
      pendingResponse: scopePendingReviewResponse(),
      approvalResponse: scopeApprovedResponse(),
      reviewSetExpectation: 'scope_handoff',
    });

    expect(report.success).toBe(true);
    expect(report.scopeHandoffReviewSet).toMatchObject({
      designAnchorCount: 1,
      verificationAnchorCount: 1,
      committedDesignAnchorCount: 1,
      committedVerificationAnchorCount: 1,
    });
  });

  it('fails closed when the scope handoff review set omits a verification anchor', () => {
    const report = summarizeProjectGraphReviewCycleProof({
      runId: 'scope-handoff-review-test',
      generatedAt: '2026-07-09T00:00:00.000Z',
      cwd: '/tmp/brunch-scope-handoff-review-test',
      seedVariant: 'scope-handoff-ready',
      specId: 9,
      sessionId: 'session-scope-1',
      prompt: 'Present a scope handoff review set.',
      runtimeState,
      sessionText: [scopePresentReviewSetEntry(false), requestResponseReviewEntry()].join('\n'),
      baseOverview: scopeBaseOverview,
      finalOverview: scopeApprovedOverview,
      pendingResponse: scopePendingReviewResponse(),
      approvalResponse: scopeApprovedResponse(),
      reviewSetExpectation: 'scope_handoff',
    });

    expect(report.success).toBe(false);
    expect(report.scopeHandoffReviewSet).toMatchObject({
      observed: true,
      verificationAnchorCount: 0,
    });
    expect(report.friction).toContain(
      'Scope-handoff review set did not link the scope package to an existing verification anchor.',
    );
  });

  it('fails closed when approval drops a committed design anchor from graph readback', () => {
    const report = summarizeProjectGraphReviewCycleProof({
      runId: 'scope-handoff-review-test',
      generatedAt: '2026-07-09T00:00:00.000Z',
      cwd: '/tmp/brunch-scope-handoff-review-test',
      seedVariant: 'scope-handoff-ready',
      specId: 9,
      sessionId: 'session-scope-1',
      prompt: 'Present a scope handoff review set.',
      runtimeState,
      sessionText: [scopePresentReviewSetEntry(), requestResponseReviewEntry()].join('\n'),
      baseOverview: scopeBaseOverview,
      finalOverview: scopeApprovedOverviewMissingDesignAnchor,
      pendingResponse: scopePendingReviewResponse(),
      approvalResponse: scopeApprovedResponse(),
      reviewSetExpectation: 'scope_handoff',
    });

    expect(report.success).toBe(false);
    expect(report.friction).toContain(
      'Graph readback did not preserve a committed design anchor on the scope-handoff package.',
    );
  });

  it('fails closed when the committed package has no executable criterion', () => {
    const finalOverview = {
      ...scopeApprovedOverview,
      nodes: scopeApprovedOverview.nodes.filter((node) => node.kind !== 'criterion'),
      edges: scopeApprovedOverview.edges.filter((edge) => edge.id !== 5),
    };
    const report = summarizeProjectGraphReviewCycleProof({
      runId: 'scope-handoff-criterion-test',
      generatedAt: '2026-07-09T00:00:00.000Z',
      cwd: '/tmp/brunch-scope-handoff-criterion-test',
      seedVariant: 'scope-handoff-ready',
      specId: 9,
      sessionId: 'session-scope-criterion',
      prompt: 'Present a scope handoff review set.',
      runtimeState,
      sessionText: [scopePresentReviewSetEntry(), requestResponseReviewEntry()].join('\n'),
      baseOverview: scopeBaseOverview,
      finalOverview,
      pendingResponse: scopePendingReviewResponse(),
      approvalResponse: scopeApprovedResponse(),
      reviewSetExpectation: 'scope_handoff',
    });

    expect(report.success).toBe(false);
    expect(report.scopeHandoffExecutor).toMatchObject({
      checkStatus: 'blocked',
      readyScopeSliceCount: 0,
      criterionTargetCount: 0,
    });
    expect(report.friction).toContain(
      'Committed scope handoff is blocked by executor plan checks: requirement_without_criterion, scope_without_criterion.',
    );
  });
});

import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { getAgentDir } from '@earendil-works/pi-coding-agent';

import {
  appendBrunchAgentRuntimeSwitch,
  type BrunchAgentState,
} from '../.pi/extensions/agent-runtime/runtime/index.js';
import { createBrunchAgentSessionRuntimeFactory } from '../app/brunch-tui.js';
import { createGitSliceIntegrationPort } from '../app/git-slice-integration-port.js';
import { zPresentReviewSetDetails } from '../exchanges/schemas/present.js';
import { zRequestReviewDetails } from '../exchanges/schemas/request.js';
import { projectExecuteGraph } from '../executor/execute-projection.js';
import type { GitWorktreePort } from '../executor/execution-ports.js';
import { writePlanFile } from '../executor/plan-file.js';
import { populateWorktree } from '../executor/populate.js';
import { initializeReports } from '../executor/report.js';
import { createRun } from '../executor/run.js';
import { requestSliceExecution } from '../executor/slice-execute.js';
import { startSlice } from '../executor/slice-start.js';
import { copyHostSource } from '../executor/source-copy.js';
import { selectSourcePolicy } from '../executor/source-policy.js';
import { createWorktree } from '../executor/worktree.js';
import { openWorkspaceGraphRuntime, type GraphNode, type GraphSlice } from '../graph/index.js';
import { formatGraphNodeCode, parseGraphNodeCode } from '../graph/schema/nodes.js';
import { seedFixture, type SeedFixture } from '../graph/seed-fixtures.js';
import { createRpcHandlers } from '../rpc/handlers.js';
import { createProductUpdatePublisher, type ProductUpdate } from '../rpc/product-updates.js';
import type { JsonRpcResponse } from '../rpc/protocol.js';
import { createWorkspaceSessionCoordinator } from '../session/workspace-session-coordinator.js';
import { assertPortableRunId, portableCwd } from './portable-report.js';

const PROBE_ID = 'project-graph-review-cycle' as const;
const DEFAULT_SEED_NAME = 'bilal-macro-view';
const DEFAULT_SEED_VARIANT = 'grounded-intent';
const DEFAULT_SEED_REF = `${DEFAULT_SEED_NAME}/${DEFAULT_SEED_VARIANT}`;

interface ProjectGraphReviewRuntimeStateReport {
  readonly operationalMode: 'specify';
}

interface ProjectGraphReviewCycleProofOptions {
  readonly cwd?: string;
  readonly fixtureRoot?: string;
  readonly seedName?: string;
  readonly seedVariant?: string;
  readonly runId?: string;
  readonly prompt?: string;
  readonly agentDir?: string;
  readonly reviewSetExpectation?: ReviewSetExpectation;
}

export interface ProjectGraphReviewCycleArtifacts {
  readonly runDir: string;
  readonly sessionJsonl: string;
  readonly reportJson: string;
  readonly graphOverviewJson: string;
}

interface ReviewCycleToolEvidence {
  readonly presentReviewSetCount: number;
  readonly askTerminalCount: number;
  readonly successfulPresentReviewSetCount: number;
  readonly structuralIllegalPresentReviewSetCount: number;
}

interface ReviewCycleApprovalEvidence {
  readonly attempted: boolean;
  readonly status?:
    | 'approved'
    | 'request_changes'
    | 'rejected'
    | 'structural_illegal'
    | 'rpc_error'
    | 'unexpected';
  readonly lsn?: number;
  readonly createdNodeRefs?: Record<string, unknown>;
  readonly diagnostics?: readonly Record<string, unknown>[];
  readonly error?: string;
}

type ReviewSetExpectation = 'scope_handoff';

interface ScopeHandoffReviewSetEvidence {
  readonly observed: boolean;
  readonly frontierDraftCount: number;
  readonly scopeDraftCount: number;
  readonly frontierScopeCompositionCount: number;
  readonly requirementAnchorCount: number;
  readonly designAnchorCount: number;
  readonly verificationAnchorCount: number;
  readonly committedRequirementAnchorCount: number;
  readonly committedDesignAnchorCount: number;
  readonly committedVerificationAnchorCount: number;
  readonly committedFrontierCount: number;
  readonly committedScopeCount: number;
}

interface ScopeHandoffExecutorEvidence {
  readonly checkStatus: 'ok' | 'blocked';
  readonly findingCodes: readonly string[];
  readonly sliceCount: number;
  readonly scopeSliceCount: number;
  readonly readyScopeSliceCount: number;
  readonly criterionTargetCount: number;
  readonly designContextCount: number;
  readonly verificationContextCount: number;
  readonly workerRequestStatus: 'not_attempted' | 'ready' | 'failed';
  readonly workerRequestError?: string;
  readonly workerRequest?: {
    readonly scopeId?: string;
    readonly criterionCount: number;
    readonly designContextCount: number;
    readonly verificationContextCount: number;
  };
}

interface ProjectGraphReviewCycleCreatedNode {
  readonly id: number;
  readonly code: string;
  readonly plane: GraphNode['plane'];
  readonly kind: GraphNode['kind'];
  readonly title: string;
  readonly basis: 'explicit';
}

export interface ProjectGraphReviewCycleReport {
  readonly schemaVersion: 1;
  readonly probeId: typeof PROBE_ID;
  readonly runId: string;
  readonly generatedAt: string;
  readonly mission: string;
  readonly evaluationFocus: string;
  readonly seedName: string;
  readonly seedVariant: string;
  readonly cwd: string;
  readonly specId: number;
  readonly sessionId: string;
  readonly prompt: string;
  readonly runtimeState: ProjectGraphReviewRuntimeStateReport;
  readonly model?: string;
  readonly success: boolean;
  readonly baseGraph: {
    readonly nodeCount: number;
    readonly edgeCount: number;
    readonly lsn: number;
  };
  readonly finalGraph: {
    readonly nodeCount: number;
    readonly edgeCount: number;
    readonly lsn: number;
    readonly explicitNodeCount: number;
    readonly explicitEdgeCount: number;
    readonly implicitNodeCount: number;
    readonly implicitEdgeCount: number;
  };
  readonly graphDelta: {
    readonly lsnAdvanced: boolean;
    readonly nodeDelta: number;
    readonly edgeDelta: number;
  };
  readonly toolEvidence: ReviewCycleToolEvidence;
  readonly pendingReview: {
    readonly observed: boolean;
    readonly exchangeId?: string;
    readonly nodeDraftCount?: number;
    readonly edgeDraftCount?: number;
  };
  readonly approval: ReviewCycleApprovalEvidence;
  readonly createdNodes: readonly ProjectGraphReviewCycleCreatedNode[];
  readonly scopeHandoffReviewSet?: ScopeHandoffReviewSetEvidence | undefined;
  readonly scopeHandoffExecutor?: ScopeHandoffExecutorEvidence | undefined;
  readonly productUpdates: readonly ProductUpdate[];
  readonly friction: readonly string[];
  readonly artifacts?: ProjectGraphReviewCycleArtifacts;
}

export interface ProjectGraphReviewCycleSummaryInput {
  readonly runId: string;
  readonly generatedAt: string;
  readonly cwd: string;
  readonly seedName?: string;
  readonly seedVariant: string;
  readonly specId: number;
  readonly sessionId: string;
  readonly prompt: string;
  readonly runtimeState: ProjectGraphReviewRuntimeStateReport;
  readonly model?: string;
  readonly sessionText: string;
  readonly baseOverview: GraphSlice;
  readonly finalOverview: GraphSlice;
  readonly pendingResponse?: JsonRpcResponse;
  readonly approvalResponse?: JsonRpcResponse;
  readonly productUpdates?: readonly ProductUpdate[];
  readonly friction?: readonly string[];
  readonly reviewSetExpectation?: ReviewSetExpectation;
  readonly scopeHandoffExecutor?: ScopeHandoffExecutorEvidence;
  readonly requireWorkerRequest?: boolean;
}

interface PendingExchangeResult {
  readonly status: 'pending' | 'idle';
  readonly exchange: null | {
    readonly exchangeId?: unknown;
    readonly mode?: unknown;
    readonly reviewSet?: unknown;
  };
}

interface SubmitExchangeResponseResult {
  readonly status: 'accepted';
  readonly review?: {
    readonly status?: unknown;
    readonly lsn?: unknown;
    readonly createdNodes?: unknown;
    readonly diagnostics?: unknown;
  };
}

export async function runProjectGraphReviewCycleProof(
  options: ProjectGraphReviewCycleProofOptions = {},
): Promise<ProjectGraphReviewCycleReport> {
  const cwd = resolve(options.cwd ?? (await mkdtemp(join(tmpdir(), 'brunch-project-graph-review-'))));
  const fixtureRoot = resolve(
    options.fixtureRoot ?? join(dirname(fileURLToPath(import.meta.url)), '../../.fixtures'),
  );
  const seedName = options.seedName ?? DEFAULT_SEED_NAME;
  const seedVariant = options.seedVariant ?? DEFAULT_SEED_VARIANT;
  const runId = assertPortableRunId(options.runId ?? defaultRunId());
  const prompt = options.prompt ?? defaultProjectGraphPrompt();
  const generatedAt = new Date().toISOString();
  const fixture = await readSeedFixture(join(fixtureRoot, 'seeds', seedName, `${seedVariant}.json`));
  const graph = await openWorkspaceGraphRuntime(cwd);
  const seedResult = seedFixture(graph.commandExecutor, fixture);
  const baseOverview = graph.forSpec(seedResult.specId).queryGraph();
  const coordinator = createWorkspaceSessionCoordinator({ cwd });
  await coordinator.openDefaultWorkspace();
  await selectSpecForSetupSession(cwd, seedResult.specId);
  const activated = await coordinator.activateWorkspace({ action: 'newSession', specId: seedResult.specId });
  if (activated.status !== 'ready') {
    throw new Error(`project-graph probe could not activate seeded spec: ${activated.status}`);
  }

  const runtimeState: BrunchAgentState = {
    schemaVersion: 1,
    operationalMode: 'specify',
  };
  const runtimeStateReport: ProjectGraphReviewRuntimeStateReport = {
    operationalMode: 'specify',
  };
  appendBrunchAgentRuntimeSwitch(activated.session.manager, runtimeState, 'extension');
  const productUpdates = createProductUpdatePublisher();
  const observedUpdates: ProductUpdate[] = [];
  const unsubscribe = productUpdates.subscribe((updates) => observedUpdates.push(...updates));
  const createRuntime = createBrunchAgentSessionRuntimeFactory({
    workspace: activated,
    coordinator,
    productUpdates,
  });
  const created = await createRuntime({
    cwd,
    agentDir: options.agentDir ?? getAgentDir(),
    sessionManager: activated.session.manager,
  });
  const session = created.session;
  const friction = created.diagnostics.map((diagnostic) => `${diagnostic.type}: ${diagnostic.message}`);

  try {
    await session.sendUserMessage(prompt);
    await session.agent.waitForIdle();

    const handlers = createRpcHandlers({ coordinator, cwd, productUpdates });
    const pendingResponse = await handlers.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'session.pendingExchange',
    });
    const pending = pendingReviewFromResponse(pendingResponse);
    const approvalResponse = pending
      ? await handlers.handle({
          jsonrpc: '2.0',
          id: 2,
          method: 'session.submitExchangeResponse',
          params: {
            exchangeId: pending.exchangeId,
            answer: { review: { decision: 'approve', comment: 'Probe approval.' } },
          },
        })
      : undefined;

    const sessionText = await readFile(activated.session.file, 'utf8');
    const finalOverview = graph.forSpec(seedResult.specId).queryGraph();
    const scopeHandoffExecutor =
      options.reviewSetExpectation === 'scope_handoff'
        ? await materializeScopeHandoffWorkerRequest({
            cwd,
            runId: `${runId}-executor`,
            specId: seedResult.specId,
            overview: finalOverview,
          })
        : undefined;
    let report = summarizeProjectGraphReviewCycleProof({
      runId,
      generatedAt,
      cwd,
      seedName,
      seedVariant,
      specId: seedResult.specId,
      sessionId: activated.session.id,
      prompt,
      runtimeState: runtimeStateReport,
      ...(session.model?.id !== undefined ? { model: session.model.id } : {}),
      sessionText,
      baseOverview,
      finalOverview,
      ...(pendingResponse !== undefined ? { pendingResponse } : {}),
      ...(approvalResponse !== undefined ? { approvalResponse } : {}),
      productUpdates: observedUpdates,
      friction,
      ...(options.reviewSetExpectation !== undefined
        ? { reviewSetExpectation: options.reviewSetExpectation }
        : {}),
      ...(scopeHandoffExecutor ? { scopeHandoffExecutor, requireWorkerRequest: true } : {}),
    });

    report = {
      ...report,
      artifacts: await writeProjectGraphReviewCycleArtifacts({
        fixtureRoot,
        runId,
        sessionText,
        report,
        graphOverview: finalOverview,
      }),
    };
    return report;
  } finally {
    unsubscribe();
    session.dispose();
  }
}

export function summarizeProjectGraphReviewCycleProof(
  input: ProjectGraphReviewCycleSummaryInput,
): ProjectGraphReviewCycleReport {
  const toolEvidence = reviewCycleToolEvidence(input.sessionText);
  const pendingReview = pendingReviewSummary(input.pendingResponse);
  const approval = approvalEvidence(input.approvalResponse);
  const explicitNodeCount = input.finalOverview.nodes.filter((node) => node.basis === 'explicit').length;
  const explicitEdgeCount = input.finalOverview.edges.filter((edge) => edge.basis === 'explicit').length;
  const implicitNodeCount = input.finalOverview.nodes.filter((node) => node.basis === 'implicit').length;
  const implicitEdgeCount = input.finalOverview.edges.filter((edge) => edge.basis === 'implicit').length;
  const createdNodes = input.finalOverview.nodes.flatMap((node): ProjectGraphReviewCycleCreatedNode[] => {
    if (node.basis !== 'explicit' || node.createdAtLsn <= input.baseOverview.lsn) return [];
    return [
      {
        id: node.id,
        code: formatGraphNodeCode(node.kind, node.kindOrdinal),
        plane: node.plane,
        kind: node.kind,
        title: node.title,
        basis: 'explicit',
      },
    ];
  });
  const graphDelta = {
    lsnAdvanced: input.finalOverview.lsn > input.baseOverview.lsn,
    nodeDelta: input.finalOverview.nodes.length - input.baseOverview.nodes.length,
    edgeDelta: input.finalOverview.edges.length - input.baseOverview.edges.length,
  };
  const scopeHandoffReviewSet =
    input.reviewSetExpectation === 'scope_handoff'
      ? summarizeScopeHandoffReviewSet({
          sessionText: input.sessionText,
          createdNodes,
          finalOverview: input.finalOverview,
        })
      : undefined;
  const scopeHandoffExecutor =
    input.reviewSetExpectation === 'scope_handoff'
      ? (input.scopeHandoffExecutor ?? summarizeScopeHandoffExecutor(input.specId, input.finalOverview))
      : undefined;
  const friction = [...(input.friction ?? [])];

  if (toolEvidence.presentReviewSetCount === 0) {
    friction.push('No present_review_set tool result was recorded in the session transcript.');
  }
  if (toolEvidence.successfulPresentReviewSetCount === 0) {
    friction.push('No successful present_review_set details were recorded in the session transcript.');
  }
  if (!pendingReview.observed) {
    friction.push('Public RPC did not observe a pending review exchange after the agent turn.');
  }
  if (!approval.attempted) {
    friction.push('Review approval was not attempted through public RPC.');
  } else if (approval.status !== 'approved') {
    friction.push(`Public RPC review approval did not succeed; status was ${approval.status ?? 'unknown'}.`);
  }
  if (!graphDelta.lsnAdvanced) {
    friction.push('Graph LSN did not advance for the selected spec after review approval.');
  }
  if (graphDelta.nodeDelta <= 0) {
    friction.push('Graph node count did not increase after review approval.');
  }
  if (createdNodes.length === 0) {
    friction.push('No explicit nodes created after the base fixture LSN were present in graph readback.');
  }

  if (scopeHandoffReviewSet) {
    if (!scopeHandoffReviewSet.observed) {
      friction.push('No successful scope-handoff review set was recorded in the session transcript.');
    }
    if (scopeHandoffReviewSet.frontierDraftCount === 0) {
      friction.push('Scope-handoff review set did not draft a frontier node.');
    }
    if (scopeHandoffReviewSet.scopeDraftCount === 0) {
      friction.push('Scope-handoff review set did not draft a scope node.');
    }
    if (scopeHandoffReviewSet.frontierScopeCompositionCount === 0) {
      friction.push('Scope-handoff review set did not compose the scope package under a frontier.');
    }
    if (scopeHandoffReviewSet.requirementAnchorCount === 0) {
      friction.push(
        'Scope-handoff review set did not link the scope package to an existing requirement anchor.',
      );
    }
    if (scopeHandoffReviewSet.designAnchorCount === 0) {
      friction.push('Scope-handoff review set did not link the scope package to an existing design anchor.');
    }
    if (scopeHandoffReviewSet.verificationAnchorCount === 0) {
      friction.push(
        'Scope-handoff review set did not link the scope package to an existing verification anchor.',
      );
    }
    if (scopeHandoffReviewSet.committedRequirementAnchorCount === 0) {
      friction.push(
        'Graph readback did not preserve a committed requirement anchor on the scope-handoff package.',
      );
    }
    if (scopeHandoffReviewSet.committedDesignAnchorCount === 0) {
      friction.push(
        'Graph readback did not preserve a committed design anchor on the scope-handoff package.',
      );
    }
    if (scopeHandoffReviewSet.committedVerificationAnchorCount === 0) {
      friction.push(
        'Graph readback did not preserve a committed verification anchor on the scope-handoff package.',
      );
    }
    if (scopeHandoffReviewSet.committedFrontierCount === 0) {
      friction.push('Graph readback did not include a committed frontier from the scope-handoff review set.');
    }
    if (scopeHandoffReviewSet.committedScopeCount === 0) {
      friction.push('Graph readback did not include a committed scope from the scope-handoff review set.');
    }
  }
  if (scopeHandoffExecutor) {
    if (scopeHandoffExecutor.checkStatus !== 'ok') {
      friction.push(
        `Committed scope handoff is blocked by executor plan checks: ${scopeHandoffExecutor.findingCodes.join(', ')}.`,
      );
    }
    if (
      scopeHandoffReviewSet &&
      scopeHandoffExecutor.readyScopeSliceCount !== scopeHandoffReviewSet.committedScopeCount
    ) {
      friction.push('Committed scope packages did not all lower into execution-ready scope slices.');
    }
    if (input.requireWorkerRequest && !hasCompleteWorkerRequest(scopeHandoffExecutor)) {
      friction.push(
        `Committed scope handoff did not reach a worker request: ${scopeHandoffExecutor.workerRequestError ?? scopeHandoffExecutor.workerRequestStatus}.`,
      );
    }
  }

  const success =
    toolEvidence.successfulPresentReviewSetCount > 0 &&
    pendingReview.observed &&
    approval.status === 'approved' &&
    graphDelta.lsnAdvanced &&
    graphDelta.nodeDelta > 0 &&
    createdNodes.length > 0 &&
    (!scopeHandoffReviewSet ||
      (scopeHandoffReviewSet.observed &&
        scopeHandoffReviewSet.frontierDraftCount > 0 &&
        scopeHandoffReviewSet.scopeDraftCount > 0 &&
        scopeHandoffReviewSet.frontierScopeCompositionCount > 0 &&
        scopeHandoffReviewSet.requirementAnchorCount > 0 &&
        scopeHandoffReviewSet.designAnchorCount > 0 &&
        scopeHandoffReviewSet.verificationAnchorCount > 0 &&
        scopeHandoffReviewSet.committedRequirementAnchorCount > 0 &&
        scopeHandoffReviewSet.committedDesignAnchorCount > 0 &&
        scopeHandoffReviewSet.committedVerificationAnchorCount > 0 &&
        scopeHandoffReviewSet.committedFrontierCount > 0 &&
        scopeHandoffReviewSet.committedScopeCount > 0 &&
        scopeHandoffExecutor?.checkStatus === 'ok' &&
        scopeHandoffExecutor.readyScopeSliceCount === scopeHandoffReviewSet.committedScopeCount &&
        (!input.requireWorkerRequest || hasCompleteWorkerRequest(scopeHandoffExecutor))));

  return {
    schemaVersion: 1,
    probeId: PROBE_ID,
    runId: input.runId,
    generatedAt: input.generatedAt,
    mission:
      input.reviewSetExpectation === 'scope_handoff'
        ? 'Prove live Specify authoring can commit a complete scope package that the executor projects into a plan-ready slice.'
        : 'Prove the project-graph capability path can present an exact review set and approve it through public RPC.',
    evaluationFocus:
      input.reviewSetExpectation === 'scope_handoff'
        ? 'FE-1175 live proposal → review approval → committed graph readback → production executor projection.'
        : 'FE-809 real agent proposal → present_review_set → session.submitExchangeResponse approval → explicit graph readback.',
    seedName: input.seedName ?? DEFAULT_SEED_NAME,
    seedVariant: input.seedVariant,
    cwd: input.cwd,
    specId: input.specId,
    sessionId: input.sessionId,
    prompt: input.prompt,
    runtimeState: input.runtimeState,
    ...(input.model !== undefined ? { model: input.model } : {}),
    success,
    baseGraph: {
      nodeCount: input.baseOverview.nodes.length,
      edgeCount: input.baseOverview.edges.length,
      lsn: input.baseOverview.lsn,
    },
    finalGraph: {
      nodeCount: input.finalOverview.nodes.length,
      edgeCount: input.finalOverview.edges.length,
      lsn: input.finalOverview.lsn,
      explicitNodeCount,
      explicitEdgeCount,
      implicitNodeCount,
      implicitEdgeCount,
    },
    graphDelta,
    toolEvidence,
    pendingReview,
    approval,
    createdNodes,
    ...(scopeHandoffReviewSet ? { scopeHandoffReviewSet } : {}),
    ...(scopeHandoffExecutor ? { scopeHandoffExecutor } : {}),
    productUpdates: input.productUpdates ?? [],
    friction,
  };
}

function summarizeScopeHandoffExecutor(specId: number, overview: GraphSlice): ScopeHandoffExecutorEvidence {
  const projection = projectExecuteGraph({
    specId,
    mode: 'greenfield',
    graphLsn: overview.lsn,
    nodes: overview.nodes,
    edges: overview.edges,
  });
  const scopeSlices = projection.planPreview.slices.filter((slice) => slice.scope_id !== undefined);
  const readyScopeSlices = scopeSlices.filter(
    (slice) =>
      slice.verification.length > 0 &&
      (slice.design_context?.length ?? 0) > 0 &&
      (slice.verification_context?.length ?? 0) > 0,
  );
  return {
    checkStatus: projection.check.status,
    findingCodes: projection.check.findings.map((finding) => finding.code),
    sliceCount: projection.planPreview.slices.length,
    scopeSliceCount: scopeSlices.length,
    readyScopeSliceCount: readyScopeSlices.length,
    criterionTargetCount: scopeSlices.reduce((count, slice) => count + slice.verification.length, 0),
    designContextCount: scopeSlices.reduce((count, slice) => count + (slice.design_context?.length ?? 0), 0),
    verificationContextCount: scopeSlices.reduce(
      (count, slice) => count + (slice.verification_context?.length ?? 0),
      0,
    ),
    workerRequestStatus: 'not_attempted',
  };
}

export async function materializeScopeHandoffWorkerRequest(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly specId: number;
  readonly overview: GraphSlice;
}): Promise<ScopeHandoffExecutorEvidence> {
  const projection = projectExecuteGraph({
    specId: args.specId,
    mode: 'greenfield',
    graphLsn: args.overview.lsn,
    nodes: args.overview.nodes,
    edges: args.overview.edges,
  });
  const evidence = summarizeScopeHandoffExecutor(args.specId, args.overview);
  if (projection.check.status !== 'ok') return evidence;

  try {
    await writePlanFile({ cwd: args.cwd, preview: projection.planPreview, source: projection.source });
    const run = await createRun({
      cwd: args.cwd,
      specId: String(args.specId),
      runId: args.runId,
      substrate: 'empty_dir',
    });
    if (run.status !== 'created') throw new Error(`run creation returned ${run.status}`);
    const worktree = await createWorktree({
      cwd: args.cwd,
      runId: args.runId,
      gitWorktree: UNUSED_GIT_WORKTREE_PORT,
    });
    if (worktree.status !== 'worktree_created')
      throw new Error(`worktree creation returned ${worktree.status}`);
    const populated = await populateWorktree({ cwd: args.cwd, runId: args.runId });
    if (populated.status !== 'worktree_populated') throw new Error(`population returned ${populated.status}`);
    const policy = await selectSourcePolicy({ cwd: args.cwd, runId: args.runId, policy: 'plan_only' });
    if (policy.status !== 'source_policy_selected')
      throw new Error(`source policy returned ${policy.status}`);
    const copied = await copyHostSource({ cwd: args.cwd, runId: args.runId });
    if (copied.runStatus !== 'source_copied') throw new Error(`source copy returned ${copied.status}`);
    const reports = await initializeReports({ cwd: args.cwd, runId: args.runId });
    if (reports.status !== 'reports_initialized')
      throw new Error(`report initialization returned ${reports.status}`);
    const started = await startSlice({ cwd: args.cwd, runId: args.runId });
    if (started.status !== 'slice_started') throw new Error(`slice start returned ${started.status}`);
    const requested = await requestSliceExecution({
      cwd: args.cwd,
      runId: args.runId,
      gitSliceIntegration: createGitSliceIntegrationPort(),
    });
    if (requested.status !== 'slice_execution_requested') {
      throw new Error(`slice request returned ${requested.status}`);
    }
    const request = JSON.parse(await readFile(requested.requestPath, 'utf8')) as {
      readonly scopeId?: string;
      readonly criteria?: readonly unknown[];
      readonly designContext?: readonly unknown[];
      readonly verificationContext?: readonly unknown[];
    };
    const workerRequest = {
      ...(request.scopeId ? { scopeId: request.scopeId } : {}),
      criterionCount: request.criteria?.length ?? 0,
      designContextCount: request.designContext?.length ?? 0,
      verificationContextCount: request.verificationContext?.length ?? 0,
    };
    const result: ScopeHandoffExecutorEvidence = {
      ...evidence,
      workerRequestStatus: 'ready',
      workerRequest,
    };
    if (hasCompleteWorkerRequest(result)) return result;
    return {
      ...evidence,
      workerRequestStatus: 'failed',
      workerRequestError: 'worker request omitted required scope, criterion, design, or verification context',
      workerRequest,
    };
  } catch (error) {
    return {
      ...evidence,
      workerRequestStatus: 'failed',
      workerRequestError: error instanceof Error ? error.message : String(error),
    };
  }
}

function hasCompleteWorkerRequest(evidence: ScopeHandoffExecutorEvidence): boolean {
  return (
    evidence.workerRequestStatus === 'ready' &&
    evidence.workerRequest?.scopeId !== undefined &&
    evidence.workerRequest.scopeId.trim().length > 0 &&
    evidence.workerRequest.criterionCount > 0 &&
    evidence.workerRequest.designContextCount > 0 &&
    evidence.workerRequest.verificationContextCount > 0
  );
}

const UNUSED_GIT_WORKTREE_PORT: GitWorktreePort = {
  async create(args) {
    return {
      status: 'failed',
      worktreeDir: args.worktreeDir,
      message: 'empty_dir proof runs must not call the git-worktree port',
      sideEffects: [],
    };
  },
};

function summarizeScopeHandoffReviewSet(input: {
  readonly sessionText: string;
  readonly createdNodes: readonly ProjectGraphReviewCycleCreatedNode[];
  readonly finalOverview: GraphSlice;
}): ScopeHandoffReviewSetEvidence {
  const details = latestSuccessfulPresentReviewSetDetails(input.sessionText);
  const createdFrontierCount = input.createdNodes.filter((node) => node.kind === 'frontier').length;
  const createdScopeCount = input.createdNodes.filter((node) => node.kind === 'scope').length;
  const createdScopeNodeIds = new Set(
    input.createdNodes.flatMap((node) => (node.kind === 'scope' ? [node.id] : [])),
  );
  if (!details) {
    return {
      observed: false,
      frontierDraftCount: 0,
      scopeDraftCount: 0,
      frontierScopeCompositionCount: 0,
      requirementAnchorCount: 0,
      designAnchorCount: 0,
      verificationAnchorCount: 0,
      committedRequirementAnchorCount: countCommittedScopeAnchor(input.finalOverview, createdScopeNodeIds, {
        category: 'realization',
        sourceKinds: ['requirement'],
        direction: 'incoming',
      }),
      committedDesignAnchorCount: countCommittedScopeAnchor(input.finalOverview, createdScopeNodeIds, {
        category: 'composition',
        sourceKinds: ['module', 'interface', 'entity', 'sketch'],
        direction: 'outgoing',
      }),
      committedVerificationAnchorCount: countCommittedScopeAnchor(input.finalOverview, createdScopeNodeIds, {
        category: 'dependency',
        sourceKinds: ['check', 'vv_method', 'evidence', 'vv_obligation'],
        direction: 'incoming',
      }),
      committedFrontierCount: createdFrontierCount,
      committedScopeCount: createdScopeCount,
    };
  }

  const nodes = Array.isArray(details.nodes) ? details.nodes.filter(isRecord) : [];
  const edges = Array.isArray(details.edges) ? details.edges.filter(isRecord) : [];
  const frontierDraftIds = new Set(
    nodes.flatMap((node) =>
      node.kind === 'frontier' && typeof node.draft_id === 'string' ? [node.draft_id] : [],
    ),
  );
  const scopeDraftIds = new Set(
    nodes.flatMap((node) =>
      node.kind === 'scope' && typeof node.draft_id === 'string' ? [node.draft_id] : [],
    ),
  );

  return {
    observed: true,
    frontierDraftCount: frontierDraftIds.size,
    scopeDraftCount: scopeDraftIds.size,
    frontierScopeCompositionCount: countFrontierScopeComposition(edges, frontierDraftIds, scopeDraftIds),
    requirementAnchorCount: countScopeAnchor(edges, scopeDraftIds, {
      category: 'realization',
      sourceField: 'abstract',
      targetField: 'concrete',
      existingKinds: ['requirement'],
    }),
    designAnchorCount: countScopeAnchor(edges, scopeDraftIds, {
      category: 'composition',
      sourceField: 'part',
      targetField: 'whole',
      existingKinds: ['module', 'interface', 'entity', 'sketch'],
    }),
    verificationAnchorCount: countScopeAnchor(edges, scopeDraftIds, {
      category: 'dependency',
      sourceField: 'dependency',
      targetField: 'dependent',
      existingKinds: ['check', 'vv_method', 'evidence', 'vv_obligation'],
    }),
    committedRequirementAnchorCount: countCommittedScopeAnchor(input.finalOverview, createdScopeNodeIds, {
      category: 'realization',
      sourceKinds: ['requirement'],
      direction: 'incoming',
    }),
    committedDesignAnchorCount: countCommittedScopeAnchor(input.finalOverview, createdScopeNodeIds, {
      category: 'composition',
      sourceKinds: ['module', 'interface', 'entity', 'sketch'],
      direction: 'outgoing',
    }),
    committedVerificationAnchorCount: countCommittedScopeAnchor(input.finalOverview, createdScopeNodeIds, {
      category: 'dependency',
      sourceKinds: ['check', 'vv_method', 'evidence', 'vv_obligation'],
      direction: 'incoming',
    }),
    committedFrontierCount: createdFrontierCount,
    committedScopeCount: createdScopeCount,
  };
}

function countCommittedScopeAnchor(
  overview: GraphSlice,
  scopeNodeIds: ReadonlySet<number>,
  options: {
    readonly category: string;
    readonly sourceKinds: readonly GraphNode['kind'][];
    readonly direction: 'incoming' | 'outgoing';
  },
): number {
  const nodeById = new Map(overview.nodes.map((node) => [node.id, node]));
  return overview.edges.filter((edge) => {
    if (edge.category !== options.category) return false;
    const relatedSourceId = options.direction === 'incoming' ? edge.sourceId : edge.targetId;
    const relatedTargetId = options.direction === 'incoming' ? edge.targetId : edge.sourceId;
    const sourceNode = nodeById.get(relatedSourceId);
    return (
      sourceNode !== undefined &&
      options.sourceKinds.includes(sourceNode.kind) &&
      scopeNodeIds.has(relatedTargetId)
    );
  }).length;
}

function latestSuccessfulPresentReviewSetDetails(
  sessionText: string,
): { readonly nodes?: unknown; readonly edges?: unknown } | undefined {
  let latest: { readonly nodes?: unknown; readonly edges?: unknown } | undefined;
  for (const message of toolResultMessages(sessionText)) {
    if (message.toolName !== 'present_review_set') continue;
    const details = isRecord(message.details) ? message.details : undefined;
    if (details?.schema !== 'brunch.structured_exchange.present') continue;
    const reviewSet = isRecord(details.review_set) ? details.review_set : undefined;
    if (!reviewSet) continue;
    latest = reviewSet as { readonly nodes?: unknown; readonly edges?: unknown };
  }
  return latest;
}

function countFrontierScopeComposition(
  edges: readonly Record<string, unknown>[],
  frontierDraftIds: ReadonlySet<string>,
  scopeDraftIds: ReadonlySet<string>,
): number {
  return edges.filter((edge) => {
    if (edge.category !== 'composition') return false;
    const wholeDraftId = draftId(isRecord(edge.whole) ? edge.whole : undefined);
    const partDraftId = draftId(isRecord(edge.part) ? edge.part : undefined);
    return (
      typeof wholeDraftId === 'string' &&
      typeof partDraftId === 'string' &&
      frontierDraftIds.has(wholeDraftId) &&
      scopeDraftIds.has(partDraftId)
    );
  }).length;
}

function countScopeAnchor(
  edges: readonly Record<string, unknown>[],
  scopeDraftIds: ReadonlySet<string>,
  options: {
    readonly category: string;
    readonly sourceField: string;
    readonly targetField: string;
    readonly existingKinds: readonly GraphNode['kind'][];
  },
): number {
  return edges.filter((edge) => {
    if (edge.category !== options.category) return false;
    const sourceValue = edge[options.sourceField];
    const targetValue = edge[options.targetField];
    const sourceCode = existingCode(isRecord(sourceValue) ? sourceValue : undefined);
    const sourceKind = sourceCode ? parseGraphNodeCode(sourceCode)?.kind : undefined;
    const targetDraftId = draftId(isRecord(targetValue) ? targetValue : undefined);
    return (
      sourceKind !== undefined &&
      options.existingKinds.includes(sourceKind) &&
      typeof targetDraftId === 'string' &&
      scopeDraftIds.has(targetDraftId)
    );
  }).length;
}

function existingCode(value: Record<string, unknown> | undefined): string | undefined {
  return typeof value?.existing_code === 'string' ? value.existing_code : undefined;
}

function draftId(value: Record<string, unknown> | undefined): string | undefined {
  return typeof value?.draft_id === 'string' ? value.draft_id : undefined;
}

export async function writeProjectGraphReviewCycleArtifacts(options: {
  readonly fixtureRoot: string;
  readonly runId: string;
  readonly sessionText: string;
  readonly report: ProjectGraphReviewCycleReport;
  readonly graphOverview: GraphSlice;
}): Promise<ProjectGraphReviewCycleArtifacts> {
  // Persisted artifact references are fixture-root-relative so committed
  // reports stay portable; the disk paths used for writing are resolved
  // against the (possibly absolute) fixture root.
  const runId = assertPortableRunId(options.runId);
  const runDirRef = `runs/${PROBE_ID}/${runId}`;
  const artifacts: ProjectGraphReviewCycleArtifacts = {
    runDir: runDirRef,
    sessionJsonl: `${runDirRef}/session.jsonl`,
    reportJson: `${runDirRef}/report.json`,
    graphOverviewJson: `${runDirRef}/graph-overview.json`,
  };
  const diskPath = (ref: string) => resolve(options.fixtureRoot, ref);
  const report = { ...options.report, cwd: portableCwd(options.report.cwd), artifacts };

  await mkdir(diskPath(artifacts.runDir), { recursive: true });
  await writeFile(diskPath(artifacts.sessionJsonl), options.sessionText, 'utf8');
  await writeFile(diskPath(artifacts.reportJson), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(
    diskPath(artifacts.graphOverviewJson),
    `${JSON.stringify(options.graphOverview, null, 2)}\n`,
    'utf8',
  );

  return artifacts;
}

function reviewCycleToolEvidence(sessionText: string): ReviewCycleToolEvidence {
  const messages = toolResultMessages(sessionText);
  const successfulReviewExchangeIds = new Set<string>();
  let presentReviewSetCount = 0;
  let structuralIllegalPresentReviewSetCount = 0;

  for (const message of messages) {
    if (message.toolName !== 'present_review_set') continue;
    presentReviewSetCount += 1;
    const details = isRecord(message.details) ? message.details : undefined;
    if (details?.status === 'structural_illegal') {
      structuralIllegalPresentReviewSetCount += 1;
      continue;
    }
    const parsed = zPresentReviewSetDetails.safeParse(details);
    if (parsed.success) successfulReviewExchangeIds.add(parsed.data.exchange_id);
  }

  const askTerminalCount = messages.filter((message) => {
    if (message.toolName !== 'ask') return false;
    const parsed = zRequestReviewDetails.safeParse(message.details);
    return (
      parsed.success &&
      parsed.data.tool_meta.prev === 'present_review_set' &&
      successfulReviewExchangeIds.has(parsed.data.exchange_id)
    );
  }).length;

  return {
    presentReviewSetCount,
    askTerminalCount,
    successfulPresentReviewSetCount: successfulReviewExchangeIds.size,
    structuralIllegalPresentReviewSetCount,
  };
}

function toolResultMessages(sessionText: string): Record<string, unknown>[] {
  const messages: Record<string, unknown>[] = [];
  for (const line of sessionText.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const entry = parseJson(trimmed);
    if (!isRecord(entry) || entry.type !== 'message') continue;
    const message = entry.message;
    if (!isRecord(message) || message.role !== 'toolResult') continue;
    messages.push(message);
  }
  return messages;
}

function pendingReviewSummary(
  response: JsonRpcResponse | undefined,
): ProjectGraphReviewCycleReport['pendingReview'] {
  if (!response || !('result' in response)) return { observed: false };
  const result = response.result as PendingExchangeResult;
  if (result.status !== 'pending' || !result.exchange || result.exchange.mode !== 'review') {
    return { observed: false };
  }
  const reviewSet = isRecord(result.exchange.reviewSet) ? result.exchange.reviewSet : undefined;
  return {
    observed: typeof result.exchange.exchangeId === 'string',
    ...(typeof result.exchange.exchangeId === 'string' ? { exchangeId: result.exchange.exchangeId } : {}),
    ...(Array.isArray(reviewSet?.nodes) ? { nodeDraftCount: reviewSet.nodes.length } : {}),
    ...(Array.isArray(reviewSet?.edges) ? { edgeDraftCount: reviewSet.edges.length } : {}),
  };
}

function approvalEvidence(response: JsonRpcResponse | undefined): ReviewCycleApprovalEvidence {
  if (!response) return { attempted: false };
  if ('error' in response) {
    return { attempted: true, status: 'rpc_error', error: response.error.message };
  }
  const result = response.result as SubmitExchangeResponseResult;
  const review = result.review;
  if (!review || typeof review.status !== 'string') {
    return { attempted: true, status: 'unexpected' };
  }
  if (
    review.status !== 'approved' &&
    review.status !== 'request_changes' &&
    review.status !== 'rejected' &&
    review.status !== 'structural_illegal'
  ) {
    return { attempted: true, status: 'unexpected' };
  }
  return {
    attempted: true,
    status: review.status,
    ...(typeof review.lsn === 'number' ? { lsn: review.lsn } : {}),
    ...(isRecord(review.createdNodes) ? { createdNodeRefs: review.createdNodes } : {}),
    ...(isRecordArray(review.diagnostics) ? { diagnostics: review.diagnostics } : {}),
  };
}

function pendingReviewFromResponse(response: JsonRpcResponse): { exchangeId: string } | undefined {
  const summary = pendingReviewSummary(response);
  return summary.observed && summary.exchangeId ? { exchangeId: summary.exchangeId } : undefined;
}

async function readSeedFixture(path: string): Promise<SeedFixture> {
  return JSON.parse(await readFile(path, 'utf8')) as SeedFixture;
}

async function selectSpecForSetupSession(cwd: string, specId: number): Promise<void> {
  const path = join(cwd, '.brunch', 'workspace.json');
  const state = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
  await writeFile(
    path,
    `${JSON.stringify(
      {
        ...state,
        current: { specId, sessionId: '' },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

function defaultProjectGraphPrompt(): string {
  return `Brunch FE-809 project-graph proof. The selected spec is seeded from "${DEFAULT_SEED_REF}" and already has explicit intent-plane graph truth.

Use read_graph in overview mode to inspect existing node codes. Then use present_review_set exactly once to propose a small exact review set derived from the existing macro-view intent graph.

Proposal constraints:
- Create one or two new intent-plane requirement or criterion nodes.
- Include at least one edge using category "rationale" with stance "for" or category "realization".
- When referencing existing graph truth, use existingCode strings from read_graph output, never raw ids.
- Use schemaVersion 1, lens "intent", epistemicStatus "inferred", non-empty grounding.summary, grounding.support, pitch.title, and pitch.narrative.
- Do not call mutate_graph directly.
- Do not call ask; stop after a successful present_review_set so the external Brunch RPC reviewer can approve it.`;
}

function defaultRunId(): string {
  return new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isRecord);
}

function parseCliArgs(argv: readonly string[]): ProjectGraphReviewCycleProofOptions {
  const options: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg !== undefined && arg.startsWith('--')) {
      options[arg.slice(2)] = requiredValue(argv, (index += 1), arg);
    }
  }
  return {
    ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
    ...(options['fixture-root'] !== undefined ? { fixtureRoot: options['fixture-root'] } : {}),
    ...(options['seed-name'] !== undefined ? { seedName: options['seed-name'] } : {}),
    ...(options['seed-variant'] !== undefined ? { seedVariant: options['seed-variant'] } : {}),
    ...(options['run-id'] !== undefined ? { runId: options['run-id'] } : {}),
    ...(options.prompt !== undefined ? { prompt: options.prompt } : {}),
    ...(options['agent-dir'] !== undefined ? { agentDir: options['agent-dir'] } : {}),
    ...(options['review-set-expectation'] !== undefined
      ? { reviewSetExpectation: parseReviewSetExpectation(options['review-set-expectation']) }
      : {}),
  };
}

function parseReviewSetExpectation(value: string): ReviewSetExpectation {
  if (value === 'scope_handoff') return value;
  throw new Error(`Unknown review-set expectation: ${value}`);
}

function requiredValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index];
  if (value === undefined) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

async function main(): Promise<void> {
  const report = await runProjectGraphReviewCycleProof(parseCliArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.success ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

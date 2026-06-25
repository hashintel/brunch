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
import { openWorkspaceGraphRuntime, type GraphNode, type GraphSlice } from '../graph/index.js';
import { formatGraphNodeCode } from '../graph/schema/nodes.js';
import { seedFixture, type SeedFixture } from '../graph/seed-fixtures.js';
import { createRpcHandlers } from '../rpc/handlers.js';
import { createProductUpdatePublisher, type ProductUpdate } from '../rpc/product-updates.js';
import type { JsonRpcResponse } from '../rpc/protocol.js';
import { createWorkspaceSessionCoordinator } from '../session/workspace-session-coordinator.js';
import { assertPortableRunId, portableCwd } from './portable-report.js';

const PROBE_ID = 'project-graph-review-cycle' as const;
const DEFAULT_SEED_SET = 'bilal-port-variants';
const DEFAULT_SEED_SLUG = 'macro-view-grounded-intent';

interface ProjectGraphReviewRuntimeStateReport {
  readonly operationalMode: 'elicit';
  readonly agentStrategy: 'step-wise-disambiguate';
  readonly agentLens: 'intent';
}

interface ProjectGraphReviewCycleProofOptions {
  readonly cwd?: string;
  readonly fixtureRoot?: string;
  readonly seedSet?: string;
  readonly seedSlug?: string;
  readonly runId?: string;
  readonly prompt?: string;
  readonly agentDir?: string;
}

export interface ProjectGraphReviewCycleArtifacts {
  readonly runDir: string;
  readonly sessionJsonl: string;
  readonly reportJson: string;
  readonly graphOverviewJson: string;
}

interface ReviewCycleToolEvidence {
  readonly presentReviewSetCount: number;
  readonly requestResponseCount: number;
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
  readonly seedSet: string;
  readonly seedSlug: string;
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
  readonly productUpdates: readonly ProductUpdate[];
  readonly friction: readonly string[];
  readonly artifacts?: ProjectGraphReviewCycleArtifacts;
}

export interface ProjectGraphReviewCycleSummaryInput {
  readonly runId: string;
  readonly generatedAt: string;
  readonly cwd: string;
  readonly seedSet?: string;
  readonly seedSlug: string;
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
  const seedSet = options.seedSet ?? DEFAULT_SEED_SET;
  const seedSlug = options.seedSlug ?? DEFAULT_SEED_SLUG;
  const runId = assertPortableRunId(options.runId ?? defaultRunId());
  const prompt = options.prompt ?? defaultProjectGraphPrompt();
  const generatedAt = new Date().toISOString();
  const fixture = await readSeedFixture(join(fixtureRoot, 'seeds', seedSet, `${seedSlug}.json`));
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
    operationalMode: 'elicit',
    agentStrategy: 'step-wise-disambiguate',
    agentLens: 'intent',
  };
  const runtimeStateReport: ProjectGraphReviewRuntimeStateReport = {
    operationalMode: 'elicit',
    agentStrategy: 'step-wise-disambiguate',
    agentLens: 'intent',
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
    let report = summarizeProjectGraphReviewCycleProof({
      runId,
      generatedAt,
      cwd,
      seedSet,
      seedSlug,
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

  const success =
    toolEvidence.successfulPresentReviewSetCount > 0 &&
    pendingReview.observed &&
    approval.status === 'approved' &&
    graphDelta.lsnAdvanced &&
    graphDelta.nodeDelta > 0 &&
    createdNodes.length > 0;

  return {
    schemaVersion: 1,
    probeId: PROBE_ID,
    runId: input.runId,
    generatedAt: input.generatedAt,
    mission:
      'Prove the project-graph capability path can present an exact review set and approve it through public RPC.',
    evaluationFocus:
      'FE-809 real agent proposal → present_review_set → session.submitExchangeResponse approval → explicit graph readback.',
    seedSet: input.seedSet ?? DEFAULT_SEED_SET,
    seedSlug: input.seedSlug,
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
    productUpdates: input.productUpdates ?? [],
    friction,
  };
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
  let presentReviewSetCount = 0;
  let requestResponseCount = 0;
  let successfulPresentReviewSetCount = 0;
  let structuralIllegalPresentReviewSetCount = 0;

  for (const message of toolResultMessages(sessionText)) {
    if (message.toolName === 'present_review_set') {
      presentReviewSetCount += 1;
      const details = isRecord(message.details) ? message.details : undefined;
      if (details?.status === 'structural_illegal') {
        structuralIllegalPresentReviewSetCount += 1;
      } else if (details?.schema === 'brunch.structured_exchange.present' && 'review_set' in details) {
        successfulPresentReviewSetCount += 1;
      }
    }
    if (message.toolName === 'request_response') {
      requestResponseCount += 1;
    }
  }

  return {
    presentReviewSetCount,
    requestResponseCount,
    successfulPresentReviewSetCount,
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
  return `Brunch FE-809 project-graph proof. The selected spec is seeded from "${DEFAULT_SEED_SLUG}" and already has explicit intent-plane graph truth.

Use read_graph in overview mode to inspect existing node codes. Then use present_review_set exactly once to propose a small exact review set derived from the existing macro-view intent graph.

Proposal constraints:
- Create one or two new intent-plane requirement or criterion nodes.
- Include at least one edge using category "rationale" with stance "for" or category "realization".
- When referencing existing graph truth, use existingCode strings from read_graph output, never raw ids.
- Use schemaVersion 1, lens "intent", epistemicStatus "inferred", non-empty grounding.summary, grounding.support, pitch.title, and pitch.narrative.
- Do not call mutate_graph directly.
- Do not call request_response; stop after a successful present_review_set so the external Brunch RPC reviewer can approve it.`;
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
    ...(options['seed-set'] !== undefined ? { seedSet: options['seed-set'] } : {}),
    ...(options['seed-slug'] !== undefined ? { seedSlug: options['seed-slug'] } : {}),
    ...(options['run-id'] !== undefined ? { runId: options['run-id'] } : {}),
    ...(options.prompt !== undefined ? { prompt: options.prompt } : {}),
    ...(options['agent-dir'] !== undefined ? { agentDir: options['agent-dir'] } : {}),
  };
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

import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import type { GraphSlice } from '../graph/queries.js';
import { formatGraphNodeCode } from '../graph/schema/nodes.js';
import { createRpcHandlers } from '../rpc/handlers.js';
import { createProductUpdatePublisher, type ProductUpdate } from '../rpc/product-updates.js';
import { renderSessionTranscript } from '../session/session-transcript.js';
import { createWorkspaceSessionCoordinator } from '../session/workspace-session-coordinator.js';
import { mintDeterministicExchangeIntoSessionFile } from './deterministic-exchange-script.js';
import { assertPortableRunId, portableCwd } from './portable-report.js';

interface JsonRpcSuccess<T> {
  readonly jsonrpc: '2.0';
  readonly id: number;
  readonly result: T;
}

interface SubmitResponseResult {
  readonly status: 'accepted';
  readonly exchangeId: string;
  readonly capture: CaptureOutcome;
}

interface CaptureOutcome {
  readonly status: 'captured';
  readonly lsn: number;
  readonly nodeCount: number;
  readonly createdNodes: Record<string, { readonly id: number; readonly code: string }>;
}

interface CaptureResponseToGraphProofArtifacts {
  readonly runDir: string;
  readonly sessionJsonl: string;
  readonly transcriptMarkdown: string;
  readonly reportJson: string;
}

export interface CaptureResponseToGraphProofOptions {
  readonly fixtureRoot?: string;
  readonly runId?: string;
}

export interface CaptureResponseToGraphProofReport {
  readonly schemaVersion: 1;
  readonly probeId: 'capture-response-to-graph';
  readonly runId: string;
  readonly generatedAt: string;
  readonly mission: string;
  readonly evaluationFocus: string;
  readonly cwd: string;
  readonly specId: number;
  readonly sessionId: string;
  readonly exchangeId: string;
  readonly capture: CaptureOutcome;
  readonly graph: {
    readonly nodeCount: number;
    readonly edgeCount: number;
    readonly lsn: number;
    readonly codes: readonly string[];
    readonly titles: readonly string[];
  };
  readonly updates: readonly ProductUpdate[];
  readonly friction: readonly string[];
  readonly artifacts?: CaptureResponseToGraphProofArtifacts;
}

const CAPTURE_TEXT = [
  'Goal: Help product teams turn elicitation answers into graph truth.',
  'Context: Designers will observe the graph from a web UI.',
  'Constraint: Use the selected session binding, not workspace defaults.',
  'Criterion: The selected spec overview shows projected graph codes.',
].join('\n');

export async function runCaptureResponseToGraphProof(
  options: CaptureResponseToGraphProofOptions = {},
): Promise<CaptureResponseToGraphProofReport> {
  const runId = assertPortableRunId(
    options.runId ??
      new Date()
        .toISOString()
        .replaceAll(':', '-')
        .replace(/\.\d{3}Z$/, 'Z'),
  );
  const generatedAt = new Date().toISOString();
  const cwd = await mkdtemp(join(tmpdir(), 'brunch-capture-response-'));
  const coordinator = createWorkspaceSessionCoordinator({ cwd });
  const productUpdates = createProductUpdatePublisher();
  const updates: ProductUpdate[] = [];
  productUpdates.subscribe((batch) => updates.push(...batch));
  const handlers = createRpcHandlers({ coordinator, cwd, productUpdates });
  const friction: string[] = [];

  await handlers.handle({
    jsonrpc: '2.0',
    id: 1,
    method: 'workspace.activate',
    params: { decision: { action: 'newSpec', title: 'Capture response proof spec' } },
  });
  const workspace = await coordinator.openDefaultWorkspace();
  if (workspace.status !== 'ready')
    throw new Error('workspace.activate(newSpec) did not create a ready workspace');

  // D78-L/D49-L revised 2026-06-12: the probe mints the deterministic present
  // pairs as fixture setup (the product no longer fabricates exchanges) and
  // drives responses + readback through the public RPC surface.
  const first = mintDeterministicExchangeIntoSessionFile(workspace.session.file, 0);
  await handlers.handle({
    jsonrpc: '2.0',
    id: 3,
    method: 'session.submitExchangeResponse',
    params: { exchangeId: first.exchangeId, answer: { optionId: 'new-from-scratch' } },
  });

  const textExchange = mintDeterministicExchangeIntoSessionFile(workspace.session.file, 1);
  if (textExchange.mode !== 'text') {
    throw new Error(`Expected deterministic text exchange, got ${textExchange.mode}`);
  }

  const submitted = success<SubmitResponseResult>(
    await handlers.handle({
      jsonrpc: '2.0',
      id: 5,
      method: 'session.submitExchangeResponse',
      params: {
        exchangeId: textExchange.exchangeId,
        answer: { text: CAPTURE_TEXT },
      },
    }),
  );
  if (submitted.capture.status !== 'captured') {
    throw new Error(`Expected capture success, got ${JSON.stringify(submitted.capture)}`);
  }

  const overview = success<GraphSlice>(
    await handlers.handle({
      jsonrpc: '2.0',
      id: 6,
      method: 'graph.overview',
      params: { specId: workspace.spec.id },
    }),
  );
  if (overview.nodes.length !== submitted.capture.nodeCount) {
    friction.push(
      `Overview node count ${overview.nodes.length} did not match capture count ${submitted.capture.nodeCount}.`,
    );
  }

  const orderedNodes = [...overview.nodes].sort(
    (left, right) => captureKindOrder(left.kind) - captureKindOrder(right.kind),
  );

  const graph = {
    nodeCount: overview.nodes.length,
    edgeCount: overview.edges.length,
    lsn: overview.lsn,
    codes: orderedNodes.map((node) => formatGraphNodeCode(node.kind, node.kindOrdinal)),
    titles: orderedNodes.map((node) => node.title),
  };

  const sessionJsonl = await readFile(workspace.session.file, 'utf8');
  const transcriptMarkdown = renderSessionTranscript(sessionJsonl, { title: 'session.jsonl' });

  const reportWithoutArtifacts = {
    schemaVersion: 1 as const,
    probeId: 'capture-response-to-graph' as const,
    runId,
    generatedAt,
    mission:
      'Drive a transcript-native structured text answer through public RPC capture into selected-spec graph truth.',
    evaluationFocus:
      'Public RPC activation/trigger/submit/overview path, explicit-basis capture outcome, graph counts/codes, LSN, transcript evidence, and observer invalidations.',
    cwd,
    specId: workspace.spec.id,
    sessionId: workspace.session.id,
    exchangeId: textExchange.exchangeId,
    capture: submitted.capture,
    graph,
    updates,
    friction,
  };

  if (options.fixtureRoot === undefined) return reportWithoutArtifacts;
  const fixtureRoot = options.fixtureRoot;

  // Persisted artifact references are fixture-root-relative so committed
  // reports stay portable; disk paths are resolved against the fixture root.
  assertPortableRunId(runId);
  const runDirRef = `runs/capture-response-to-graph/${runId}`;
  const diskPath = (ref: string) => resolve(fixtureRoot, ref);
  const artifacts = {
    runDir: runDirRef,
    sessionJsonl: `${runDirRef}/session.jsonl`,
    transcriptMarkdown: `${runDirRef}/transcript.md`,
    reportJson: `${runDirRef}/report.json`,
  };
  const report = { ...reportWithoutArtifacts, artifacts };
  await mkdir(diskPath(artifacts.runDir), { recursive: true });
  await writeFile(diskPath(artifacts.sessionJsonl), sessionJsonl);
  await writeFile(diskPath(artifacts.transcriptMarkdown), transcriptMarkdown);
  const persistedReport = { ...report, cwd: portableCwd(report.cwd) };
  await writeFile(diskPath(artifacts.reportJson), `${JSON.stringify(persistedReport, null, 2)}\n`);
  return report;
}

function success<T>(response: unknown): T {
  if (typeof response === 'object' && response !== null && 'result' in response) {
    return (response as JsonRpcSuccess<T>).result;
  }
  throw new Error(`Expected JSON-RPC success response: ${JSON.stringify(response)}`);
}

function captureKindOrder(kind: string): number {
  if (kind === 'goal') return 0;
  if (kind === 'context') return 1;
  if (kind === 'constraint') return 2;
  if (kind === 'criterion') return 3;
  return 4;
}

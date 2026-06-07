import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { formatGraphNodeCode } from '../graph/schema/nodes.js';
import type { GraphOverview } from '../graph/snapshot.js';
import { createRpcHandlers } from '../rpc/handlers.js';
import { createProductUpdatePublisher, type ProductUpdate } from '../rpc/product-updates.js';
import { renderSessionTranscript } from '../session/session-transcript.js';
import { createWorkspaceSessionCoordinator } from '../session/workspace-session-coordinator.js';
import { portableCwd } from './portable-report.js';

interface JsonRpcSuccess<T> {
  readonly jsonrpc: '2.0';
  readonly id: number;
  readonly result: T;
}

interface SubmitMessageResult {
  readonly status: 'accepted';
  readonly messageId: string;
  readonly capture: CaptureOutcome;
}

interface CaptureOutcome {
  readonly status: 'captured';
  readonly lsn: number;
  readonly nodeCount: number;
  readonly createdNodes: Record<string, { readonly id: number; readonly code: string }>;
}

export interface SubmitMessageCaptureProofArtifacts {
  readonly runDir: string;
  readonly sessionJsonl: string;
  readonly transcriptMarkdown: string;
  readonly reportJson: string;
}

export interface SubmitMessageCaptureProofOptions {
  readonly fixtureRoot?: string;
  readonly runId?: string;
}

export interface SubmitMessageCaptureProofReport {
  readonly schemaVersion: 1;
  readonly probeId: 'submit-message-capture';
  readonly runId: string;
  readonly generatedAt: string;
  readonly mission: string;
  readonly evaluationFocus: string;
  readonly cwd: string;
  readonly specId: number;
  readonly sessionId: string;
  readonly messageId: string;
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
  readonly artifacts?: SubmitMessageCaptureProofArtifacts;
}

const CAPTURE_TEXT = [
  'Goal: Keep ordinary user messages on the same capture path.',
  'Context: This message arrives outside a structured exchange.',
  'Constraint: The selected session binding still owns the graph target.',
  'Criterion: Observers see selected-spec graph invalidations after capture.',
].join('\n');

export async function runSubmitMessageCaptureProof(
  options: SubmitMessageCaptureProofOptions = {},
): Promise<SubmitMessageCaptureProofReport> {
  const runId =
    options.runId ??
    new Date()
      .toISOString()
      .replaceAll(':', '-')
      .replace(/\.\d{3}Z$/, 'Z');
  const generatedAt = new Date().toISOString();
  const cwd = await mkdtemp(join(tmpdir(), 'brunch-submit-message-'));
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
    params: { decision: { action: 'newSpec', title: 'Submit message proof spec' } },
  });
  const workspace = await coordinator.openDefaultWorkspace();
  if (workspace.status !== 'ready') {
    throw new Error('workspace.activate(newSpec) did not create a ready workspace');
  }

  const submitted = success<SubmitMessageResult>(
    await handlers.handle({
      jsonrpc: '2.0',
      id: 2,
      method: 'session.submitMessage',
      params: { text: CAPTURE_TEXT },
    }),
  );
  if (submitted.capture.status !== 'captured') {
    throw new Error(`Expected capture success, got ${JSON.stringify(submitted.capture)}`);
  }

  const overview = success<GraphOverview>(
    await handlers.handle({
      jsonrpc: '2.0',
      id: 3,
      method: 'graph.overview',
      params: { specId: workspace.spec.id },
    }),
  );
  if (overview.nodeCount !== submitted.capture.nodeCount) {
    friction.push(
      `Overview node count ${overview.nodeCount} did not match capture count ${submitted.capture.nodeCount}.`,
    );
  }

  const orderedNodes = [...overview.nodes].sort(
    (left, right) => captureKindOrder(left.kind) - captureKindOrder(right.kind),
  );

  const graph = {
    nodeCount: overview.nodeCount,
    edgeCount: overview.edgeCount,
    lsn: overview.lsn,
    codes: orderedNodes.map((node) => formatGraphNodeCode(node.kind, node.kindOrdinal)),
    titles: orderedNodes.map((node) => node.title),
  };

  const sessionJsonl = await readFile(workspace.session.file, 'utf8');
  const transcriptMarkdown = renderSessionTranscript(sessionJsonl, { title: 'session.jsonl' });

  const reportWithoutArtifacts = {
    schemaVersion: 1 as const,
    probeId: 'submit-message-capture' as const,
    runId,
    generatedAt,
    mission: 'Drive an ordinary user message through public RPC capture into selected-spec graph truth.',
    evaluationFocus:
      'Public RPC submitMessage/graph.overview path, explicit-basis capture outcome, graph counts/codes, transcript evidence, and observer invalidations.',
    cwd,
    specId: workspace.spec.id,
    sessionId: workspace.session.id,
    messageId: submitted.messageId,
    capture: submitted.capture,
    graph,
    updates,
    friction,
  };

  if (options.fixtureRoot === undefined) return reportWithoutArtifacts;
  const runDirRef = `runs/submit-message-capture/${runId}`;
  const diskPath = (ref: string) => resolve(options.fixtureRoot!, ref);
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

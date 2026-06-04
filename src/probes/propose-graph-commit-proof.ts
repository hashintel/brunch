import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { getAgentDir } from '@earendil-works/pi-coding-agent';

import { appendBrunchAgentRuntimeSwitch, type BrunchAgentState } from '../.pi/extensions/operational-mode.js';
import { createBrunchAgentSessionRuntimeFactory } from '../brunch-tui.js';
import {
  openWorkspaceGraphRuntime,
  type CommitGraphSuccess,
  type Diagnostic,
  type StructuralIllegal,
} from '../graph/index.js';
import { formatGraphNodeCode } from '../graph/schema/nodes.js';
import type { GraphOverview } from '../graph/snapshot.js';
import { renderSessionTranscript } from '../session/session-transcript.js';
import { createWorkspaceSessionCoordinator } from '../session/workspace-session-coordinator.js';

const PROBE_ID = 'propose-graph-commit' as const;
const DEFAULT_MAX_ATTEMPTS = 2;

export type ProposeGraphCommitScenarioId = 'direct-commit' | 'existing-code-ref' | 'retry-diagnostics';

export interface ProposeGraphCommitProofOptions {
  cwd?: string;
  fixtureRoot?: string;
  runId?: string;
  maxAttempts?: number;
  prompt?: string;
  agentDir?: string;
  scenarioId?: ProposeGraphCommitScenarioId;
}

export interface ProposeGraphCommitProofArtifacts {
  runDir: string;
  sessionJsonl: string;
  transcriptMarkdown: string;
  reportJson: string;
}

export type CommitGraphAttemptStatus =
  | CommitGraphSuccess['status']
  | StructuralIllegal['status']
  | 'needs_human'
  | 'policy_blocked'
  | 'version_conflict'
  | 'unknown';

export interface CommitGraphAttemptReport {
  index: number;
  status: CommitGraphAttemptStatus;
  lsn?: number;
  nodeRefs?: Record<string, number>;
  edgeIds?: number[];
  diagnostics?: Diagnostic[];
  content?: string;
}

export interface ProposeGraphCommitProofReport {
  schemaVersion: 1;
  probeId: typeof PROBE_ID;
  runId: string;
  generatedAt: string;
  mission: string;
  evaluationFocus: string;
  scenarioId: ProposeGraphCommitScenarioId;
  success: boolean;
  cwd: string;
  specId: number;
  sessionId: string;
  prompt: string;
  model?: string;
  maxAttempts: number;
  attemptCount: number;
  retryCount: number;
  firstAttemptStatus: CommitGraphAttemptStatus | 'not_called';
  finalStatus: CommitGraphAttemptStatus | 'not_called';
  attempts: CommitGraphAttemptReport[];
  finalGraph: {
    nodeCount: number;
    edgeCount: number;
    lsn: number;
  };
  committedNodeTitles: string[];
  committedNodes: Array<{ code: string; title: string }>;
  projectedCodeEvidence: {
    codes: string[];
    seenInTranscript: boolean;
    usedInCommitParams: boolean;
    existingCodeEdgePresent?: boolean;
  };
  friction: string[];
  artifacts?: ProposeGraphCommitProofArtifacts;
}

export interface ProposeGraphCommitProofSummaryInput {
  runId: string;
  generatedAt: string;
  cwd: string;
  specId: number;
  sessionId: string;
  maxAttempts: number;
  sessionText: string;
  overview: GraphOverview;
  prompt: string;
  model?: string;
  scenarioId?: ProposeGraphCommitScenarioId;
  expectedExistingCode?: string;
  friction?: readonly string[];
}

export async function runProposeGraphCommitProof(
  options: ProposeGraphCommitProofOptions = {},
): Promise<ProposeGraphCommitProofReport> {
  const cwd = options.cwd ?? (await mkdtemp(join(tmpdir(), 'brunch-propose-graph-commit-')));
  const runId = options.runId ?? defaultRunId();
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const scenarioId = options.scenarioId ?? 'direct-commit';
  const prompt = options.prompt ?? defaultProofPrompt(scenarioId);
  const generatedAt = new Date().toISOString();
  const coordinator = createWorkspaceSessionCoordinator({ cwd });
  const workspace = await coordinator.createSetupSession({
    specTitle: 'A14 propose-graph commit proof',
    createNewSpec: true,
  });
  const runtimeState: BrunchAgentState = {
    schemaVersion: 1,
    operationalMode: 'elicit',
    agentStrategy: 'propose-graph',
    agentLens: 'intent',
    agentGoal: 'commit-converge',
  };
  appendBrunchAgentRuntimeSwitch(workspace.session.manager, runtimeState, 'extension');
  const graph = await openWorkspaceGraphRuntime(cwd);
  const gradeResult = graph.commandExecutor.updateReadinessGrade({
    specId: workspace.spec.id,
    readinessGrade: 'elicitation_ready',
  });
  if (gradeResult.status !== 'success') {
    throw new Error('failed to advance probe spec to elicitation_ready');
  }
  const expectedExistingCode = seedScenarioGraph(graph, workspace.spec.id, scenarioId);
  const specSnapshots = graph.forSpec(workspace.spec.id);
  const agentDir = options.agentDir ?? getAgentDir();
  const createRuntime = createBrunchAgentSessionRuntimeFactory({ workspace, coordinator });
  const created = await createRuntime({
    cwd,
    agentDir,
    sessionManager: workspace.session.manager,
  });
  const session = created.session;
  const friction = created.diagnostics.map((diagnostic) => `${diagnostic.type}: ${diagnostic.message}`);

  try {
    await session.sendUserMessage(prompt);
    await session.agent.waitForIdle();

    let report = await summarizeCurrentRun({
      runId,
      generatedAt,
      cwd,
      specId: workspace.spec.id,
      sessionId: workspace.session.id,
      maxAttempts,
      sessionFile: workspace.session.file,
      overview: specSnapshots.getGraphOverview(),
      prompt,
      scenarioId,
      ...(expectedExistingCode !== undefined ? { expectedExistingCode } : {}),
      ...(session.model?.id !== undefined ? { model: session.model.id } : {}),
      friction,
    });

    if (shouldRetry(report)) {
      await session.sendUserMessage(retryPrompt(report.attempts.at(-1)?.diagnostics ?? []));
      await session.agent.waitForIdle();
      report = await summarizeCurrentRun({
        runId,
        generatedAt,
        cwd,
        specId: workspace.spec.id,
        sessionId: workspace.session.id,
        maxAttempts,
        sessionFile: workspace.session.file,
        overview: specSnapshots.getGraphOverview(),
        prompt,
        scenarioId,
        ...(expectedExistingCode !== undefined ? { expectedExistingCode } : {}),
        ...(session.model?.id !== undefined ? { model: session.model.id } : {}),
        friction,
      });
    }

    if (options.fixtureRoot !== undefined) {
      const sessionText = await readFile(workspace.session.file, 'utf8');
      report.artifacts = await writeProposeGraphCommitProofArtifacts({
        fixtureRoot: options.fixtureRoot,
        runId,
        sessionText,
        report,
      });
    }

    return report;
  } finally {
    session.dispose();
  }
}

async function summarizeCurrentRun(options: {
  runId: string;
  generatedAt: string;
  cwd: string;
  specId: number;
  sessionId: string;
  maxAttempts: number;
  sessionFile: string;
  overview: GraphOverview;
  prompt: string;
  model?: string;
  scenarioId?: ProposeGraphCommitScenarioId;
  expectedExistingCode?: string;
  friction: readonly string[];
}): Promise<ProposeGraphCommitProofReport> {
  return summarizeProposeGraphCommitProof({
    runId: options.runId,
    generatedAt: options.generatedAt,
    cwd: options.cwd,
    specId: options.specId,
    sessionId: options.sessionId,
    maxAttempts: options.maxAttempts,
    sessionText: await readFile(options.sessionFile, 'utf8'),
    overview: options.overview,
    prompt: options.prompt,
    ...(options.scenarioId !== undefined ? { scenarioId: options.scenarioId } : {}),
    ...(options.expectedExistingCode !== undefined
      ? { expectedExistingCode: options.expectedExistingCode }
      : {}),
    ...(options.model !== undefined ? { model: options.model } : {}),
    friction: options.friction,
  });
}

function shouldRetry(report: ProposeGraphCommitProofReport): boolean {
  return (
    !report.success && report.finalStatus === 'structural_illegal' && report.attemptCount < report.maxAttempts
  );
}

export function summarizeProposeGraphCommitProof(
  input: ProposeGraphCommitProofSummaryInput,
): ProposeGraphCommitProofReport {
  const attempts = commitGraphAttemptsFromSession(input.sessionText);
  const firstAttemptStatus = attempts[0]?.status ?? 'not_called';
  const finalStatus = attempts.at(-1)?.status ?? 'not_called';
  const successfulAttempt = lastSuccessfulAttempt(attempts);
  const scenarioId = input.scenarioId ?? 'direct-commit';
  const finalGraph = {
    nodeCount: input.overview.nodeCount,
    edgeCount: input.overview.edgeCount,
    lsn: input.overview.lsn,
  };
  const committedNodes = input.overview.nodes.map((node) => ({
    code: formatGraphNodeCode(node.kind, node.kindOrdinal),
    title: node.title,
  }));
  const committedNodeTitles = committedNodes.map((node) => node.title);
  const projectedCodeEvidence = projectedCodeEvidenceFromSummaryInput(input);
  const friction = [...(input.friction ?? [])];
  let success = successfulAttempt !== undefined && input.overview.nodeCount > 0;
  if (scenarioId === 'existing-code-ref') {
    success =
      success &&
      projectedCodeEvidence.seenInTranscript &&
      projectedCodeEvidence.usedInCommitParams &&
      projectedCodeEvidence.existingCodeEdgePresent === true;
  }
  if (scenarioId === 'retry-diagnostics') {
    success =
      attempts.some((attempt) => attempt.status === 'structural_illegal') &&
      successfulAttempt !== undefined &&
      input.overview.nodeCount > 0;
  }

  if (attempts.length === 0) {
    friction.push('No commit_graph tool result was recorded.');
  }
  if (attempts.length > input.maxAttempts) {
    friction.push(`commit_graph attempts exceeded maxAttempts=${input.maxAttempts}.`);
  }
  if (successfulAttempt === undefined && attempts.length > 0) {
    friction.push(`No commit_graph attempt succeeded; final status was ${finalStatus}.`);
  }
  if (successfulAttempt !== undefined && input.overview.nodeCount === 0) {
    friction.push('commit_graph reported success but graph overview is empty.');
  }
  if (scenarioId === 'existing-code-ref') {
    if (!projectedCodeEvidence.seenInTranscript) {
      friction.push(
        `Expected projected code ${input.expectedExistingCode ?? '<unknown>'} was not visible in the transcript.`,
      );
    }
    if (!projectedCodeEvidence.usedInCommitParams) {
      friction.push(
        `No commit_graph call used expected existingCode ${input.expectedExistingCode ?? '<unknown>'}.`,
      );
    }
    if (projectedCodeEvidence.existingCodeEdgePresent !== true) {
      friction.push(
        `Final graph does not contain an edge incident to expected existing code ${input.expectedExistingCode ?? '<unknown>'}.`,
      );
    }
  }

  return {
    schemaVersion: 1,
    probeId: PROBE_ID,
    runId: input.runId,
    generatedAt: input.generatedAt,
    mission: 'Prove the propose-graph strategy can commit graph truth through commit_graph.',
    evaluationFocus:
      scenarioId === 'existing-code-ref'
        ? 'A14-L selected-spec projected-code reference through the default runtime.'
        : scenarioId === 'retry-diagnostics'
          ? 'A14-L retry behavior after structured commit_graph diagnostics.'
          : 'A14-L structural legality for direct commitGraph batches.',
    scenarioId,
    success,
    cwd: input.cwd,
    specId: input.specId,
    sessionId: input.sessionId,
    prompt: input.prompt,
    ...(input.model !== undefined ? { model: input.model } : {}),
    maxAttempts: input.maxAttempts,
    attemptCount: attempts.length,
    retryCount:
      successfulAttempt === undefined
        ? Math.max(0, attempts.length - 1)
        : attempts.indexOf(successfulAttempt),
    firstAttemptStatus,
    finalStatus,
    attempts,
    finalGraph,
    committedNodeTitles,
    committedNodes,
    projectedCodeEvidence,
    friction,
  };
}

function projectedCodeEvidenceFromSummaryInput(
  input: ProposeGraphCommitProofSummaryInput,
): ProposeGraphCommitProofReport['projectedCodeEvidence'] {
  const expectedCode = input.expectedExistingCode;
  const nodeById = new Map(
    input.overview.nodes.map((node) => [node.id, formatGraphNodeCode(node.kind, node.kindOrdinal)]),
  );
  const codes = [
    ...new Set([...nodeById.values()].filter((code) => expectedCode === undefined || code === expectedCode)),
  ];
  const seenInTranscript = expectedCode === undefined || input.sessionText.includes(expectedCode);
  const usedInCommitParams =
    expectedCode === undefined ||
    input.sessionText.includes(`"existingCode":"${expectedCode}"`) ||
    input.sessionText.includes(`"existingCode": "${expectedCode}"`) ||
    input.sessionText.includes(`\\"existingCode\\":\\"${expectedCode}\\"`) ||
    input.sessionText.includes(`\\"existingCode\\": \\"${expectedCode}\\"`);
  const existingNodeIds = new Set(
    input.overview.nodes
      .filter(
        (node) =>
          expectedCode === undefined || formatGraphNodeCode(node.kind, node.kindOrdinal) === expectedCode,
      )
      .map((node) => node.id),
  );
  const existingCodeEdgePresent =
    expectedCode === undefined
      ? undefined
      : input.overview.edges.some(
          (edge) => existingNodeIds.has(edge.sourceId) || existingNodeIds.has(edge.targetId),
        );
  return {
    codes,
    seenInTranscript,
    usedInCommitParams,
    ...(existingCodeEdgePresent !== undefined ? { existingCodeEdgePresent } : {}),
  };
}

function lastSuccessfulAttempt(
  attempts: readonly CommitGraphAttemptReport[],
): CommitGraphAttemptReport | undefined {
  for (let index = attempts.length - 1; index >= 0; index -= 1) {
    const attempt = attempts[index];
    if (attempt?.status === 'success') return attempt;
  }
  return undefined;
}

function commitGraphAttemptsFromSession(sessionText: string): CommitGraphAttemptReport[] {
  const attempts: CommitGraphAttemptReport[] = [];
  for (const line of sessionText.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const entry = parseJson(trimmed);
    if (!isRecord(entry) || entry.type !== 'message') continue;

    const message = entry.message;
    if (!isRecord(message) || message.role !== 'toolResult' || message.toolName !== 'commit_graph') {
      continue;
    }
    attempts.push(commitGraphAttemptFromMessage(attempts.length + 1, message));
  }
  return attempts;
}

function commitGraphAttemptFromMessage(
  index: number,
  message: Record<string, unknown>,
): CommitGraphAttemptReport {
  const details = isRecord(message.details) ? message.details : undefined;
  const status = commitGraphStatus(details?.status);
  return {
    index,
    status,
    ...(typeof details?.lsn === 'number' ? { lsn: details.lsn } : {}),
    ...(isCreatedNodeRecord(details?.createdNodes)
      ? { nodeRefs: mapCreatedNodeIds(details.createdNodes) }
      : {}),
    ...(isNumberArray(details?.edges) ? { edgeIds: details.edges } : {}),
    ...(isDiagnosticArray(details?.diagnostics) ? { diagnostics: details.diagnostics } : {}),
    ...textContent(message.content),
  };
}

function commitGraphStatus(value: unknown): CommitGraphAttemptStatus {
  if (
    value === 'success' ||
    value === 'structural_illegal' ||
    value === 'needs_human' ||
    value === 'policy_blocked' ||
    value === 'version_conflict'
  ) {
    return value;
  }
  return 'unknown';
}

function isDiagnosticArray(value: unknown): value is Diagnostic[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) => isRecord(item) && typeof item.field === 'string' && typeof item.message === 'string',
    )
  );
}

function isCreatedNodeRecord(value: unknown): value is Record<string, { id: number }> {
  return (
    isRecord(value) && Object.values(value).every((entry) => isRecord(entry) && typeof entry.id === 'number')
  );
}

function mapCreatedNodeIds(value: Record<string, { id: number }>): Record<string, number> {
  return Object.fromEntries(Object.entries(value).map(([ref, node]) => [ref, node.id]));
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((entry): entry is number => typeof entry === 'number');
}

function textContent(value: unknown): { content?: string } {
  if (typeof value === 'string') return { content: value };
  if (!Array.isArray(value)) return {};
  const text = value
    .flatMap((item) => (isRecord(item) && typeof item.text === 'string' ? [item.text] : []))
    .join('\n');
  return text.length > 0 ? { content: text } : {};
}

export async function writeProposeGraphCommitProofArtifacts(options: {
  fixtureRoot: string;
  runId: string;
  sessionText: string;
  report: ProposeGraphCommitProofReport;
}): Promise<ProposeGraphCommitProofArtifacts> {
  const runDir = join(options.fixtureRoot, 'runs', PROBE_ID, options.runId);
  const artifacts: ProposeGraphCommitProofArtifacts = {
    runDir,
    sessionJsonl: join(runDir, 'session.jsonl'),
    transcriptMarkdown: join(runDir, 'transcript.md'),
    reportJson: join(runDir, 'report.json'),
  };
  const report: ProposeGraphCommitProofReport = {
    ...options.report,
    artifacts,
  };

  await mkdir(runDir, { recursive: true });
  await writeFile(artifacts.sessionJsonl, options.sessionText, 'utf8');
  const transcriptMarkdown = [
    renderSessionTranscript(options.sessionText, { title: 'session.jsonl' }),
    '',
    '## Raw session JSONL',
    '',
    '```jsonl',
    options.sessionText.trimEnd(),
    '```',
    '',
  ].join('\n');
  await writeFile(artifacts.transcriptMarkdown, transcriptMarkdown, 'utf8');
  await writeFile(artifacts.reportJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return artifacts;
}

function seedScenarioGraph(
  graph: Awaited<ReturnType<typeof openWorkspaceGraphRuntime>>,
  specId: number,
  scenarioId: ProposeGraphCommitScenarioId,
): string | undefined {
  if (scenarioId !== 'existing-code-ref') return undefined;
  const result = graph.commandExecutor.createNode({
    specId,
    plane: 'intent',
    kind: 'goal',
    title: 'Selected-spec launch readiness goal',
    body: 'Pre-existing graph node seeded so the product-path probe must reference it by projected code.',
  });
  if (result.status !== 'success') {
    throw new Error('failed to seed existing-code-ref graph node');
  }
  return 'G1';
}

function defaultProofPrompt(scenarioId: ProposeGraphCommitScenarioId): string {
  if (scenarioId === 'existing-code-ref') {
    return `Brunch A14-L probe: the selected specification graph already contains a launch-readiness goal.

Use read_graph once in overview mode. Find the projected code for the existing launch-readiness goal, then use commit_graph to create one new requirement node titled "Rollback path is documented" and one legal edge connecting that new requirement to the existing goal by using the existing node's projected code as {existingCode: "G1"}. Do not recreate the existing goal. Stop after a successful commit_graph result.`;
  }
  if (scenarioId === 'retry-diagnostics') {
    return `Brunch A14-L retry diagnostics probe.

Use read_graph once in overview mode. Then intentionally make exactly one structurally illegal commit_graph attempt by creating two intent-plane nodes and a proof edge between them without the required stance field. Read the STRUCTURAL_ILLEGAL diagnostics. Then retry once with a corrected complete batch that creates the same two nodes and a legal proof edge with stance "for". Stop after the corrected commit_graph succeeds.`;
  }

  return `Brunch A14-L probe: the user has accepted the following concept-level proposal and asked you to persist it now.\n\nConcept: A Brunch specification workspace needs an explicit launch-readiness subgraph that records the launch goal, the rollback requirement, the operator visibility criterion, and the assumption that users can recover from a failed launch.\n\nUse the read_graph tool once in overview mode, then use commit_graph to persist a coherent intent-plane graph. Requirements for the commit_graph call:\n- create at least four intent-plane nodes\n- include at least one goal, one requirement, one criterion, and one assumption\n- create at least three edges connecting the nodes\n- use only legal edge categories from the tool guidance\n- include stance only on support or proof edges\n- avoid decision and term nodes for this proof so detail schemas are not needed\n\nIf commit_graph returns STRUCTURAL_ILLEGAL, read the diagnostics and retry once with a corrected complete batch. Stop after a successful commit_graph result.`;
}

function retryPrompt(diagnostics: readonly Diagnostic[]): string {
  const renderedDiagnostics = diagnostics
    .map((diagnostic) => `- ${diagnostic.field}: ${diagnostic.message}`)
    .join('\n');
  return `The previous commit_graph attempt was structurally illegal. Retry once with a complete corrected batch. Diagnostics:\n${renderedDiagnostics}`;
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

function parseCliArgs(argv: readonly string[]): ProposeGraphCommitProofOptions {
  const options: ProposeGraphCommitProofOptions = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--cwd') {
      options.cwd = requiredValue(argv, (index += 1), arg);
    } else if (arg === '--fixture-root') {
      options.fixtureRoot = requiredValue(argv, (index += 1), arg);
    } else if (arg === '--run-id') {
      options.runId = requiredValue(argv, (index += 1), arg);
    } else if (arg === '--max-attempts') {
      options.maxAttempts = Number(requiredValue(argv, (index += 1), arg));
    } else if (arg === '--prompt') {
      options.prompt = requiredValue(argv, (index += 1), arg);
    } else if (arg === '--scenario') {
      const scenarioId = requiredValue(argv, (index += 1), arg);
      if (
        scenarioId !== 'direct-commit' &&
        scenarioId !== 'existing-code-ref' &&
        scenarioId !== 'retry-diagnostics'
      ) {
        throw new Error(`Unsupported scenario ${scenarioId}`);
      }
      options.scenarioId = scenarioId;
    }
  }
  return options;
}

function requiredValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index];
  if (value === undefined) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

async function main(): Promise<void> {
  const report = await runProposeGraphCommitProof(parseCliArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.success ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}

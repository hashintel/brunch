import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { getAgentDir } from '@earendil-works/pi-coding-agent';

import { appendBrunchAgentRuntimeSwitch, type BrunchAgentState } from '../.pi/extensions/runtime/index.js';
import { createBrunchAgentSessionRuntimeFactory } from '../app/brunch-tui.js';
import {
  formatGraphNodeCode,
  openWorkspaceGraphRuntime,
  type Diagnostic,
  type GraphNode,
  type GraphSlice,
  type MutateGraphSuccess,
  type StructuralIllegal,
} from '../graph/index.js';
import { seedFixture, type SeedFixture } from '../graph/seed-fixtures.js';
import { renderSessionTranscript } from '../session/session-transcript.js';
import { createWorkspaceSessionCoordinator } from '../session/workspace-session-coordinator.js';
import { assertPortableRunId, portableCwd } from './portable-report.js';

const PROBE_ID = 'fixture-curation' as const;
const DEFAULT_SEED_SET = 'bilal-port-variants';
const DEFAULT_SEED_SLUG = 'macro-view-grounded-intent';

type FixtureCurationCommitStatus =
  | MutateGraphSuccess['status']
  | StructuralIllegal['status']
  | 'needs_human'
  | 'policy_blocked'
  | 'version_conflict'
  | 'unknown';

interface FixtureCurationRuntimeStateReport {
  readonly operationalMode: 'elicit';
  readonly agentStrategy: 'propose-graph';
  readonly agentLens: 'intent';
}

interface FixtureCurationRunOptions {
  readonly cwd?: string;
  readonly fixtureRoot?: string;
  readonly seedSet?: string;
  readonly seedSlug?: string;
  readonly selectedBaseProfile?: string;
  readonly runId?: string;
  readonly prompt?: string;
  readonly agentDir?: string;
}

export interface FixtureCurationArtifacts {
  readonly runDir: string;
  readonly sessionJsonl: string;
  readonly transcriptMarkdown: string;
  readonly reportJson: string;
  readonly graphOverviewJson: string;
}

interface FixtureCurationCommitAttempt {
  readonly index: number;
  readonly status: FixtureCurationCommitStatus;
  readonly lsn?: number;
  readonly nodeRefs?: Record<string, number>;
  readonly edgeIds?: number[];
  readonly diagnostics?: Diagnostic[];
  readonly content?: string;
}

interface FixtureCurationCreatedNode {
  readonly id: number;
  readonly code: string;
  readonly plane: GraphNode['plane'];
  readonly kind: GraphNode['kind'];
  readonly title: string;
  readonly basis: 'implicit';
}

export interface FixtureCurationReport {
  readonly schemaVersion: 1;
  readonly probeId: typeof PROBE_ID;
  readonly runId: string;
  readonly generatedAt: string;
  readonly seedSet: string;
  readonly seedSlug: string;
  readonly selectedBaseProfile: string;
  readonly cwd: string;
  readonly specId: number;
  readonly sessionId: string;
  readonly prompt: string;
  readonly runtimeState: FixtureCurationRuntimeStateReport;
  readonly model?: string;
  readonly success: boolean;
  readonly mutateGraphAttemptCount: number;
  readonly mutateGraphAttempts: FixtureCurationCommitAttempt[];
  readonly createdNodes: FixtureCurationCreatedNode[];
  readonly finalGraph: {
    readonly nodeCount: number;
    readonly edgeCount: number;
    readonly lsn: number;
    readonly explicitNodeCount: number;
    readonly implicitNodeCount: number;
    readonly explicitEdgeCount: number;
    readonly implicitEdgeCount: number;
  };
  readonly friction: string[];
  readonly artifacts?: FixtureCurationArtifacts;
}

export interface FixtureCurationSummaryInput {
  readonly runId: string;
  readonly generatedAt: string;
  readonly cwd: string;
  readonly seedSet?: string;
  readonly seedSlug: string;
  readonly selectedBaseProfile: string;
  readonly specId: number;
  readonly sessionId: string;
  readonly prompt: string;
  readonly runtimeState: FixtureCurationRuntimeStateReport;
  readonly model?: string;
  readonly sessionText: string;
  readonly overview: GraphSlice;
  readonly friction?: readonly string[];
}

export async function runFixtureCurationLoop(
  options: FixtureCurationRunOptions = {},
): Promise<FixtureCurationReport> {
  const cwd = resolve(options.cwd ?? (await mkdtemp(join(tmpdir(), 'brunch-fixture-curation-'))));
  const fixtureRoot = resolve(
    options.fixtureRoot ?? join(dirname(fileURLToPath(import.meta.url)), '../../.fixtures'),
  );
  const seedSet = options.seedSet ?? DEFAULT_SEED_SET;
  const seedSlug = options.seedSlug ?? DEFAULT_SEED_SLUG;
  const selectedBaseProfile = options.selectedBaseProfile ?? 'grounded-intent';
  const runId = assertPortableRunId(options.runId ?? defaultRunId());
  const prompt = options.prompt ?? defaultCurationPrompt();
  const generatedAt = new Date().toISOString();
  const fixture = await readSeedFixture(join(fixtureRoot, 'seeds', seedSet, `${seedSlug}.json`));
  const graph = await openWorkspaceGraphRuntime(cwd);
  const seedResult = seedFixture(graph.commandExecutor, fixture);
  const coordinator = createWorkspaceSessionCoordinator({ cwd });
  await coordinator.openDefaultWorkspace();
  await selectSpecForSetupSession(cwd, seedResult.specId);
  const activated = await coordinator.activateWorkspace({ action: 'newSession', specId: seedResult.specId });
  if (activated.status !== 'ready') {
    throw new Error(`fixture curation could not activate seeded spec: ${activated.status}`);
  }

  const runtimeState: BrunchAgentState = {
    schemaVersion: 1,
    operationalMode: 'elicit',
    agentStrategy: 'propose-graph',
    agentLens: 'intent',
  };
  const runtimeStateReport: FixtureCurationRuntimeStateReport = {
    operationalMode: 'elicit',
    agentStrategy: 'propose-graph',
    agentLens: 'intent',
  };
  appendBrunchAgentRuntimeSwitch(activated.session.manager, runtimeState, 'extension');
  const createRuntime = createBrunchAgentSessionRuntimeFactory({ workspace: activated, coordinator });
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
    const sessionText = await readFile(activated.session.file, 'utf8');
    const overview = graph.forSpec(seedResult.specId).queryGraph();
    let report = summarizeFixtureCurationRun({
      runId,
      generatedAt,
      cwd,
      seedSet,
      seedSlug,
      selectedBaseProfile,
      specId: seedResult.specId,
      sessionId: activated.session.id,
      prompt,
      runtimeState: runtimeStateReport,
      ...(session.model?.id !== undefined ? { model: session.model.id } : {}),
      sessionText,
      overview,
      friction,
    });

    report = {
      ...report,
      artifacts: await writeFixtureCurationArtifacts({
        fixtureRoot,
        runId,
        sessionText,
        report,
        graphOverview: overview,
      }),
    };
    return report;
  } finally {
    session.dispose();
  }
}

export function summarizeFixtureCurationRun(input: FixtureCurationSummaryInput): FixtureCurationReport {
  const mutateGraphAttempts = mutateGraphAttemptsFromSession(input.sessionText);
  const createdNodes = input.overview.nodes.flatMap((node): FixtureCurationCreatedNode[] => {
    if (node.basis !== 'implicit') return [];
    return [
      {
        id: node.id,
        code: formatGraphNodeCode(node.kind, node.kindOrdinal),
        plane: node.plane,
        kind: node.kind,
        title: node.title,
        basis: 'implicit',
      },
    ];
  });
  const explicitNodeCount = input.overview.nodes.filter((node) => node.basis === 'explicit').length;
  const implicitNodeCount = createdNodes.length;
  const explicitEdgeCount = input.overview.edges.filter((edge) => edge.basis === 'explicit').length;
  const implicitEdgeCount = input.overview.edges.filter((edge) => edge.basis === 'implicit').length;
  const friction = [...(input.friction ?? [])];
  const hasSuccessfulCommit = mutateGraphAttempts.some((attempt) => attempt.status === 'success');

  if (mutateGraphAttempts.length === 0) {
    friction.push('No graph mutation tool result was recorded in the session transcript.');
  }
  if (!hasSuccessfulCommit && mutateGraphAttempts.length > 0) {
    friction.push(
      `No graph mutation attempt succeeded; final status was ${mutateGraphAttempts.at(-1)!.status}.`,
    );
  }
  if (implicitNodeCount === 0) {
    friction.push('No implicit graph nodes were present in graph readback.');
  }

  return {
    schemaVersion: 1,
    probeId: PROBE_ID,
    runId: input.runId,
    generatedAt: input.generatedAt,
    seedSet: input.seedSet ?? DEFAULT_SEED_SET,
    seedSlug: input.seedSlug,
    selectedBaseProfile: input.selectedBaseProfile,
    cwd: input.cwd,
    specId: input.specId,
    sessionId: input.sessionId,
    prompt: input.prompt,
    runtimeState: input.runtimeState,
    ...(input.model !== undefined ? { model: input.model } : {}),
    success: hasSuccessfulCommit && implicitNodeCount > 0,
    mutateGraphAttemptCount: mutateGraphAttempts.length,
    mutateGraphAttempts,
    createdNodes,
    finalGraph: {
      nodeCount: input.overview.nodes.length,
      edgeCount: input.overview.edges.length,
      lsn: input.overview.lsn,
      explicitNodeCount,
      implicitNodeCount,
      explicitEdgeCount,
      implicitEdgeCount,
    },
    friction,
  };
}

export async function writeFixtureCurationArtifacts(options: {
  readonly fixtureRoot: string;
  readonly runId: string;
  readonly sessionText: string;
  readonly report: FixtureCurationReport;
  readonly graphOverview: GraphSlice;
}): Promise<FixtureCurationArtifacts> {
  // Persisted artifact references are fixture-root-relative so committed
  // reports stay portable; the disk paths used for writing are resolved
  // against the (possibly absolute) fixture root.
  const runId = assertPortableRunId(options.runId);
  const runDirRef = `runs/${PROBE_ID}/${runId}`;
  const artifacts: FixtureCurationArtifacts = {
    runDir: runDirRef,
    sessionJsonl: `${runDirRef}/session.jsonl`,
    transcriptMarkdown: `${runDirRef}/transcript.md`,
    reportJson: `${runDirRef}/report.json`,
    graphOverviewJson: `${runDirRef}/graph-overview.json`,
  };
  const diskPath = (ref: string) => resolve(options.fixtureRoot, ref);
  const report = { ...options.report, cwd: portableCwd(options.report.cwd), artifacts };

  await mkdir(diskPath(artifacts.runDir), { recursive: true });
  await writeFile(diskPath(artifacts.sessionJsonl), options.sessionText, 'utf8');
  await writeFile(
    diskPath(artifacts.transcriptMarkdown),
    `${renderSessionTranscript(options.sessionText, { title: 'session.jsonl' })}\n\n## Raw session JSONL\n\n\`\`\`jsonl\n${options.sessionText.trimEnd()}\n\`\`\`\n`,
    'utf8',
  );
  await writeFile(diskPath(artifacts.reportJson), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(
    diskPath(artifacts.graphOverviewJson),
    `${JSON.stringify(options.graphOverview, null, 2)}\n`,
    'utf8',
  );

  return artifacts;
}

async function readSeedFixture(path: string): Promise<SeedFixture> {
  return JSON.parse(await readFile(path, 'utf8')) as SeedFixture;
}

function mutateGraphAttemptsFromSession(sessionText: string): FixtureCurationCommitAttempt[] {
  const attempts: FixtureCurationCommitAttempt[] = [];
  for (const line of sessionText.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const entry = parseJson(trimmed);
    if (!isRecord(entry) || entry.type !== 'message') continue;
    const message = entry.message;
    if (!isRecord(message) || message.role !== 'toolResult' || message.toolName !== 'mutate_graph') {
      continue;
    }
    attempts.push(mutateGraphAttemptFromMessage(attempts.length + 1, message));
  }
  return attempts;
}

function mutateGraphAttemptFromMessage(
  index: number,
  message: Record<string, unknown>,
): FixtureCurationCommitAttempt {
  const details = isRecord(message.details) ? message.details : undefined;
  return {
    index,
    status: mutateGraphStatus(details?.status),
    ...(typeof details?.lsn === 'number' ? { lsn: details.lsn } : {}),
    ...(isCreatedNodeRecord(details?.createdNodes)
      ? { nodeRefs: mapCreatedNodeIds(details.createdNodes) }
      : {}),
    ...(isNumberArray(details?.edges) ? { edgeIds: details.edges } : {}),
    ...(isDiagnosticArray(details?.diagnostics) ? { diagnostics: details.diagnostics } : {}),
    ...textContent(message.content),
  };
}

function mutateGraphStatus(value: unknown): FixtureCurationCommitStatus {
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

function defaultCurationPrompt(): string {
  return `Brunch fixture-curation tracer: the selected spec is a Bilal-derived explicit base seed named "${DEFAULT_SEED_SLUG}".

Use read_graph once in overview mode. Then use mutate_graph exactly once to add a small intent-plane expansion that improves launch/usefulness of this existing spec without duplicating base nodes. Create one to three new intent-plane nodes, connect them legally to existing graph truth when possible, use basis implicit through the propose-graph tool path, and stop after a successful mutate_graph result.`;
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

function parseCliArgs(argv: readonly string[]): FixtureCurationRunOptions {
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
    ...(options['selected-base-profile'] !== undefined
      ? { selectedBaseProfile: options['selected-base-profile'] }
      : {}),
    ...(options['run-id'] !== undefined ? { runId: options['run-id'] } : {}),
    ...(options.prompt !== undefined ? { prompt: options.prompt } : {}),
    ...(options['agent-dir'] !== undefined ? { agentDir: options['agent-dir'] } : {}),
  };
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

function requiredValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index];
  if (value === undefined) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

async function main(): Promise<void> {
  const report = await runFixtureCurationLoop(parseCliArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.success ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { getAgentDir } from '@earendil-works/pi-coding-agent';

import type { GraphSlice } from '../graph/index.js';
import { openWorkspaceGraphRuntime, type CommandExecutor } from '../graph/index.js';
import { assertPortableRunId, portableCwd } from '../probes/portable-report.js';
import { bootTier2RuntimeFromFixture, type Tier2FixtureEntry } from './tier-2-harness.js';

const PROBE_ID = 'generate-fan-out' as const;
const DEFAULT_PROMPT =
  'Generate oracle ensembles for this plan. I want a composed verification strategy, not just one test.';
const DEFAULT_TIMEOUT_MS = 30_000;
const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

export interface GenerateFanOutWitnessArtifacts {
  readonly runDir: string;
  readonly sessionJsonl: string;
  readonly reportJson: string;
}

export interface GenerateFanOutWitnessMarker {
  readonly passed: boolean;
  readonly evidence: readonly number[];
}

export interface GenerateFanOutWitnessNoWriteMarker {
  readonly passed: boolean;
  readonly graphUnchanged: boolean;
  readonly mutateGraphToolResultCount: number;
  readonly approvedReviewResultCount: number;
  readonly presentReviewSetBeforeCandidateCount: number;
  readonly evidence: readonly number[];
}

export interface GenerateFanOutWitnessReport {
  readonly schemaVersion: 1;
  readonly probeId: typeof PROBE_ID;
  readonly runId: string;
  readonly generatedAt: string;
  readonly mission: string;
  readonly evaluationFocus: string;
  readonly cwd: string;
  readonly specId: number;
  readonly sessionId: string;
  readonly prompt: string;
  readonly model?: string;
  readonly status: 'ok' | 'skipped' | 'blocked';
  readonly reason?: string;
  readonly success: boolean;
  readonly turn: {
    readonly timedOut: boolean;
    readonly timeoutMs: number;
  };
  readonly baseGraph: {
    readonly lsn: number;
    readonly nodeCount: number;
    readonly edgeCount: number;
  };
  readonly finalGraph: {
    readonly lsn: number;
    readonly nodeCount: number;
    readonly edgeCount: number;
  };
  readonly graphDelta: {
    readonly lsnDelta: number;
    readonly nodeDelta: number;
    readonly edgeDelta: number;
  };
  readonly markers: {
    readonly proposeSkillRead: GenerateFanOutWitnessMarker;
    readonly oracleReferenceReadAfterSkill: GenerateFanOutWitnessMarker;
    readonly presentCandidatesEmitted: GenerateFanOutWitnessMarker;
    readonly noBrunchKickBeforePrompt: GenerateFanOutWitnessMarker;
    readonly noWriteBeforePick: GenerateFanOutWitnessNoWriteMarker;
  };
  readonly friction: readonly string[];
  readonly artifacts?: GenerateFanOutWitnessArtifacts;
}

export interface GenerateFanOutWitnessSummaryInput {
  readonly runId: string;
  readonly generatedAt: string;
  readonly cwd: string;
  readonly specId: number;
  readonly sessionId: string;
  readonly prompt: string;
  readonly model?: string;
  readonly status: GenerateFanOutWitnessReport['status'];
  readonly reason?: string;
  readonly sessionText: string;
  readonly baseGraph: GraphSlice;
  readonly finalGraph: GraphSlice;
  readonly turn: GenerateFanOutWitnessReport['turn'];
  readonly friction?: readonly string[];
}

interface GenerateFanOutWitnessRunOptions {
  readonly runId?: string;
  readonly prompt?: string;
  readonly timeoutMs?: number;
  readonly fixtureRoot?: string;
}

interface TranscriptEvidence {
  readonly index: number;
  readonly text: string;
}

interface ToolTranscriptEvent extends TranscriptEvidence {
  readonly toolName: string;
  readonly source: 'toolCall' | 'toolResult';
}

export async function runGenerateFanOutWitness(
  options: GenerateFanOutWitnessRunOptions = {},
): Promise<GenerateFanOutWitnessReport> {
  const runId = assertPortableRunId(options.runId ?? defaultRunId());
  const generatedAt = new Date().toISOString();
  const prompt = options.prompt ?? DEFAULT_PROMPT;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fixtureRoot = resolve(options.fixtureRoot ?? join(REPO_ROOT, '.fixtures'));
  const boot = await bootTier2RuntimeFromFixture({
    specTitle: 'Generate fan-out witness',
    fixtureEntries: idleFixtureEntries,
    agentDir: getAgentDir(),
  });
  const graph = await openWorkspaceGraphRuntime(boot.cwd);
  seedOracleMeaningfulGraph(graph.commandExecutor, boot.specId);
  const baseGraph = graph.forSpec(boot.specId).queryGraph(undefined, { visibility: 'all' });
  const sessionId = sessionIdFromFile(boot.sessionFile);

  try {
    await boot.runtime.session.extensionRunner.emitBeforeAgentStart(
      'Derive generate fan-out witness legality',
      undefined,
      '',
      {} as never,
    );

    const availableModels = boot.runtime.services.modelRuntime.getAvailableSnapshot();
    if (availableModels.length === 0) {
      const sessionText = await readFile(boot.sessionFile, 'utf8');
      const finalGraph = graph.forSpec(boot.specId).queryGraph(undefined, { visibility: 'all' });
      const report = summarizeGenerateFanOutWitness({
        runId,
        generatedAt,
        cwd: boot.cwd,
        specId: boot.specId,
        sessionId,
        prompt,
        status: 'skipped',
        reason: 'no_model_available',
        sessionText,
        baseGraph,
        finalGraph,
        turn: { timedOut: false, timeoutMs },
        friction: ['No available model in the product model registry; the probe did not run.'],
      });
      return await persistRunReport({ fixtureRoot, runId, sessionText, report });
    }

    const turn = await runTurnWithTimeout(
      boot.runtime.session.prompt(prompt, { expandPromptTemplates: false, source: 'rpc' }),
      timeoutMs,
    );
    const sessionText = await readFile(boot.sessionFile, 'utf8');
    const finalGraph = graph.forSpec(boot.specId).queryGraph(undefined, { visibility: 'all' });
    const model = modelStamp(boot.runtime.session.model ?? availableModels[0]);
    const report = summarizeGenerateFanOutWitness({
      runId,
      generatedAt,
      cwd: boot.cwd,
      specId: boot.specId,
      sessionId,
      prompt,
      ...(model ? { model } : {}),
      status: turn.timedOut ? 'blocked' : 'ok',
      ...(turn.timedOut ? { reason: 'timeout' } : {}),
      sessionText,
      baseGraph,
      finalGraph,
      turn,
      friction: turn.timedOut
        ? ['Prompt turn timed out; markers were read from the partial transcript.']
        : [],
    });
    return await persistRunReport({ fixtureRoot, runId, sessionText, report });
  } finally {
    await boot.runtime.dispose();
    boot.restoreEnv();
  }
}

export function summarizeGenerateFanOutWitness(
  input: GenerateFanOutWitnessSummaryInput,
): GenerateFanOutWitnessReport {
  const toolEvents = toolTranscriptEvents(input.sessionText);
  const toolResults = toolEvents.filter((event) => event.source === 'toolResult');
  const skillReads = findToolEvents(toolEvents, 'read', 'propose/SKILL.md');
  const oracleReads = findToolEvents(toolEvents, 'read', 'propose/references/oracle.md');
  const presentCandidates = findToolEvents(toolEvents, 'present_candidates');
  const mutateGraphResults = findToolEvents(toolResults, 'mutate_graph');
  const approvedReviewResults = toolResults.filter((message) => hasApprovedReviewResult(message.text));
  const presentReviewSetBeforeCandidate = toolResults.filter(
    (message) =>
      message.toolName === 'present_review_set' &&
      (presentCandidates[0]?.index === undefined || message.index < presentCandidates[0].index),
  );
  const promptEntries = entriesContaining(input.sessionText, input.prompt);
  const kickEntriesBeforePrompt = entriesContaining(input.sessionText, 'brunch.kick').filter(
    (entry) => promptEntries[0]?.index === undefined || entry.index < promptEntries[0].index,
  );
  const graphDelta = {
    lsnDelta: input.finalGraph.lsn - input.baseGraph.lsn,
    nodeDelta: input.finalGraph.nodes.length - input.baseGraph.nodes.length,
    edgeDelta: input.finalGraph.edges.length - input.baseGraph.edges.length,
  };
  const graphUnchanged =
    graphDelta.lsnDelta === 0 && graphDelta.nodeDelta === 0 && graphDelta.edgeDelta === 0;
  const oracleReferenceReadAfterSkill = oracleReads.filter(
    (read) => skillReads[0]?.index !== undefined && read.index > skillReads[0].index,
  );
  const noWriteBeforePick = {
    passed: graphUnchanged && mutateGraphResults.length === 0 && approvedReviewResults.length === 0,
    graphUnchanged,
    mutateGraphToolResultCount: mutateGraphResults.length,
    approvedReviewResultCount: approvedReviewResults.length,
    presentReviewSetBeforeCandidateCount: presentReviewSetBeforeCandidate.length,
    evidence: [...mutateGraphResults, ...approvedReviewResults, ...presentReviewSetBeforeCandidate].map(
      (message) => message.index,
    ),
  };
  const markers: GenerateFanOutWitnessReport['markers'] = {
    proposeSkillRead: marker(skillReads),
    oracleReferenceReadAfterSkill: marker(oracleReferenceReadAfterSkill),
    presentCandidatesEmitted: marker(presentCandidates),
    noBrunchKickBeforePrompt: {
      passed: kickEntriesBeforePrompt.length === 0,
      evidence: kickEntriesBeforePrompt.map((entry) => entry.index),
    },
    noWriteBeforePick,
  };
  const friction = [...(input.friction ?? [])];

  if (!markers.proposeSkillRead.passed) {
    friction.push('The transcript did not show a read of propose/SKILL.md.');
  }
  if (!markers.oracleReferenceReadAfterSkill.passed) {
    friction.push('The transcript did not show references/oracle.md read after SKILL.md.');
  }
  if (!markers.presentCandidatesEmitted.passed) {
    friction.push('The transcript did not show present_candidates.');
  }
  if (!markers.noBrunchKickBeforePrompt.passed) {
    friction.push('brunch.kick appeared before the probe prompt; the run may be contaminated by auto-kick.');
  }
  if (!markers.noWriteBeforePick.passed) {
    friction.push('Graph changed or a commit-facing tool result appeared before any candidate pick.');
  }
  if (presentReviewSetBeforeCandidate.length > 0) {
    friction.push(
      'present_review_set appeared before present_candidates; classify this as ordering anomaly, not commit.',
    );
  }

  const success =
    input.status === 'ok' &&
    markers.proposeSkillRead.passed &&
    markers.oracleReferenceReadAfterSkill.passed &&
    markers.presentCandidatesEmitted.passed &&
    markers.noBrunchKickBeforePrompt.passed &&
    markers.noWriteBeforePick.passed;

  return {
    schemaVersion: 1,
    probeId: PROBE_ID,
    runId: input.runId,
    generatedAt: input.generatedAt,
    mission:
      'Witness the oracle-plane proposal fan-out path through the real Brunch runtime and canonical session transcript.',
    evaluationFocus:
      'A31-L fan-out half: live propose skill load, oracle reference load, present_candidates, and I51-L no-write before candidate pick.',
    cwd: input.cwd,
    specId: input.specId,
    sessionId: input.sessionId,
    prompt: input.prompt,
    ...(input.model !== undefined ? { model: input.model } : {}),
    status: input.status,
    ...(input.reason !== undefined ? { reason: input.reason } : {}),
    success,
    turn: input.turn,
    baseGraph: graphSummary(input.baseGraph),
    finalGraph: graphSummary(input.finalGraph),
    graphDelta,
    markers,
    friction,
  };
}

export async function writeGenerateFanOutWitnessArtifacts(options: {
  readonly fixtureRoot: string;
  readonly runId: string;
  readonly sessionText: string;
  readonly report: GenerateFanOutWitnessReport;
}): Promise<GenerateFanOutWitnessArtifacts> {
  const runId = assertPortableRunId(options.runId);
  const runDirRef = `scratch/${PROBE_ID}/${runId}`;
  const artifacts: GenerateFanOutWitnessArtifacts = {
    runDir: runDirRef,
    sessionJsonl: `${runDirRef}/session.jsonl`,
    reportJson: `${runDirRef}/report.json`,
  };
  const diskPath = (ref: string) => resolve(options.fixtureRoot, ref);
  const report = { ...options.report, cwd: portableCwd(options.report.cwd), artifacts };

  await mkdir(diskPath(artifacts.runDir), { recursive: true });
  await writeFile(diskPath(artifacts.sessionJsonl), options.sessionText, 'utf8');
  await writeFile(diskPath(artifacts.reportJson), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  return artifacts;
}

async function persistRunReport(options: {
  readonly fixtureRoot: string;
  readonly runId: string;
  readonly sessionText: string;
  readonly report: GenerateFanOutWitnessReport;
}): Promise<GenerateFanOutWitnessReport> {
  const artifacts = await writeGenerateFanOutWitnessArtifacts(options);
  return { ...options.report, artifacts };
}

function seedOracleMeaningfulGraph(commandExecutor: CommandExecutor, specId: number): void {
  const goal = commandExecutor.createNode({
    specId,
    plane: 'intent',
    kind: 'goal',
    title: 'Keep generate candidates separate from committed graph truth',
    body: 'Candidate proposal is recognition material until a later review-set approval commits graph truth.',
    basis: 'explicit',
    source: 'fan-out witness seed',
  });
  if (goal.status !== 'success') throw new Error('Could not seed fan-out witness intent goal.');

  const module = commandExecutor.createNode({
    specId,
    plane: 'design',
    kind: 'module',
    title: 'One plane-parameterized generate skill',
    body: 'Intent, design, and oracle generation share the same fan-out spine with plane-keyed references.',
    basis: 'explicit',
    source: 'fan-out witness seed',
  });
  if (module.status !== 'success') throw new Error('Could not seed fan-out witness design module.');
}

function idleFixtureEntries(): readonly Tier2FixtureEntry[] {
  return [
    {
      type: 'message',
      message: {
        role: 'user',
        content: 'Previously established project context.',
        timestamp: 0,
      },
    },
    {
      type: 'message',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Standing by with no unresolved question.' }],
        api: 'brunch-fixture',
        provider: 'brunch',
        model: 'idle-fixture',
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: 'stop',
        timestamp: 1,
      },
    },
  ];
}

function marker(messages: readonly TranscriptEvidence[]): GenerateFanOutWitnessMarker {
  return { passed: messages.length > 0, evidence: messages.map((message) => message.index) };
}

function graphSummary(graph: GraphSlice): GenerateFanOutWitnessReport['baseGraph'] {
  return { lsn: graph.lsn, nodeCount: graph.nodes.length, edgeCount: graph.edges.length };
}

function toolTranscriptEvents(sessionText: string): readonly ToolTranscriptEvent[] {
  const events: ToolTranscriptEvent[] = [];
  let index = 0;
  for (const line of sessionText.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const entry = parseJson(trimmed);
    if (!isRecord(entry) || entry.type !== 'message') {
      index += 1;
      continue;
    }
    const message = entry.message;
    if (!isRecord(message)) {
      index += 1;
      continue;
    }
    if (message.role === 'toolResult' && typeof message.toolName === 'string') {
      events.push({ index, toolName: message.toolName, source: 'toolResult', text: JSON.stringify(message) });
    }
    if (Array.isArray(message.content)) {
      for (const content of message.content) {
        if (!isRecord(content) || content.type !== 'toolCall' || typeof content.name !== 'string') continue;
        events.push({ index, toolName: content.name, source: 'toolCall', text: JSON.stringify(content) });
      }
    }
    index += 1;
  }
  return events;
}

function findToolEvents(
  messages: readonly ToolTranscriptEvent[],
  toolName: string,
  contains?: string,
): readonly ToolTranscriptEvent[] {
  return messages.filter(
    (message) => message.toolName === toolName && (contains === undefined || message.text.includes(contains)),
  );
}

function entriesContaining(sessionText: string, contains: string): readonly TranscriptEvidence[] {
  const entries: TranscriptEvidence[] = [];
  let index = 0;
  for (const line of sessionText.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && trimmed.includes(contains)) {
      entries.push({ index, text: trimmed });
    }
    if (trimmed.length > 0) index += 1;
  }
  return entries;
}

function hasApprovedReviewResult(text: string): boolean {
  return (
    text.includes('"decision":"approve"') ||
    text.includes('"decision": "approve"') ||
    text.includes('"status":"approved"') ||
    text.includes('"status": "approved"')
  );
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

async function runTurnWithTimeout(
  turn: Promise<unknown>,
  timeoutMs: number,
): Promise<GenerateFanOutWitnessReport['turn']> {
  const result = await Promise.race([
    turn.then(() => 'completed' as const),
    new Promise<'timeout'>((resolveTimeout) => {
      setTimeout(() => resolveTimeout('timeout'), timeoutMs);
    }),
  ]);
  return { timedOut: result === 'timeout', timeoutMs };
}

function modelStamp(model: unknown): string | undefined {
  if (!isRecord(model)) return undefined;
  const provider = typeof model.provider === 'string' ? model.provider : undefined;
  const id = typeof model.id === 'string' ? model.id : undefined;
  if (provider && id) return `${provider}/${id}`;
  return id ?? provider;
}

function sessionIdFromFile(sessionFile: string): string {
  return (
    sessionFile
      .split('/')
      .at(-1)
      ?.replace(/\.jsonl$/u, '') ?? 'unknown-session'
  );
}

function defaultRunId(): string {
  return new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

function parseCliArgs(argv: readonly string[]): GenerateFanOutWitnessRunOptions {
  const options: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg !== undefined && arg.startsWith('--')) {
      options[arg.slice(2)] = requiredValue(argv, (index += 1), arg);
    }
  }
  return {
    ...(options['run-id'] !== undefined ? { runId: options['run-id'] } : {}),
    ...(options.prompt !== undefined ? { prompt: options.prompt } : {}),
    ...(options['timeout-ms'] !== undefined ? { timeoutMs: Number(options['timeout-ms']) } : {}),
    ...(options['fixture-root'] !== undefined ? { fixtureRoot: options['fixture-root'] } : {}),
  };
}

function requiredValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index];
  if (value === undefined) throw new Error(`${flag} requires a value`);
  return value;
}

async function main(): Promise<void> {
  const report = await runGenerateFanOutWitness(parseCliArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.success ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

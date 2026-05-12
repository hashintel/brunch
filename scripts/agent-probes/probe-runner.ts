import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export interface ProbeJsonlRequest {
  id: string;
  capability: string;
  input?: unknown;
}

export type ProbeJsonlResponse =
  | { id: string; ok: true; output: unknown }
  | { id: string | null; ok: false; error: { code: string; message: string } };

export interface JsonlTransport {
  send(request: ProbeJsonlRequest): Promise<ProbeJsonlResponse>;
}

export interface SpawnedJsonlProcess {
  writeStdin(line: string): void;
  endStdin(): void;
  onStdoutData(listener: (chunk: string) => void): void;
  onStderrData?(listener: (chunk: string) => void): void;
  onExit?(listener: (code: number | null) => void): void;
}

export interface ProbeProcessSpawnOptions {
  cwd: string;
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

export type ProbeProcessSpawner = (options: ProbeProcessSpawnOptions) => SpawnedJsonlProcess;

export interface ScriptedProbeScenario {
  name: string;
  specName: string;
  brief?: string;
}

export interface ProbeRunError {
  requestId: string;
  capability: string;
  code: string;
  message: string;
}

export interface ProbeQuestionAnswer {
  question: string;
  answer: string;
}

export interface ProbeRunSummary {
  turnsAnswered: number;
  finalFrontierState: string | null;
  durationMs: number;
  questionAnswers: ProbeQuestionAnswer[];
  errors: ProbeRunError[];
}

export interface ProbeArtifactBundle {
  schemaVersion: 1;
  scenario: { name: string; brief: string | null; specName: string };
  workspace: { cwd: string | null; preservedStatePath: string | null };
  commandSequence: string[];
  rawJsonlTranscript: Array<{
    direction: 'request' | 'response';
    payload: ProbeJsonlRequest | ProbeJsonlResponse | null;
  }>;
  parsedEvents: Array<{ index: number; request: ProbeJsonlRequest; response: ProbeJsonlResponse | null }>;
  finalChat: AgentChatReadProjection | null;
  summary: ProbeRunSummary;
  errors: ProbeRunError[];
  environment: { nodeVersion: string; platform: NodeJS.Platform; arch: string };
}

export interface ProbeRunResult {
  scenario: ScriptedProbeScenario;
  workspaceCwd: string | null;
  preservedWorkspaceStatePath: string | null;
  requests: ProbeJsonlRequest[];
  responses: ProbeJsonlResponse[];
  finalChat: AgentChatReadProjection | null;
  summary: ProbeRunSummary;
  errors: ProbeRunError[];
}

interface SpecCreateOutput {
  specId: number;
}

interface ChatGetPrimaryOutput {
  chatId: number;
}

interface AgentChatReadProjection {
  frontier: { state: string; turnId: number | null };
  turns: AgentChatTurn[];
  nextCommands?: AgentNextCommand[];
}

interface AgentChatTurn {
  id: number;
  question: string;
  answer: string | null;
  options?: AgentTurnOption[];
}

interface AgentTurnOption {
  position: number;
  content: string;
}

interface AgentNextCommand {
  capability: string;
  input?: unknown;
}

interface RunScriptedProbeOptions {
  transport: JsonlTransport;
  scenario: ScriptedProbeScenario;
  scriptedAnswers: string[];
}

export interface ProcessBackedProbeOptions {
  scenario: ScriptedProbeScenario;
  scriptedAnswers: string[];
  outputDir: string;
  spawnProcess?: ProbeProcessSpawner;
  command?: string;
  args?: string[];
  env?: NodeJS.ProcessEnv;
  preserveWorkspaceState?: boolean;
}

export async function runProcessBackedProbe({
  scenario,
  scriptedAnswers,
  outputDir,
  spawnProcess = spawnBrunchAgentProcess,
  command = process.execPath,
  args = [resolve('bin/brunch.js'), 'agent'],
  env = process.env,
  preserveWorkspaceState = false,
}: ProcessBackedProbeOptions): Promise<ProbeRunResult> {
  const workspaceCwd = mkdtempSync(join(tmpdir(), 'brunch-probe-workspace-'));
  const spawned = spawnProcess({ cwd: workspaceCwd, command, args, env });
  const transport = createProcessJsonlTransport(spawned);

  try {
    const result = await runScriptedProbe({ transport, scenario, scriptedAnswers });
    result.workspaceCwd = workspaceCwd;
    if (preserveWorkspaceState) {
      result.preservedWorkspaceStatePath = copyWorkspaceState({ workspaceCwd, outputDir });
    }
    writeProbeArtifacts(outputDir, result);
    return result;
  } finally {
    spawned.endStdin();
  }
}

export function createProcessJsonlTransport(process: SpawnedJsonlProcess): JsonlTransport {
  let buffer = '';
  const pending = new Map<string, (response: ProbeJsonlResponse) => void>();

  process.onStdoutData((chunk) => {
    buffer += chunk;
    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line !== '') {
        const response = JSON.parse(line) as ProbeJsonlResponse;
        if (response.id) {
          pending.get(response.id)?.(response);
          pending.delete(response.id);
        }
      }
      newlineIndex = buffer.indexOf('\n');
    }
  });

  return {
    send(request) {
      return new Promise<ProbeJsonlResponse>((resolveResponse) => {
        pending.set(request.id, resolveResponse);
        process.writeStdin(JSON.stringify(request));
      });
    },
  };
}

export async function runScriptedProbe({
  transport,
  scenario,
  scriptedAnswers,
}: RunScriptedProbeOptions): Promise<ProbeRunResult> {
  const startedAt = Date.now();
  const state: ProbeRunResult = {
    scenario,
    workspaceCwd: null,
    preservedWorkspaceStatePath: null,
    requests: [],
    responses: [],
    finalChat: null,
    summary: { turnsAnswered: 0, finalFrontierState: null, durationMs: 0, questionAnswers: [], errors: [] },
    errors: [],
  };

  const created = await sendExpectingOutput<SpecCreateOutput>(state, transport, {
    id: 'create',
    capability: 'spec.create',
    input: { name: scenario.specName },
  });
  if (!created) {
    return finishRun(state, startedAt);
  }

  const primary = await sendExpectingOutput<ChatGetPrimaryOutput>(state, transport, {
    id: 'primary',
    capability: 'chat.getPrimary',
    input: { specId: created.specId },
  });
  if (!primary) {
    return finishRun(state, startedAt);
  }

  for (let turnIndex = 0; turnIndex < 2; turnIndex += 1) {
    const ready = await sendExpectingOutput<unknown>(state, transport, {
      id: `ready-${turnIndex + 1}`,
      capability: 'chat.ensureReady',
      input: { chatId: primary.chatId },
    });
    if (!ready) {
      return finishRun(state, startedAt);
    }

    const readyRead = await sendExpectingOutput<AgentChatReadProjection>(state, transport, {
      id: `read-${turnIndex * 2 + 1}`,
      capability: 'chat.read',
      input: { chatId: primary.chatId },
    });
    if (!readyRead) {
      return finishRun(state, startedAt);
    }
    state.finalChat = readyRead;
    state.summary.finalFrontierState = readyRead.frontier.state;

    const activeTurn = getActiveTurn(readyRead);
    if (!activeTurn) {
      state.errors.push({
        requestId: `read-${turnIndex * 2 + 1}`,
        capability: 'chat.read',
        code: 'no_answerable_turn',
        message: 'chat.read did not expose an awaiting-response frontier turn',
      });
      return finishRun(state, startedAt);
    }

    const submit = await sendExpectingOutput<unknown>(state, transport, {
      id: `answer-${turnIndex + 1}`,
      capability: 'turn.submitResponse',
      input: {
        chatId: primary.chatId,
        turnId: activeTurn.id,
        response: buildScriptedResponse(activeTurn, scriptedAnswers[turnIndex]),
      },
    });
    if (!submit) {
      return finishRun(state, startedAt);
    }
    state.summary.turnsAnswered += 1;

    const afterAnswerRead = await sendExpectingOutput<AgentChatReadProjection>(state, transport, {
      id: `read-${turnIndex * 2 + 2}`,
      capability: 'chat.read',
      input: { chatId: primary.chatId },
    });
    if (!afterAnswerRead) {
      return finishRun(state, startedAt);
    }
    state.finalChat = afterAnswerRead;
    state.summary.finalFrontierState = afterAnswerRead.frontier.state;
  }

  return finishRun(state, startedAt);
}

async function sendExpectingOutput<T>(
  state: ProbeRunResult,
  transport: JsonlTransport,
  request: ProbeJsonlRequest,
): Promise<T | null> {
  state.requests.push(request);
  const response = await transport.send(request);
  state.responses.push(response);

  if (!response.ok) {
    state.errors.push({
      requestId: request.id,
      capability: request.capability,
      code: response.error.code,
      message: sanitizeProbeErrorMessage(response.error.message),
    });
    return null;
  }

  return response.output as T;
}

function getActiveTurn(read: AgentChatReadProjection): AgentChatTurn | null {
  if (read.frontier.state !== 'awaiting_response' || read.frontier.turnId === null) {
    return null;
  }
  return read.turns.find((turn) => turn.id === read.frontier.turnId) ?? null;
}

function buildScriptedResponse(turn: AgentChatTurn, scriptedAnswer: string | undefined) {
  const firstOption = turn.options?.[0];
  if (firstOption) {
    return { kind: 'select-options' as const, positions: [firstOption.position] };
  }

  return {
    kind: 'free-text' as const,
    freeText: scriptedAnswer?.trim() || `Scripted response to: ${turn.question}`,
  };
}

function finishRun(state: ProbeRunResult, startedAt: number): ProbeRunResult {
  state.summary.durationMs = Date.now() - startedAt;
  state.summary.errors = state.errors;
  state.summary.questionAnswers = extractQuestionAnswers(state.finalChat);
  return state;
}

function extractQuestionAnswers(finalChat: AgentChatReadProjection | null): ProbeQuestionAnswer[] {
  return (
    finalChat?.turns
      .filter((turn) => turn.answer !== null)
      .map((turn) => ({ question: turn.question, answer: turn.answer ?? '' })) ?? []
  );
}

function sanitizeProbeErrorMessage(message: string): string {
  return message
    .split('\n')[0]
    .replace(/(ANTHROPIC_API_KEY=)[^\s]+/gi, '$1[redacted]')
    .replace(/(OPENAI_API_KEY=)[^\s]+/gi, '$1[redacted]')
    .replace(/sk-[a-z0-9_-]+/gi, '[redacted]')
    .slice(0, 300);
}

export function buildProbeArtifactBundle(result: ProbeRunResult): ProbeArtifactBundle {
  const rawJsonlTranscript = result.requests.flatMap((request, index) => [
    { direction: 'request' as const, payload: request },
    { direction: 'response' as const, payload: result.responses[index] ?? null },
  ]);

  return {
    schemaVersion: 1,
    scenario: {
      name: result.scenario.name,
      brief: result.scenario.brief ?? null,
      specName: result.scenario.specName,
    },
    workspace: {
      cwd: result.workspaceCwd,
      preservedStatePath: result.preservedWorkspaceStatePath,
    },
    commandSequence: result.requests.map((request) => request.capability),
    rawJsonlTranscript,
    parsedEvents: result.requests.map((request, index) => ({
      index,
      request,
      response: result.responses[index] ?? null,
    })),
    finalChat: result.finalChat,
    summary: result.summary,
    errors: result.errors,
    environment: { nodeVersion: process.version, platform: process.platform, arch: process.arch },
  };
}

function writeProbeArtifacts(outputDir: string, result: ProbeRunResult): void {
  mkdirSync(outputDir, { recursive: true });
  const bundle = buildProbeArtifactBundle(result);
  const rawJsonl = bundle.rawJsonlTranscript.map((entry) => JSON.stringify(entry)).join('\n');

  writeFileSync(join(outputDir, 'artifact-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  writeFileSync(join(outputDir, 'raw-jsonl.ndjson'), `${rawJsonl}\n`);
  writeFileSync(join(outputDir, 'final-chat.json'), `${JSON.stringify(bundle.finalChat, null, 2)}\n`);
  writeFileSync(join(outputDir, 'summary.json'), `${JSON.stringify(bundle.summary, null, 2)}\n`);
}

function copyWorkspaceState({
  workspaceCwd,
  outputDir,
}: {
  workspaceCwd: string;
  outputDir: string;
}): string {
  const source = join(workspaceCwd, '.brunch');
  const destination = join(outputDir, 'workspace-state');
  mkdirSync(destination, { recursive: true });

  if (existsSync(source)) {
    cpSync(source, join(destination, '.brunch'), { recursive: true });
  }

  return destination;
}

function spawnBrunchAgentProcess({ cwd, command, args, env }: ProbeProcessSpawnOptions): SpawnedJsonlProcess {
  const child = spawn(command, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
  return {
    writeStdin(line) {
      child.stdin.write(`${line}\n`);
    },
    endStdin() {
      child.stdin.end();
    },
    onStdoutData(listener) {
      child.stdout.on('data', (chunk) => listener(chunk.toString()));
    },
    onStderrData(listener) {
      child.stderr.on('data', (chunk) => listener(chunk.toString()));
    },
    onExit(listener) {
      child.on('exit', listener);
    },
  };
}

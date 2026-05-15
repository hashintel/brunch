import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

export interface SimulatedUserEvent {
  turnId: number;
  prompt: string;
  rawModelOutput: string;
  parsedResponse: ProbeTurnResponse | null;
  status: 'parsed' | 'failed';
  error: string | null;
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
  simulatedUserEvents: SimulatedUserEvent[];
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
  simulatedUserEvents: SimulatedUserEvent[];
}

interface SpecCreateOutput {
  specId: number;
}

interface ChatGetPrimaryOutput {
  chatId: number;
}

export interface AgentChatReadProjection {
  frontier: { state: string; turnId: number | null };
  turns: AgentChatTurn[];
  nextCommands?: AgentNextCommand[];
}

export interface AgentChatTurn {
  id: number;
  question: string;
  answer: string | null;
  options?: AgentTurnOption[];
}

export interface AgentTurnOption {
  position: number;
  content: string;
}

export interface AgentNextCommand {
  capability: string;
  input?: unknown;
}

export type ProbeTurnResponse =
  | { kind: 'free-text'; freeText: string }
  | { kind: 'select-options'; positions: number[] };

export interface ProbeResponsePolicyInput {
  scenario: ScriptedProbeScenario;
  chat: AgentChatReadProjection;
  activeTurn: AgentChatTurn;
  priorAnsweredTurns: AgentChatTurn[];
  turnIndex: number;
}

export type ProbeResponsePolicy = (
  input: ProbeResponsePolicyInput,
) => ProbeTurnResponse | Promise<ProbeTurnResponse>;

interface RunScriptedProbeOptions {
  transport: JsonlTransport;
  scenario: ScriptedProbeScenario;
  scriptedAnswers: string[];
  responsePolicy?: ProbeResponsePolicy;
  simulatedUserEvents?: SimulatedUserEvent[];
  turnBudget?: number;
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
  responsePolicy?: ProbeResponsePolicy;
  simulatedUserEvents?: SimulatedUserEvent[];
  turnBudget?: number;
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
  responsePolicy,
  simulatedUserEvents,
  turnBudget,
}: ProcessBackedProbeOptions): Promise<ProbeRunResult> {
  const workspaceCwd = mkdtempSync(join(tmpdir(), 'brunch-probe-workspace-'));
  let spawned: SpawnedJsonlProcess | null = null;

  try {
    spawned = spawnProcess({ cwd: workspaceCwd, command, args, env });
    const transport = createProcessJsonlTransport(spawned);
    const result = await runScriptedProbe({
      transport,
      scenario,
      scriptedAnswers,
      responsePolicy,
      simulatedUserEvents,
      turnBudget,
    });
    result.workspaceCwd = workspaceCwd;
    if (preserveWorkspaceState) {
      result.preservedWorkspaceStatePath = copyWorkspaceState({ workspaceCwd, outputDir });
    }
    writeProbeArtifacts(outputDir, result);
    return result;
  } finally {
    spawned?.endStdin();
    rmSync(workspaceCwd, { recursive: true, force: true });
  }
}

export function createProcessJsonlTransport(
  process: SpawnedJsonlProcess,
  { requestTimeoutMs = 30_000 }: { requestTimeoutMs?: number } = {},
): JsonlTransport {
  let buffer = '';
  const pending = new Map<
    string,
    { resolveResponse: (response: ProbeJsonlResponse) => void; timeout: ReturnType<typeof setTimeout> }
  >();

  function settle(requestId: string, response: ProbeJsonlResponse): void {
    const pendingRequest = pending.get(requestId);
    if (!pendingRequest) {
      return;
    }
    clearTimeout(pendingRequest.timeout);
    pending.delete(requestId);
    pendingRequest.resolveResponse(response);
  }

  function settleAll(error: { code: string; message: string }): void {
    for (const requestId of Array.from(pending.keys())) {
      settle(requestId, { id: requestId, ok: false, error });
    }
  }

  process.onStdoutData((chunk) => {
    buffer += chunk;
    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line !== '') {
        let response: ProbeJsonlResponse;
        try {
          response = JSON.parse(line) as ProbeJsonlResponse;
        } catch {
          settleAll({ code: 'malformed_json', message: 'Malformed JSONL response from child process' });
          newlineIndex = buffer.indexOf('\n');
          continue;
        }

        if (response.id === null) {
          const message = response.ok
            ? 'Unmatched id:null response'
            : `Unmatched id:null response: ${response.error.message}`;
          settleAll({ code: 'protocol_error', message });
        } else {
          settle(response.id, response);
        }
      }
      newlineIndex = buffer.indexOf('\n');
    }
  });

  process.onStderrData?.((chunk) => {
    const message = chunk.trim().split('\n')[0] || 'JSONL child process wrote to stderr';
    settleAll({ code: 'process_stderr', message });
  });

  process.onExit?.((code) => {
    settleAll({ code: 'process_exit', message: `JSONL child process exited with code ${code ?? 'null'}` });
  });

  return {
    send(request) {
      return new Promise<ProbeJsonlResponse>((resolveResponse) => {
        const timeout = setTimeout(() => {
          settle(request.id, {
            id: request.id,
            ok: false,
            error: {
              code: 'request_timeout',
              message: `JSONL child process did not respond within ${requestTimeoutMs}ms`,
            },
          });
        }, requestTimeoutMs);
        pending.set(request.id, { resolveResponse, timeout });
        try {
          process.writeStdin(JSON.stringify(request));
        } catch (error) {
          settle(request.id, {
            id: request.id,
            ok: false,
            error: {
              code: 'stdin_write_failed',
              message: error instanceof Error ? error.message : String(error),
            },
          });
        }
      });
    },
  };
}

export async function runScriptedProbe({
  transport,
  scenario,
  scriptedAnswers,
  responsePolicy = createScriptedResponsePolicy(scriptedAnswers),
  simulatedUserEvents = [],
  turnBudget = 2,
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
    simulatedUserEvents,
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

  for (let turnIndex = 0; turnIndex < turnBudget; turnIndex += 1) {
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

    const policyResponse = await getPolicyResponse(state, responsePolicy, {
      scenario,
      chat: readyRead,
      activeTurn,
      priorAnsweredTurns: readyRead.turns.filter((turn) => turn.answer !== null),
      turnIndex,
    });
    if (!policyResponse) {
      return finishRun(state, startedAt);
    }

    const submit = await sendExpectingOutput<unknown>(state, transport, {
      id: `answer-${turnIndex + 1}`,
      capability: 'turn.submitResponse',
      input: {
        chatId: primary.chatId,
        turnId: activeTurn.id,
        response: policyResponse,
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
  const response = sanitizeProbeJsonlResponse(await transport.send(request));
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

function createScriptedResponsePolicy(scriptedAnswers: string[]): ProbeResponsePolicy {
  return ({ activeTurn, turnIndex }) => buildScriptedResponse(activeTurn, scriptedAnswers[turnIndex]);
}

function buildScriptedResponse(turn: AgentChatTurn, scriptedAnswer: string | undefined): ProbeTurnResponse {
  const firstOption = turn.options?.[0];
  if (firstOption) {
    return { kind: 'select-options', positions: [firstOption.position] };
  }

  return {
    kind: 'free-text',
    freeText: scriptedAnswer?.trim() || `Scripted response to: ${turn.question}`,
  };
}

async function getPolicyResponse(
  state: ProbeRunResult,
  responsePolicy: ProbeResponsePolicy,
  input: ProbeResponsePolicyInput,
): Promise<ProbeTurnResponse | null> {
  try {
    return await responsePolicy(input);
  } catch (error) {
    state.errors.push({
      requestId: `policy-${input.turnIndex + 1}`,
      capability: 'probe.responsePolicy',
      code: 'policy_failed',
      message: sanitizeProbeErrorMessage(error instanceof Error ? error.message : String(error)),
    });
    return null;
  }
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
    { direction: 'response' as const, payload: sanitizeJsonlResponse(result.responses[index] ?? null) },
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
      response: sanitizeJsonlResponse(result.responses[index] ?? null),
    })),
    finalChat: result.finalChat,
    summary: result.summary,
    errors: result.errors,
    simulatedUserEvents: result.simulatedUserEvents,
    environment: { nodeVersion: process.version, platform: process.platform, arch: process.arch },
  };
}

function sanitizeProbeJsonlResponse(response: ProbeJsonlResponse): ProbeJsonlResponse {
  if (response.ok) {
    return response;
  }

  return {
    ...response,
    error: {
      ...response.error,
      message: sanitizeProbeErrorMessage(response.error.message),
    },
  };
}

function sanitizeJsonlResponse(response: ProbeJsonlResponse | null): ProbeJsonlResponse | null {
  return response ? sanitizeProbeJsonlResponse(response) : null;
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

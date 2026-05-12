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

export interface ScriptedProbeScenario {
  name: string;
  specName: string;
}

export interface ProbeRunError {
  requestId: string;
  capability: string;
  code: string;
  message: string;
}

export interface ProbeRunSummary {
  turnsAnswered: number;
  finalFrontierState: string | null;
}

export interface ProbeRunResult {
  scenario: ScriptedProbeScenario;
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

export async function runScriptedProbe({
  transport,
  scenario,
  scriptedAnswers,
}: RunScriptedProbeOptions): Promise<ProbeRunResult> {
  const state: ProbeRunResult = {
    scenario,
    requests: [],
    responses: [],
    finalChat: null,
    summary: { turnsAnswered: 0, finalFrontierState: null },
    errors: [],
  };

  const created = await sendExpectingOutput<SpecCreateOutput>(state, transport, {
    id: 'create',
    capability: 'spec.create',
    input: { name: scenario.specName },
  });
  if (!created) {
    return state;
  }

  const primary = await sendExpectingOutput<ChatGetPrimaryOutput>(state, transport, {
    id: 'primary',
    capability: 'chat.getPrimary',
    input: { specId: created.specId },
  });
  if (!primary) {
    return state;
  }

  for (let turnIndex = 0; turnIndex < 2; turnIndex += 1) {
    const ready = await sendExpectingOutput<unknown>(state, transport, {
      id: `ready-${turnIndex + 1}`,
      capability: 'chat.ensureReady',
      input: { chatId: primary.chatId },
    });
    if (!ready) {
      return state;
    }

    const readyRead = await sendExpectingOutput<AgentChatReadProjection>(state, transport, {
      id: `read-${turnIndex * 2 + 1}`,
      capability: 'chat.read',
      input: { chatId: primary.chatId },
    });
    if (!readyRead) {
      return state;
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
      return state;
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
      return state;
    }
    state.summary.turnsAnswered += 1;

    const afterAnswerRead = await sendExpectingOutput<AgentChatReadProjection>(state, transport, {
      id: `read-${turnIndex * 2 + 2}`,
      capability: 'chat.read',
      input: { chatId: primary.chatId },
    });
    if (!afterAnswerRead) {
      return state;
    }
    state.finalChat = afterAnswerRead;
    state.summary.finalFrontierState = afterAnswerRead.frontier.state;
  }

  return state;
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
      message: response.error.message,
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

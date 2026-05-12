import type {
  ProbeResponsePolicy,
  ProbeResponsePolicyInput,
  ProbeTurnResponse,
  SimulatedUserEvent,
} from './probe-runner.js';

export interface SimulatedUserModelAdapter {
  generateText(prompt: string): Promise<string>;
}

export function createModelBackedUserPolicy({
  model,
  events,
}: {
  model: SimulatedUserModelAdapter;
  events: SimulatedUserEvent[];
}): ProbeResponsePolicy {
  return async (input) => {
    const prompt = renderSimulatedUserPrompt(input);
    const rawModelOutput = await model.generateText(prompt);

    try {
      const parsedResponse = parseSimulatedUserResponse(rawModelOutput, input);
      events.push({
        turnId: input.activeTurn.id,
        prompt,
        rawModelOutput,
        parsedResponse,
        status: 'parsed',
        error: null,
      });
      return parsedResponse;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      events.push({
        turnId: input.activeTurn.id,
        prompt,
        rawModelOutput,
        parsedResponse: null,
        status: 'failed',
        error: message,
      });
      throw error;
    }
  };
}

function renderSimulatedUserPrompt(input: ProbeResponsePolicyInput): string {
  const options = input.activeTurn.options?.length
    ? input.activeTurn.options.map((option) => `${option.position}. ${option.content}`).join('\n')
    : 'No options are available; answer with free text.';
  const priorTurns = input.priorAnsweredTurns.length
    ? input.priorAnsweredTurns.map((turn) => `Q: ${turn.question}\nA: ${turn.answer ?? ''}`).join('\n\n')
    : 'None yet.';

  return [
    'You are simulating the user, not the interviewer.',
    'Answer only as the user described by the scenario. Do not invent product state outside the prompt.',
    'Return exactly one JSON object and no Markdown.',
    '',
    'Allowed response JSON:',
    '- Free text: {"kind":"free-text","freeText":"your answer"}',
    '- Option selection: {"kind":"select-options","positions":[0]}',
    '',
    `Scenario brief: ${input.scenario.brief ?? 'No scenario brief provided.'}`,
    `Specification name: ${input.scenario.specName}`,
    '',
    'Earlier answered turns:',
    priorTurns,
    '',
    'Active question:',
    input.activeTurn.question,
    '',
    'Options:',
    options,
  ].join('\n');
}

function parseSimulatedUserResponse(
  rawModelOutput: string,
  input: ProbeResponsePolicyInput,
): ProbeTurnResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawModelOutput);
  } catch {
    throw new Error('Simulated user returned invalid JSON');
  }

  if (!isRecord(parsed) || typeof parsed.kind !== 'string') {
    throw new Error('Simulated user response did not match an allowed response shape');
  }

  if (parsed.kind === 'free-text') {
    if (typeof parsed.freeText !== 'string' || parsed.freeText.trim() === '') {
      throw new Error('Simulated user free-text response was empty or invalid');
    }
    return { kind: 'free-text', freeText: parsed.freeText };
  }

  if (parsed.kind === 'select-options') {
    if (
      !Array.isArray(parsed.positions) ||
      parsed.positions.some((position) => typeof position !== 'number')
    ) {
      throw new Error('Simulated user option response had invalid positions');
    }
    const allowedPositions = new Set(input.activeTurn.options?.map((option) => option.position) ?? []);
    if (
      parsed.positions.length === 0 ||
      parsed.positions.some((position) => !allowedPositions.has(position))
    ) {
      throw new Error('Simulated user option response selected unavailable positions');
    }
    return { kind: 'select-options', positions: parsed.positions };
  }

  throw new Error('Simulated user response did not match an allowed response shape');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

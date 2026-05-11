import { readUIMessageStream } from 'ai';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { submitTurnResponseRequestSchema } from '@/shared/api-types.js';
import { extractTextFromMessage, structuredQuestionSchema, type BrunchUIMessage } from '@/shared/chat.js';

import { getCapabilityContract, type CapabilityId } from './capability-registry.js';
import { applyChatRouteTransition } from './chat-route-transition.js';
import { createNewSpecification, finalizeTurn, getSpecificationState, type TurnWithOptions } from './core.js';
import type { DB, Turn } from './db.js';
import { getTurn, updateTurn } from './db.js';
import { persistFallbackQuestionText, streamInterviewer } from './interview.js';
import { serializeParts, type AssistantPart } from './parts.js';
import * as schema from './schema.js';
import { materializeTurnArtifacts } from './turn-artifacts.js';
import { submitTurnResponseTransition } from './turn-response-transition.js';

const specCreateInputSchema = z.object({
  name: z.string().trim().min(1),
  mode: z.enum(['greenfield', 'brownfield']).optional(),
});

const specGetStatusInputSchema = z.object({
  specId: z.number().int().positive(),
});

const chatGetPrimaryInputSchema = z.object({
  specId: z.number().int().positive(),
});

const chatReadInputSchema = z.object({
  chatId: z.number().int().positive(),
});

const chatEnsureReadyInputSchema = z.object({
  chatId: z.number().int().positive(),
});

const turnSubmitResponseInputSchema = z.object({
  chatId: z.number().int().positive(),
  turnId: z.number().int().positive(),
  response: submitTurnResponseRequestSchema,
});

const capabilityInputSchemas = {
  'spec.create': specCreateInputSchema,
  'spec.getStatus': specGetStatusInputSchema,
  'chat.getPrimary': chatGetPrimaryInputSchema,
  'chat.read': chatReadInputSchema,
  'chat.ensureReady': chatEnsureReadyInputSchema,
  'turn.submitResponse': turnSubmitResponseInputSchema,
} as const;

export class CapabilityDispatchError extends Error {
  constructor(
    message: string,
    public readonly code: 'unknown_capability' | 'invalid_input' | 'handler_failed',
  ) {
    super(message);
    this.name = 'CapabilityDispatchError';
  }
}

export interface GeneratedAnswerableFrontier {
  question: string;
  assistantParts: AssistantPart[];
}

export interface GenerateAnswerableFrontierInput {
  db: DB;
  turn: Turn;
  activePath: TurnWithOptions[];
  userMessage: string;
}

export type GenerateAnswerableFrontier = (
  input: GenerateAnswerableFrontierInput,
) => Promise<GeneratedAnswerableFrontier>;

export interface CapabilityDispatchContext {
  db: DB;
  generateAnswerableFrontier?: GenerateAnswerableFrontier;
}

export interface DispatchCapabilityInput extends CapabilityDispatchContext {
  capability: string;
  input: unknown;
}

type SpecCreateInput = z.infer<typeof specCreateInputSchema>;
type SpecGetStatusInput = z.infer<typeof specGetStatusInputSchema>;
type ChatGetPrimaryInput = z.infer<typeof chatGetPrimaryInputSchema>;
type ChatReadInput = z.infer<typeof chatReadInputSchema>;
type ChatEnsureReadyInput = z.infer<typeof chatEnsureReadyInputSchema>;
type TurnSubmitResponseInput = z.infer<typeof turnSubmitResponseInputSchema>;
type SpecCreateOutput = ReturnType<typeof createSpecificationFromCapability>;
type SpecGetStatusOutput = ReturnType<typeof getSpecificationStatusFromCapability>;
type ChatGetPrimaryOutput = ReturnType<typeof getPrimaryChatFromCapability>;
type ChatReadOutput = ReturnType<typeof readChatFromCapability>;
type ChatEnsureReadyOutput = Awaited<ReturnType<typeof ensureChatReadyFromCapability>>;
type TurnSubmitResponseOutput = ReturnType<typeof submitTurnResponseFromCapability>;

function parseSpecCreateInput(input: unknown): SpecCreateInput {
  const parsed = specCreateInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new CapabilityDispatchError('Invalid input for capability spec.create', 'invalid_input');
  }
  return parsed.data;
}

function parseSpecGetStatusInput(input: unknown): SpecGetStatusInput {
  const parsed = specGetStatusInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new CapabilityDispatchError('Invalid input for capability spec.getStatus', 'invalid_input');
  }
  return parsed.data;
}

function parseChatGetPrimaryInput(input: unknown): ChatGetPrimaryInput {
  const parsed = chatGetPrimaryInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new CapabilityDispatchError('Invalid input for capability chat.getPrimary', 'invalid_input');
  }
  return parsed.data;
}

function parseChatReadInput(input: unknown): ChatReadInput {
  const parsed = chatReadInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new CapabilityDispatchError('Invalid input for capability chat.read', 'invalid_input');
  }
  return parsed.data;
}

function parseChatEnsureReadyInput(input: unknown): ChatEnsureReadyInput {
  const parsed = chatEnsureReadyInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new CapabilityDispatchError('Invalid input for capability chat.ensureReady', 'invalid_input');
  }
  return parsed.data;
}

function parseTurnSubmitResponseInput(input: unknown): TurnSubmitResponseInput {
  const parsed = turnSubmitResponseInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new CapabilityDispatchError('Invalid input for capability turn.submitResponse', 'invalid_input');
  }
  return parsed.data;
}

function assertExecutableCapability(
  capability: string,
): asserts capability is keyof typeof capabilityInputSchemas {
  try {
    getCapabilityContract(capability as CapabilityId);
  } catch {
    throw new CapabilityDispatchError(`Unknown capability ${capability}`, 'unknown_capability');
  }

  if (!(capability in capabilityInputSchemas)) {
    throw new CapabilityDispatchError(
      `Capability ${capability} has no executable handler`,
      'unknown_capability',
    );
  }
}

function createSpecificationFromCapability(db: DB, input: SpecCreateInput) {
  const specification = createNewSpecification(
    db,
    input.name,
    input.mode === 'brownfield' ? { mode: input.mode } : {},
  );
  return {
    specId: specification.id,
    specification,
  };
}

function getSpecificationStatusFromCapability(db: DB, input: SpecGetStatusInput) {
  const state = getSpecificationState(db, input.specId);
  if (!state) {
    throw new CapabilityDispatchError(`Specification ${input.specId} not found`, 'handler_failed');
  }
  return state;
}

function getPrimaryChatFromCapability(db: DB, input: ChatGetPrimaryInput) {
  const specification = db
    .select({
      id: schema.specification.id,
      primary_chat_id: schema.specification.primary_chat_id,
    })
    .from(schema.specification)
    .where(eq(schema.specification.id, input.specId))
    .get();

  if (!specification) {
    throw new CapabilityDispatchError(`Specification ${input.specId} not found`, 'handler_failed');
  }
  if (!specification.primary_chat_id) {
    throw new CapabilityDispatchError(`Specification ${input.specId} has no primary chat`, 'handler_failed');
  }

  const chat = db
    .select({
      id: schema.chat.id,
      specification_id: schema.chat.specification_id,
      kind: schema.chat.kind,
      active_turn_id: schema.chat.active_turn_id,
    })
    .from(schema.chat)
    .where(eq(schema.chat.id, specification.primary_chat_id))
    .get();

  if (!chat || chat.specification_id !== input.specId) {
    throw new CapabilityDispatchError(
      `Primary chat for specification ${input.specId} not found`,
      'handler_failed',
    );
  }

  return {
    specId: input.specId,
    chatId: chat.id,
    kind: chat.kind,
    activeTurnId: chat.active_turn_id,
  };
}

function getChatById(db: DB, chatId: number) {
  return db
    .select({
      id: schema.chat.id,
      specification_id: schema.chat.specification_id,
      kind: schema.chat.kind,
      active_turn_id: schema.chat.active_turn_id,
    })
    .from(schema.chat)
    .where(eq(schema.chat.id, chatId))
    .get();
}

const INITIAL_INTERVIEWER_PROMPT = 'Begin the grounding interview.';

function getReadyStateForTurn(turn: { question: string; answer: string | null }) {
  if (turn.answer !== null) {
    return 'answered';
  }
  return turn.question.trim() === '' ? 'needs_generation' : 'awaiting_response';
}

async function generateAnswerableFrontierWithInterviewer({
  db,
  turn,
  activePath,
  userMessage,
}: GenerateAnswerableFrontierInput): Promise<GeneratedAnswerableFrontier> {
  const startedAt = Date.now();
  const interviewer = await streamInterviewer(db, turn, activePath, userMessage, turn.phase);
  const stream = interviewer.toUIMessageStream<BrunchUIMessage>({
    sendReasoning: true,
    sendFinish: false,
  });
  let responseMessage: BrunchUIMessage | null = null;
  for await (const message of readUIMessageStream<BrunchUIMessage>({ stream })) {
    responseMessage = message;
  }
  await interviewer.finishReason;

  if (!responseMessage) {
    throw new Error(`Interviewer did not generate content for turn ${turn.id}`);
  }

  const assistantParts = materializeTurnArtifacts({
    phase: turn.phase,
    responseMessage,
    elapsedMs: Date.now() - startedAt,
  });
  const question =
    extractTextFromMessage(responseMessage) || extractQuestionFromAssistantParts(assistantParts);

  return { question, assistantParts };
}

function extractQuestionFromAssistantParts(parts: AssistantPart[]): string {
  const askQuestionPart = parts.find(
    (part): part is Extract<AssistantPart, { type: 'tool-ask_question' }> =>
      part.type === 'tool-ask_question' && 'input' in part,
  );
  if (!askQuestionPart) {
    return '';
  }

  const parsedInput = structuredQuestionSchema.safeParse(askQuestionPart.input);
  return parsedInput.success ? parsedInput.data.question : '';
}

async function persistGeneratedAnswerableFrontier(
  db: DB,
  turn: Turn,
  generated: GeneratedAnswerableFrontier,
): Promise<void> {
  const currentQuestion = getTurn(db, turn.id)?.question ?? '';
  const question =
    generated.question || extractQuestionFromAssistantParts(generated.assistantParts) || currentQuestion;
  if (question.trim() === '') {
    throw new Error(`Interviewer generated an empty question for turn ${turn.id}`);
  }

  persistFallbackQuestionText(db, turn.id, question);
  updateTurn(db, turn.id, {
    assistant_parts: serializeParts(generated.assistantParts),
  });
}

function readChatFromCapability(db: DB, input: ChatReadInput) {
  const chat = getChatById(db, input.chatId);
  if (!chat) {
    throw new CapabilityDispatchError(`Chat ${input.chatId} not found`, 'handler_failed');
  }

  const state = getSpecificationState(db, chat.specification_id);
  if (!state) {
    throw new CapabilityDispatchError(`Specification ${chat.specification_id} not found`, 'handler_failed');
  }

  const currentPhase = state.workflow.phases.grounding.status === 'closed' ? 'design' : 'grounding';
  const activeTurn = state.turns.find((turn) => turn.id === chat.active_turn_id) ?? null;
  const frontier = activeTurn
    ? { state: getReadyStateForTurn(activeTurn), phase: activeTurn.phase, turnId: activeTurn.id }
    : { state: 'idle_no_frontier' as const, phase: currentPhase, turnId: null };
  const nextCommands =
    activeTurn && frontier.state === 'awaiting_response'
      ? [{ capability: 'turn.submitResponse', input: { chatId: chat.id, turnId: activeTurn.id } }]
      : [{ capability: 'chat.ensureReady', input: { chatId: chat.id } }];

  return {
    specification: {
      id: state.specification.id,
      name: state.specification.name,
      mode: state.specification.mode,
    },
    chat: {
      id: chat.id,
      specificationId: chat.specification_id,
      kind: chat.kind,
      activeTurnId: chat.active_turn_id,
    },
    frontier,
    turns: state.turns.map((turn) => ({
      id: turn.id,
      phase: turn.phase,
      kind: turn.turn_kind ?? 'question',
      question: turn.question,
      answer: turn.answer,
      isResolution: Boolean(turn.is_resolution),
      options: turn.options ?? [],
      capturedItems: turn.captured_items ?? [],
    })),
    nextCommands,
  };
}

function submitTurnResponseFromCapability(db: DB, input: TurnSubmitResponseInput) {
  const chat = getChatById(db, input.chatId);
  if (!chat) {
    throw new CapabilityDispatchError(`Chat ${input.chatId} not found`, 'handler_failed');
  }

  const turn = getTurn(db, input.turnId);
  if (!turn) {
    throw new CapabilityDispatchError(`Turn ${input.turnId} not found`, 'handler_failed');
  }
  if (turn.chat_id !== chat.id || turn.specification_id !== chat.specification_id) {
    throw new CapabilityDispatchError(
      `Turn ${input.turnId} does not belong to chat ${input.chatId}`,
      'handler_failed',
    );
  }

  const response = submitTurnResponseTransition({
    db,
    specificationId: chat.specification_id,
    turnId: turn.id,
    request: input.response,
  });

  if (!response.ok) {
    throw new CapabilityDispatchError(response.message, 'handler_failed');
  }

  return {
    chatId: chat.id,
    specId: chat.specification_id,
    turnId: turn.id,
    response,
    nextCommands: [{ capability: 'chat.read', input: { chatId: chat.id } }],
  };
}

async function ensureChatReadyFromCapability(
  db: DB,
  input: ChatEnsureReadyInput,
  generateAnswerableFrontier: GenerateAnswerableFrontier = generateAnswerableFrontierWithInterviewer,
) {
  const chat = getChatById(db, input.chatId);
  if (!chat) {
    throw new CapabilityDispatchError(`Chat ${input.chatId} not found`, 'handler_failed');
  }

  const state = getSpecificationState(db, chat.specification_id);
  if (!state) {
    throw new CapabilityDispatchError(`Specification ${chat.specification_id} not found`, 'handler_failed');
  }

  const activeTurn = state.turns.find((turn) => turn.id === chat.active_turn_id) ?? null;
  if (activeTurn) {
    const activeState = getReadyStateForTurn(activeTurn);
    if (activeState === 'awaiting_response') {
      return {
        chatId: chat.id,
        specId: chat.specification_id,
        state: 'awaiting_response' as const,
        turnId: activeTurn.id,
        nextCommands: [{ capability: 'chat.read', input: { chatId: chat.id } }],
      };
    }

    if (activeState === 'needs_generation') {
      const persistedActiveTurn = getTurn(db, activeTurn.id);
      if (!persistedActiveTurn) {
        throw new CapabilityDispatchError(`Turn ${activeTurn.id} not found`, 'handler_failed');
      }
      const generated = await generateAnswerableFrontier({
        db,
        turn: persistedActiveTurn,
        activePath: state.turns,
        userMessage: INITIAL_INTERVIEWER_PROMPT,
      });
      await persistGeneratedAnswerableFrontier(db, persistedActiveTurn, generated);

      return {
        chatId: chat.id,
        specId: chat.specification_id,
        state: 'awaiting_response' as const,
        turnId: activeTurn.id,
        nextCommands: [{ capability: 'chat.read', input: { chatId: chat.id } }],
      };
    }

    const answeredText = activeTurn.answer ?? '';
    const transition = applyChatRouteTransition(
      { db, specificationId: chat.specification_id },
      {
        kind: 'continue',
        reply: { text: answeredText, parts: [] },
      },
    );
    if (!transition.ok) {
      throw new CapabilityDispatchError(transition.message, 'handler_failed');
    }
    if (transition.kind !== 'interviewer-turn') {
      throw new CapabilityDispatchError(
        `Chat ${chat.id} did not produce an interviewer frontier`,
        'handler_failed',
      );
    }
    finalizeTurn(db, chat.specification_id, transition.prepared.turn.id);
    const generated = await generateAnswerableFrontier({
      db,
      turn: transition.prepared.turn,
      activePath: transition.prepared.activePath,
      userMessage: answeredText,
    });
    await persistGeneratedAnswerableFrontier(db, transition.prepared.turn, generated);

    return {
      chatId: chat.id,
      specId: chat.specification_id,
      state: 'awaiting_response' as const,
      turnId: transition.prepared.turn.id,
      nextCommands: [{ capability: 'chat.read', input: { chatId: chat.id } }],
    };
  }

  const landing = state.landing;
  if (!landing || landing.kind === 'frontier-turn') {
    throw new CapabilityDispatchError(
      `Chat ${chat.id} is not ready for deterministic entry`,
      'handler_failed',
    );
  }

  const request =
    landing.kind === 'kickoff'
      ? { kind: 'phase-entry' as const, phase: landing.phase }
      : { kind: 'phase-continue' as const, phase: landing.phase };
  const transition = applyChatRouteTransition(
    { db, specificationId: chat.specification_id },
    {
      kind: 'phase-entry',
      request,
    },
  );

  if (!transition.ok) {
    throw new CapabilityDispatchError(transition.message, 'handler_failed');
  }
  if (transition.kind !== 'interviewer-turn') {
    throw new CapabilityDispatchError(
      `Chat ${chat.id} did not produce an interviewer frontier`,
      'handler_failed',
    );
  }

  finalizeTurn(db, chat.specification_id, transition.prepared.turn.id);
  const generated = await generateAnswerableFrontier({
    db,
    turn: transition.prepared.turn,
    activePath: transition.prepared.activePath,
    userMessage: INITIAL_INTERVIEWER_PROMPT,
  });
  await persistGeneratedAnswerableFrontier(db, transition.prepared.turn, generated);

  return {
    chatId: chat.id,
    specId: chat.specification_id,
    state: 'awaiting_response' as const,
    turnId: transition.prepared.turn.id,
    nextCommands: [{ capability: 'chat.read', input: { chatId: chat.id } }],
  };
}

export function dispatchCapability(input: {
  db: DB;
  capability: 'spec.create';
  input: unknown;
}): Promise<SpecCreateOutput>;
export function dispatchCapability(input: {
  db: DB;
  capability: 'spec.getStatus';
  input: unknown;
}): Promise<SpecGetStatusOutput>;
export function dispatchCapability(input: {
  db: DB;
  capability: 'chat.getPrimary';
  input: unknown;
}): Promise<ChatGetPrimaryOutput>;
export function dispatchCapability(input: {
  db: DB;
  capability: 'chat.read';
  input: unknown;
}): Promise<ChatReadOutput>;
export function dispatchCapability(input: {
  db: DB;
  capability: 'chat.ensureReady';
  input: unknown;
  generateAnswerableFrontier?: GenerateAnswerableFrontier;
}): Promise<ChatEnsureReadyOutput>;
export function dispatchCapability(input: {
  db: DB;
  capability: 'turn.submitResponse';
  input: unknown;
}): Promise<TurnSubmitResponseOutput>;
export function dispatchCapability(input: DispatchCapabilityInput): Promise<unknown>;
export async function dispatchCapability({
  db,
  capability,
  input,
  generateAnswerableFrontier,
}: DispatchCapabilityInput): Promise<unknown> {
  assertExecutableCapability(capability);

  if (capability === 'spec.create') {
    return createSpecificationFromCapability(db, parseSpecCreateInput(input));
  }

  if (capability === 'spec.getStatus') {
    return getSpecificationStatusFromCapability(db, parseSpecGetStatusInput(input));
  }

  if (capability === 'chat.getPrimary') {
    return getPrimaryChatFromCapability(db, parseChatGetPrimaryInput(input));
  }

  if (capability === 'chat.read') {
    return readChatFromCapability(db, parseChatReadInput(input));
  }

  if (capability === 'chat.ensureReady') {
    return ensureChatReadyFromCapability(db, parseChatEnsureReadyInput(input), generateAnswerableFrontier);
  }

  if (capability === 'turn.submitResponse') {
    return submitTurnResponseFromCapability(db, parseTurnSubmitResponseInput(input));
  }

  throw new CapabilityDispatchError('Capability has no executable handler', 'unknown_capability');
}

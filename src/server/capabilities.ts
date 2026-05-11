import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { getCapabilityContract, type CapabilityId } from './capability-registry.js';
import { createNewSpecification, getSpecificationState } from './core.js';
import type { DB } from './db.js';
import * as schema from './schema.js';

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

const capabilityInputSchemas = {
  'spec.create': specCreateInputSchema,
  'spec.getStatus': specGetStatusInputSchema,
  'chat.getPrimary': chatGetPrimaryInputSchema,
  'chat.read': chatReadInputSchema,
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

export interface CapabilityDispatchContext {
  db: DB;
}

export interface DispatchCapabilityInput extends CapabilityDispatchContext {
  capability: string;
  input: unknown;
}

type SpecCreateInput = z.infer<typeof specCreateInputSchema>;
type SpecGetStatusInput = z.infer<typeof specGetStatusInputSchema>;
type ChatGetPrimaryInput = z.infer<typeof chatGetPrimaryInputSchema>;
type ChatReadInput = z.infer<typeof chatReadInputSchema>;
type SpecCreateOutput = ReturnType<typeof createSpecificationFromCapability>;
type SpecGetStatusOutput = ReturnType<typeof getSpecificationStatusFromCapability>;
type ChatGetPrimaryOutput = ReturnType<typeof getPrimaryChatFromCapability>;
type ChatReadOutput = ReturnType<typeof readChatFromCapability>;

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
    ? { state: 'awaiting_response' as const, phase: activeTurn.phase, turnId: activeTurn.id }
    : { state: 'idle_no_frontier' as const, phase: currentPhase, turnId: null };
  const nextCommands = activeTurn
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
export function dispatchCapability(input: DispatchCapabilityInput): Promise<unknown>;
export async function dispatchCapability({
  db,
  capability,
  input,
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

  throw new CapabilityDispatchError('Capability has no executable handler', 'unknown_capability');
}

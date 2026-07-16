import { Type, type Static, type TSchema } from 'typebox';
import { Value } from 'typebox/value';

import type { SessionPresentationResult } from '../../projections/session/session-presentation.js';
import type { LiveSessionHost, SessionTarget } from '../../session/live-session-host.js';
import { createJsonRpcFailure, createJsonRpcSuccess, jsonRpcRequestId } from '../protocol.js';
import type { RpcMethodContext, RpcMethodDefinition } from './registry.js';
import { NonBlankStringSchema } from './schemas.js';
import {
  INVALID_LIVE_EXCHANGE_ANSWER_MESSAGE,
  NO_PENDING_LIVE_EXCHANGE_MESSAGE,
} from './session-exchange-answer.js';
import { OpenAsksResultSchema } from './session-open-asks.js';

const TargetSchema = Type.Object(
  { specId: Type.Integer({ minimum: 1 }), sessionId: NonBlankStringSchema },
  { additionalProperties: false },
);
const PromptSchema = Type.Object(
  {
    specId: Type.Integer({ minimum: 1 }),
    sessionId: NonBlankStringSchema,
    driverId: NonBlankStringSchema,
    prompt: NonBlankStringSchema,
  },
  { additionalProperties: false },
);
const AnswerSchema = Type.Object(
  {
    specId: Type.Integer({ minimum: 1 }),
    sessionId: NonBlankStringSchema,
    driverId: NonBlankStringSchema,
    exchangeId: NonBlankStringSchema,
    answer: NonBlankStringSchema,
  },
  { additionalProperties: false },
);
const AnyResultSchema = Type.Object({}, { additionalProperties: true });

type TargetParams = Static<typeof TargetSchema>;
type PromptParams = Static<typeof PromptSchema>;
type AnswerParams = Static<typeof AnswerSchema>;

export interface HostedSessionRpcBoundary {
  readonly liveSessions: LiveSessionHost;
  project(target: SessionTarget): Promise<SessionPresentationResult>;
}

function target(params: TargetParams): SessionTarget {
  return { specId: params.specId, sessionId: params.sessionId };
}

function method<P extends TargetParams>(definition: {
  name: string;
  access: 'read' | 'write';
  schema: TSchema;
  resultSchema?: TSchema;
  example: P;
  run(boundary: HostedSessionRpcBoundary, params: P): Promise<unknown> | object;
  refusal?(result: unknown): { readonly code: number; readonly message: string } | undefined;
}): RpcMethodDefinition<RpcMethodContext> {
  return {
    method: definition.name,
    access: definition.access,
    description: `Target-addressed hosted session ${definition.name.split('.').at(-1)}.`,
    paramsSchema: definition.schema,
    resultSchema: definition.resultSchema ?? AnyResultSchema,
    examples: [{ jsonrpc: '2.0', id: 1, method: definition.name, params: definition.example }],
    async handle(context, request) {
      const requestId = jsonRpcRequestId(request);
      if (!context.hostedSession || !Value.Check(definition.schema, request.params)) {
        return createJsonRpcFailure(requestId, -32602, 'Invalid params');
      }
      try {
        const result = await definition.run(context.hostedSession, request.params as P);
        const refusal = definition.refusal?.(result);
        if (refusal) return createJsonRpcFailure(requestId, refusal.code, refusal.message);
        return createJsonRpcSuccess(requestId, result);
      } catch (error) {
        return createJsonRpcFailure(
          requestId,
          -32020,
          error instanceof Error ? error.message : 'Hosted session failure',
        );
      }
    },
  };
}

const exampleTarget = { specId: 1, sessionId: 'session-1' };

export const hostedSessionRpcMethods: readonly RpcMethodDefinition<RpcMethodContext>[] = [
  method({
    name: 'session.open',
    access: 'write',
    schema: TargetSchema,
    example: exampleTarget,
    run: (boundary, params) => boundary.liveSessions.open(target(params)),
  }),
  method({
    name: 'session.close',
    access: 'write',
    schema: TargetSchema,
    example: exampleTarget,
    run: (boundary, params) => boundary.liveSessions.close(target(params)),
  }),
  method({
    name: 'session.presentation',
    access: 'read',
    schema: TargetSchema,
    example: exampleTarget,
    run: (boundary, params) => boundary.project(target(params)),
  }),
  method({
    name: 'session.openAsks',
    access: 'read',
    schema: TargetSchema,
    resultSchema: OpenAsksResultSchema,
    example: exampleTarget,
    run: (boundary, params) => ({ openAsks: boundary.liveSessions.openAsks(target(params)) ?? [] }),
  }),
  method<PromptParams>({
    name: 'session.driveTurn',
    access: 'write',
    schema: PromptSchema,
    example: { ...exampleTarget, driverId: 'browser', prompt: 'Continue.' },
    run: (boundary, params) =>
      boundary.liveSessions.driveTurn(target(params), params.driverId, params.prompt),
  }),
  method<AnswerParams>({
    name: 'session.answerExchange',
    access: 'write',
    schema: AnswerSchema,
    example: { ...exampleTarget, driverId: 'browser', exchangeId: 'ask-1', answer: 'Yes.' },
    run: (boundary, params) =>
      boundary.liveSessions.answerExchange(target(params), params.driverId, params.exchangeId, params.answer),
    refusal(result) {
      if (typeof result !== 'object' || result === null || !('status' in result)) return undefined;
      if (result.status === 'ask_closed') return { code: -32008, message: NO_PENDING_LIVE_EXCHANGE_MESSAGE };
      if (result.status === 'invalid_answer') {
        return { code: -32602, message: INVALID_LIVE_EXCHANGE_ANSWER_MESSAGE };
      }
      return undefined;
    },
  }),
];

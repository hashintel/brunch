import { Type, type Static } from 'typebox';
import { Value } from 'typebox/value';

import type { LiveExchangeAnswerer } from '../../session/live-exchange-broker.js';
import { createJsonRpcFailure, createJsonRpcSuccess, jsonRpcRequestId } from '../protocol.js';
import type { RpcMethodContext, RpcMethodDefinition } from './registry.js';
import { NonBlankStringSchema } from './schemas.js';

export const NO_LIVE_EXCHANGE_ANSWERER_MESSAGE = 'No live exchange answerer is attached';
export const NO_PENDING_LIVE_EXCHANGE_MESSAGE = 'No matching live exchange is pending';
export const INVALID_LIVE_EXCHANGE_ANSWER_MESSAGE = 'Answer does not match the open exchange';

const AnswerExchangeParamsSchema = Type.Object(
  {
    exchangeId: NonBlankStringSchema,
    answer: NonBlankStringSchema,
  },
  { additionalProperties: false },
);

const AnswerExchangeResultSchema = Type.Object(
  {
    status: Type.Literal('completed'),
  },
  { additionalProperties: false },
);

type AnswerExchangeParams = Static<typeof AnswerExchangeParamsSchema>;

export interface SessionExchangeAnswerHandle {
  readonly answerer: LiveExchangeAnswerer;
}

export const sessionExchangeAnswerRpcMethods: readonly RpcMethodDefinition<RpcMethodContext>[] = [
  {
    method: 'session.answerExchange',
    access: 'write',
    description: 'Answer one live in-turn structured exchange through the sidecar answer broker.',
    paramsSchema: AnswerExchangeParamsSchema,
    resultSchema: AnswerExchangeResultSchema,
    examples: [
      {
        jsonrpc: '2.0',
        id: 21,
        method: 'session.answerExchange',
        params: { exchangeId: 'grounding-question', answer: 'We are starting from scratch.' },
      },
    ],
    async handle(context, request) {
      const requestId = jsonRpcRequestId(request);
      if (!Value.Check(AnswerExchangeParamsSchema, request.params)) {
        return createJsonRpcFailure(requestId, -32602, 'Invalid params');
      }
      const handle = context.sessionExchangeAnswer;
      if (!handle) {
        return createJsonRpcFailure(requestId, -32010, NO_LIVE_EXCHANGE_ANSWERER_MESSAGE);
      }
      const params = Value.Parse(AnswerExchangeParamsSchema, request.params) as AnswerExchangeParams;
      const outcome = handle.answerer.submitAnswer(params);
      if (!outcome.submitted) {
        return createJsonRpcFailure(
          requestId,
          outcome.reason === 'invalid_answer' ? -32602 : -32008,
          outcome.reason === 'invalid_answer'
            ? INVALID_LIVE_EXCHANGE_ANSWER_MESSAGE
            : NO_PENDING_LIVE_EXCHANGE_MESSAGE,
        );
      }
      return createJsonRpcSuccess(requestId, { status: 'completed' });
    },
  },
];

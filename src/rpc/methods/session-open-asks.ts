import { Type, type TSchema } from 'typebox';

import type { QuestionnaireQuestion } from '../../exchanges/schemas/index.js';
import { OPEN_ASK_MODES, type LiveAskReader } from '../../session/live-ask-registry.js';
import { createJsonRpcFailure, createJsonRpcSuccess, jsonRpcRequestId } from '../protocol.js';
import type { RpcMethodContext, RpcMethodDefinition } from './registry.js';
import { NoParamsSchema, NonBlankStringSchema } from './schemas.js';

export const NO_LIVE_ASK_REGISTRY_MESSAGE = 'No live ask registry is attached';

// Mirrors the AskQuestionEcho / OpenAsk shapes owned by
// `exchanges/schemas` and `session/live-ask-registry`; hand-authored here only
// as the JSON-RPC discovery/boundary schema, the repo idiom for result shapes.
const AskQuestionEchoProperties = {
  body: NonBlankStringSchema,
  options: Type.Optional(
    Type.Array(
      Type.Object(
        {
          id: NonBlankStringSchema,
          label: NonBlankStringSchema,
          description: Type.Optional(NonBlankStringSchema),
        },
        { additionalProperties: false },
      ),
      { minItems: 1 },
    ),
  ),
  multiple: Type.Optional(Type.Boolean()),
  commentPrompt: Type.Optional(NonBlankStringSchema),
  otherPrompt: Type.Optional(NonBlankStringSchema),
};

const AskQuestionEchoSchema = Type.Object(AskQuestionEchoProperties, { additionalProperties: false });

const QuestionIdSchema = Type.String({ minLength: 1, pattern: '^[A-Za-z0-9_-]+$' });
const QuestionOptionSchema = Type.Object(
  { id: QuestionIdSchema, label: NonBlankStringSchema },
  { additionalProperties: false },
);
const QuestionnaireQuestionSchemas = {
  'free-text': Type.Object(
    {
      id: QuestionIdSchema,
      kind: Type.Literal('free-text'),
      prompt: NonBlankStringSchema,
    },
    { additionalProperties: false },
  ),
  'single-select': Type.Object(
    {
      id: QuestionIdSchema,
      kind: Type.Literal('single-select'),
      prompt: NonBlankStringSchema,
      options: Type.Array(QuestionOptionSchema, { minItems: 1 }),
    },
    { additionalProperties: false },
  ),
  'multi-select': Type.Object(
    {
      id: QuestionIdSchema,
      kind: Type.Literal('multi-select'),
      prompt: NonBlankStringSchema,
      options: Type.Array(QuestionOptionSchema, { minItems: 1 }),
    },
    { additionalProperties: false },
  ),
} satisfies Record<QuestionnaireQuestion['kind'], TSchema>;
const QuestionnaireQuestionSchema = Type.Union(Object.values(QuestionnaireQuestionSchemas));
const QuestionnaireAskQuestionSchema = Type.Object(
  {
    ...AskQuestionEchoProperties,
    questions: Type.Array(QuestionnaireQuestionSchema, { minItems: 1 }),
  },
  { additionalProperties: false },
);

const OpenAskSchema = Type.Object(
  {
    exchangeId: NonBlankStringSchema,
    mode: Type.Union(OPEN_ASK_MODES.map((mode) => Type.Literal(mode))),
    question: Type.Union([QuestionnaireAskQuestionSchema, AskQuestionEchoSchema]),
  },
  { additionalProperties: false },
);

export const OpenAsksResultSchema = Type.Object(
  { openAsks: Type.Array(OpenAskSchema) },
  { additionalProperties: false },
);

export interface SessionOpenAsksHandle {
  readonly reader: LiveAskReader;
}

export const sessionOpenAsksRpcMethods: readonly RpcMethodDefinition<RpcMethodContext>[] = [
  {
    method: 'session.openAsks',
    access: 'read',
    description:
      'Discover every currently-open ask in the live session with its full question payload, read from Brunch-owned live interaction state (no transcript scan).',
    paramsSchema: NoParamsSchema,
    resultSchema: OpenAsksResultSchema,
    examples: [{ jsonrpc: '2.0', id: 22, method: 'session.openAsks' }],
    async handle(context, request) {
      const requestId = jsonRpcRequestId(request);
      if (request.params !== undefined) {
        return createJsonRpcFailure(requestId, -32602, 'Invalid params');
      }
      const handle = context.sessionOpenAsks;
      if (!handle) {
        return createJsonRpcFailure(requestId, -32010, NO_LIVE_ASK_REGISTRY_MESSAGE);
      }
      return createJsonRpcSuccess(requestId, { openAsks: handle.reader.openAsks() });
    },
  },
];

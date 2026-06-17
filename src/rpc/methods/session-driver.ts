import { Type, type Static } from 'typebox';
import { Value } from 'typebox/value';

import { createJsonRpcFailure, createJsonRpcSuccess, jsonRpcRequestId } from '../protocol.js';
import type { RpcMethodContext, RpcMethodDefinition } from './registry.js';
import { NonBlankStringSchema } from './schemas.js';

export type SessionTurnDriverOutcome = { readonly driven: true } | { readonly driven: false };

export interface SessionTurnDriver {
  prompt(input: { readonly text: string }): Promise<SessionTurnDriverOutcome>;
}

export const NO_LIVE_AGENT_SESSION_DRIVER_MESSAGE = 'No live AgentSession driver is attached';

const DriveTurnParamsSchema = Type.Object(
  {
    prompt: NonBlankStringSchema,
  },
  { additionalProperties: false },
);

const DriveTurnResultSchema = Type.Object(
  {
    status: Type.Literal('completed'),
  },
  { additionalProperties: false },
);

type DriveTurnParams = Static<typeof DriveTurnParamsSchema>;

export const sessionDriverRpcMethods: readonly RpcMethodDefinition<RpcMethodContext>[] = [
  {
    method: 'session.driveTurn',
    access: 'write',
    description: 'Drive one plain assistant turn through the live in-process AgentSession.',
    paramsSchema: DriveTurnParamsSchema,
    resultSchema: DriveTurnResultSchema,
    examples: [
      {
        jsonrpc: '2.0',
        id: 20,
        method: 'session.driveTurn',
        params: { prompt: 'Continue from the browser.' },
      },
    ],
    async handle(context, request) {
      const requestId = jsonRpcRequestId(request);
      if (!Value.Check(DriveTurnParamsSchema, request.params)) {
        return createJsonRpcFailure(requestId, -32602, 'Invalid params');
      }
      const driver = context.sessionTurnDriver;
      if (!driver) {
        return createJsonRpcFailure(requestId, -32010, NO_LIVE_AGENT_SESSION_DRIVER_MESSAGE);
      }
      const params = Value.Parse(DriveTurnParamsSchema, request.params) as DriveTurnParams;
      const outcome = await driver.prompt({ text: params.prompt });
      if (!outcome.driven) {
        return createJsonRpcFailure(requestId, -32010, NO_LIVE_AGENT_SESSION_DRIVER_MESSAGE);
      }
      return createJsonRpcSuccess(requestId, { status: 'completed' });
    },
  },
];

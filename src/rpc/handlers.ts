import type { Readable, Writable } from 'node:stream';

import { Type } from 'typebox';

import { openWorkspaceGraphRuntime, type WorkspaceGraphRuntime } from '../graph/workspace-store.js';
import type {
  DefaultWorkspaceCoordinator,
  SpecSessionActivationCoordinator,
} from '../session/workspace-session-coordinator.js';
import { devGraphRpcMethods } from './methods/dev-graph.js';
import { graphRpcMethods } from './methods/graph.js';
import {
  discoverRpcMethods,
  registryByMethod,
  type RpcMethodContext,
  type RpcMethodDefinition,
  type RpcMethodRegistry,
} from './methods/registry.js';
import { NoParamsSchema } from './methods/schemas.js';
import { sessionDriverRpcMethods, type SessionTurnDriver } from './methods/session-driver.js';
import {
  sessionExchangeAnswerRpcMethods,
  type SessionExchangeAnswerHandle,
} from './methods/session-exchange-answer.js';
import { sessionRpcMethods } from './methods/session.js';
import { workspaceRpcMethods } from './methods/workspace.js';
import { createProductUpdateNotification, type ProductUpdatePublisher } from './product-updates.js';
import {
  createJsonRpcFailure,
  createJsonRpcSuccess,
  isJsonRpcRequest,
  jsonRpcRequestId,
  dispatchJsonRpcMessage,
  type JsonRpcResponse,
} from './protocol.js';

export interface RpcHandlers {
  handle(request: unknown): Promise<JsonRpcResponse>;
}

export function createReadOnlyRpcHandlers(options: {
  coordinator: DefaultWorkspaceCoordinator & SpecSessionActivationCoordinator;
  cwd: string;
  productUpdates?: ProductUpdatePublisher;
}): RpcHandlers {
  return createRpcHandlersForRegistry(options, READ_ONLY_RPC_METHOD_REGISTRY);
}

export function createWebSidecarRpcHandlers(options: {
  coordinator: DefaultWorkspaceCoordinator & SpecSessionActivationCoordinator;
  cwd: string;
  productUpdates?: ProductUpdatePublisher;
  sessionTurnDriver?: SessionTurnDriver;
  sessionExchangeAnswer?: SessionExchangeAnswerHandle;
}): RpcHandlers {
  const registry = [
    ...READ_ONLY_RPC_METHOD_REGISTRY,
    ...(options.sessionTurnDriver ? sessionDriverRpcMethods : []),
    ...(options.sessionExchangeAnswer ? sessionExchangeAnswerRpcMethods : []),
  ];
  return createRpcHandlersForRegistry(options, registry);
}

export function createRpcHandlers(options: {
  coordinator: DefaultWorkspaceCoordinator & SpecSessionActivationCoordinator;
  cwd: string;
  productUpdates?: ProductUpdatePublisher;
  devRpc?: boolean;
}): RpcHandlers {
  return createRpcHandlersForRegistry(
    options,
    options.devRpc ? [...FULL_RPC_METHOD_REGISTRY, ...devGraphRpcMethods] : FULL_RPC_METHOD_REGISTRY,
  );
}

function createRpcHandlersForRegistry(
  options: {
    coordinator: DefaultWorkspaceCoordinator & SpecSessionActivationCoordinator;
    cwd: string;
    productUpdates?: ProductUpdatePublisher;
    sessionTurnDriver?: SessionTurnDriver;
    sessionExchangeAnswer?: SessionExchangeAnswerHandle;
  },
  registryDefinitions: RpcMethodRegistry<RpcMethodContext>,
): RpcHandlers {
  let graphRuntime: Promise<WorkspaceGraphRuntime> | null = null;

  const getGraphRuntime = () => {
    graphRuntime ??= openWorkspaceGraphRuntime(options.cwd);
    return graphRuntime;
  };
  const context: RpcMethodContext = {
    ...options,
    getGraphRuntime,
    discoveryRegistry: registryDefinitions,
  };
  const registry = registryByMethod(registryDefinitions);

  return {
    async handle(request) {
      if (!isJsonRpcRequest(request)) {
        return createJsonRpcFailure(null, -32600, 'Invalid Request');
      }

      const requestId = jsonRpcRequestId(request);
      const definition = registry.get(request.method);
      if (definition === undefined) {
        return createJsonRpcFailure(requestId, -32601, 'Method not found');
      }

      return definition.handle(context, request);
    },
  };
}

const FULL_RPC_METHOD_REGISTRY: readonly RpcMethodDefinition<RpcMethodContext>[] = [
  {
    method: 'rpc.discover',
    access: 'read',
    description:
      'List the public Brunch JSON-RPC methods supported by this host with schemas and example calls.',
    paramsSchema: NoParamsSchema,
    resultSchema: Type.Object(
      { methods: Type.Array(Type.Object({}, { additionalProperties: true })) },
      { additionalProperties: false },
    ),
    examples: [{ jsonrpc: '2.0', id: 1, method: 'rpc.discover' }],
    async handle(context, request) {
      const requestId = jsonRpcRequestId(request);
      if (request.params !== undefined) {
        return createJsonRpcFailure(requestId, -32602, 'Invalid params');
      }
      return createJsonRpcSuccess(requestId, discoverRpcMethods(context.discoveryRegistry));
    },
  },
  ...workspaceRpcMethods,
  ...graphRpcMethods,
  ...sessionRpcMethods,
];

const READ_ONLY_RPC_METHOD_REGISTRY = FULL_RPC_METHOD_REGISTRY.filter(
  (definition) => definition.access === 'read',
);

export async function runJsonRpcLineServer(options: {
  input: Readable;
  output: Writable;
  handlers: RpcHandlers;
  productUpdates?: ProductUpdatePublisher;
}): Promise<void> {
  const unsubscribe = options.productUpdates?.subscribe((updates) => {
    options.output.write(`${JSON.stringify(createProductUpdateNotification(updates))}\n`);
  });
  let buffered = '';
  try {
    for await (const chunk of options.input) {
      buffered += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
      let newlineIndex = buffered.indexOf('\n');
      while (newlineIndex >= 0) {
        const line = buffered.slice(0, newlineIndex);
        buffered = buffered.slice(newlineIndex + 1);
        await dispatchJsonRpcLine(line, options);
        newlineIndex = buffered.indexOf('\n');
      }
    }

    if (buffered.length > 0) {
      await dispatchJsonRpcLine(buffered, options);
    }
  } finally {
    unsubscribe?.();
  }
}

async function dispatchJsonRpcLine(
  line: string,
  options: {
    output: Writable;
    handlers: RpcHandlers;
  },
): Promise<void> {
  if (line.trim().length === 0) {
    return;
  }

  const response = await dispatchJsonRpcMessage(line, options.handlers);
  options.output.write(`${JSON.stringify(response)}\n`);
}

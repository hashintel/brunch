import type { WorkspaceGraphRuntime } from '../../graph/workspace-store.js';
import type {
  DefaultWorkspaceCoordinator,
  SpecSessionActivationCoordinator,
} from '../../session/workspace-session-coordinator.js';
import type { ProductUpdatePublisher } from '../product-updates.js';
import type { JsonRpcRequest, JsonRpcResponse } from '../protocol.js';
import type { SessionTurnDriver } from './session-driver.js';
import type { SessionExchangeAnswerHandle } from './session-exchange-answer.js';
import type { SessionOpenAsksHandle } from './session-open-asks.js';

type RpcMethodAccess = 'read' | 'write';

export interface RpcMethodDefinition<Context> {
  readonly method: string;
  readonly access: RpcMethodAccess;
  readonly description: string;
  readonly paramsSchema: unknown;
  readonly resultSchema: unknown;
  readonly examples: readonly JsonRpcRequest[];
  handle(context: Context, request: JsonRpcRequest): Promise<JsonRpcResponse>;
}

export interface RpcMethodContext {
  readonly coordinator: DefaultWorkspaceCoordinator & SpecSessionActivationCoordinator;
  readonly cwd: string;
  readonly productUpdates?: ProductUpdatePublisher;
  readonly sessionTurnDriver?: SessionTurnDriver;
  readonly sessionExchangeAnswer?: SessionExchangeAnswerHandle;
  readonly sessionOpenAsks?: SessionOpenAsksHandle;
  readonly getGraphRuntime: () => Promise<WorkspaceGraphRuntime>;
  readonly discoveryRegistry: readonly RpcMethodDefinition<RpcMethodContext>[];
}

export type RpcMethodRegistry<Context> = readonly RpcMethodDefinition<Context>[];

export type RpcMethodDiscovery = {
  method: string;
  description: string;
  paramsSchema: unknown;
  resultSchema: unknown;
  examples: readonly JsonRpcRequest[];
};

export function discoverRpcMethods<Context>(registry: RpcMethodRegistry<Context>): {
  methods: RpcMethodDiscovery[];
} {
  return {
    methods: registry.map(({ method, description, paramsSchema, resultSchema, examples }) => ({
      method,
      description,
      paramsSchema,
      resultSchema,
      examples,
    })),
  };
}

export function registryByMethod<Context>(
  registry: RpcMethodRegistry<Context>,
): ReadonlyMap<string, RpcMethodDefinition<Context>> {
  const byMethod = new Map<string, RpcMethodDefinition<Context>>();
  for (const definition of registry) {
    if (byMethod.has(definition.method)) {
      throw new Error(`Duplicate RPC method definition: ${definition.method}`);
    }
    byMethod.set(definition.method, definition);
  }
  return byMethod;
}

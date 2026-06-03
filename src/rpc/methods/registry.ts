import type { JsonRpcRequest, JsonRpcResponse } from '../protocol.js';

export type RpcMethodAccess = 'read' | 'write';

export interface RpcMethodDefinition<Context> {
  readonly method: string;
  readonly access: RpcMethodAccess;
  readonly description: string;
  readonly paramsSchema: unknown;
  readonly resultSchema: unknown;
  readonly examples: readonly JsonRpcRequest[];
  handle(context: Context, request: JsonRpcRequest): Promise<JsonRpcResponse>;
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
  return new Map(registry.map((definition) => [definition.method, definition]));
}

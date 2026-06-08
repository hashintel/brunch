import { describe, expect, it } from 'vitest';

import { createJsonRpcSuccess, type JsonRpcRequest, type JsonRpcResponse } from '../protocol.js';
import { type RpcMethodDefinition, registryByMethod } from './registry.js';

function defineMethod(method: string): RpcMethodDefinition<unknown> {
  return {
    method,
    access: 'read',
    description: `method ${method}`,
    paramsSchema: {},
    resultSchema: {},
    examples: [],
    handle: (_context: unknown, request: JsonRpcRequest): Promise<JsonRpcResponse> =>
      Promise.resolve(createJsonRpcSuccess(request.id ?? null, null)),
  };
}

describe('registryByMethod', () => {
  it('indexes definitions by method name', () => {
    const byMethod = registryByMethod([defineMethod('graph.read'), defineMethod('graph.commit')]);
    expect([...byMethod.keys()]).toEqual(['graph.read', 'graph.commit']);
  });

  it('throws on duplicate method names instead of silently last-winning', () => {
    expect(() => registryByMethod([defineMethod('graph.read'), defineMethod('graph.read')])).toThrow(
      'Duplicate RPC method definition: graph.read',
    );
  });
});

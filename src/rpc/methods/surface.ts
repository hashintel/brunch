export const READ_RPC_METHODS = new Set<string>([
  'rpc.discover',
  'workspace.snapshot',
  'workspace.selectionState',
  'session.pendingExchange',
  'session.exchanges',
  'session.runtimeState',
  'graph.overview',
  'graph.nodeNeighborhood',
]);

export type RpcHandlerSurface = 'full' | 'readOnly';

export function methodAllowedOnSurface(method: string, surface: RpcHandlerSurface): boolean {
  return surface === 'full' || READ_RPC_METHODS.has(method);
}

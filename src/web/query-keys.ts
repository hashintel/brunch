export const queryKeys = {
  workspace: {
    state: () => ['workspace.state'] as const,
    selectionState: () => ['workspace.selectionState'] as const,
  },
  session: {
    runtimeState: (target: { specId: number; sessionId: string }) =>
      ['session.runtimeState', target.specId, target.sessionId] as const,
  },
  graph: {
    overview: (specId: number) => ['graph.overview', specId] as const,
    nodeNeighborhood: (specId: number, nodeId: number, hops: number | null = null) =>
      ['graph.nodeNeighborhood', specId, nodeId, hops] as const,
  },
  execute: {
    runs: () => ['execute.runs'] as const,
    run: (runId: string) => ['execute.run', runId] as const,
    runTraceIndex: (specId: number) => ['execute.runTraceIndex', specId] as const,
  },
};

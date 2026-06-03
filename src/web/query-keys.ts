export const queryKeys = {
  workspace: {
    snapshot: () => ['workspace.snapshot'] as const,
  },
  session: {
    transcriptDisplay: (target: { specId: number; sessionId: string } | null) =>
      ['session.transcriptDisplay', target?.specId ?? null, target?.sessionId ?? null] as const,
    runtimeState: (target: { specId: number; sessionId: string }) =>
      ['session.runtimeState', target.specId, target.sessionId] as const,
  },
  graph: {
    overview: (specId: number) => ['graph.overview', specId] as const,
    nodeNeighborhood: (specId: number, nodeId: number, hops: number | null = null) =>
      ['graph.nodeNeighborhood', specId, nodeId, hops] as const,
  },
};

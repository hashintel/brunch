// FE-829 slice 1: shared deterministic dependency-graph normalization.
//
// One Kahn cycle-break policy, used by both `reconcilePlan` (the FE-800
// producer) and the FE-829 `PlanContract` repair, so the two never drift.
// Edges are assumed pre-filtered to existing, non-self ids; this module
// only resolves cycles. When no in-degree-zero node remains, it drops all
// remaining incoming edges of the lex-smallest remaining id (one dropped
// edge reported per edge), which is deterministic across re-runs.

export type DroppedEdge = { sliceId: string; dependsOn: string };

export function breakDependencyCycles(
  nodeIds: ReadonlySet<string>,
  dependsOnById: ReadonlyMap<string, readonly string[]>,
): { dependsOnById: Map<string, string[]>; droppedEdges: DroppedEdge[] } {
  // Filter to existing, non-self targets so the Kahn pass only reasons
  // about real intra-graph edges.
  const working = new Map<string, string[]>();
  for (const id of nodeIds) {
    const deps = (dependsOnById.get(id) ?? []).filter((dep) => dep !== id && nodeIds.has(dep));
    working.set(id, deps);
  }

  const droppedEdges: DroppedEdge[] = [];
  const remaining = new Set(nodeIds);
  while (remaining.size > 0) {
    const ready: string[] = [];
    for (const id of remaining) {
      const deps = working.get(id) ?? [];
      if (deps.every((dep) => !remaining.has(dep))) ready.push(id);
    }
    if (ready.length > 0) {
      for (const id of ready) remaining.delete(id);
      continue;
    }
    // No node is ready → a cycle remains. Break it at the lex-smallest
    // remaining id by dropping its still-incoming edges.
    const target = [...remaining].sort()[0]!;
    const deps = working.get(target) ?? [];
    const kept: string[] = [];
    for (const dep of deps) {
      if (remaining.has(dep)) droppedEdges.push({ sliceId: target, dependsOn: dep });
      else kept.push(dep);
    }
    working.set(target, kept);
    // `target` now has zero remaining in-degree; loop continues.
  }

  return { dependsOnById: working, droppedEdges };
}

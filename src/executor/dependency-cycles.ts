// One shared cycle policy: every consumer (validation, lowering, future repair) must
// agree on which nodes are cyclic, so detection and downstream handling never drift.
export function findDependencyCycleMembers(
  ids: readonly string[],
  dependsOnById: ReadonlyMap<string, readonly string[]>,
): readonly string[] {
  const idSet = new Set(ids);
  const resolved = new Set<string>();
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const id of ids) {
      if (resolved.has(id)) continue;
      const dependencies = dependsOnById.get(id) ?? [];
      const blocked = dependencies.some(
        (dependency) => idSet.has(dependency) && dependency !== id && !resolved.has(dependency),
      );
      const selfLoop = dependencies.includes(id);
      if (!blocked && !selfLoop) {
        resolved.add(id);
        progressed = true;
      }
    }
  }
  return ids.filter((id) => !resolved.has(id));
}

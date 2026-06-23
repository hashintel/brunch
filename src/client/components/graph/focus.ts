/** Pure focus geometry: turns the single focused node id into the derived sets the renderers need. */

/** Minimal edge shape these helpers need: just the wired endpoints. */
export interface FocusEdge {
  source: string;
  target: string;
}

/** Node ids connected to `focusId` by an edge, including `focusId`; empty when nothing is focused. */
export function neighborIds(edges: readonly FocusEdge[], focusId: string | null): Set<string> {
  const ids = new Set<string>();
  if (focusId === null) return ids;
  ids.add(focusId);
  for (const edge of edges) {
    if (edge.source === focusId) ids.add(edge.target);
    else if (edge.target === focusId) ids.add(edge.source);
  }
  return ids;
}

/** Whether an edge touches `focusId` at either endpoint. */
export function isEdgeIncident(edge: FocusEdge, focusId: string | null): boolean {
  if (focusId === null) return false;
  return edge.source === focusId || edge.target === focusId;
}

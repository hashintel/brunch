/**
 * Duplicate-edge precedence policy for the Bilal seed port (throwaway
 * data-prep, co-located with `_port-script.ts`; not product code).
 *
 * When the porter emits edges it can produce two edges that collapse to the
 * same `(source_local_id, target_local_id, category, stance)` key — for
 * example a ported source edge and a synthetic fill-in edge minted by the
 * porter. Earlier the first-emitted edge won, which let a synthetic fill-in
 * hide a ported source edge (and its authored rationale).
 *
 * This module names the contract explicitly: a ported `source` edge outranks
 * a `synthetic` fill-in edge on a key collision, regardless of emission order.
 * Equal-precedence collisions keep the first edge. Every dropped edge is
 * counted so the porter can keep duplicate-drop stats visible.
 */

export type SeedPortEdgeOrigin = 'source' | 'synthetic';

/** The fields that identify an edge for duplicate detection. */
export interface SeedEdgeIdentity {
  readonly category: string;
  readonly source_local_id: number;
  readonly target_local_id: number;
  readonly stance: 'for' | 'against' | null;
}

/** A candidate edge tagged with its origin for precedence resolution. */
export interface OriginTaggedEdge<E extends SeedEdgeIdentity> {
  readonly edge: E;
  readonly origin: SeedPortEdgeOrigin;
}

export interface DedupedSeedEdges<E> {
  readonly edges: E[];
  readonly duplicatesDropped: number;
}

/** Stable duplicate key: endpoints, category, and stance. */
export function seedEdgeKey(edge: SeedEdgeIdentity): string {
  return `${edge.source_local_id}\0${edge.target_local_id}\0${edge.category}\0${edge.stance ?? ''}`;
}

const ORIGIN_PRECEDENCE: Readonly<Record<SeedPortEdgeOrigin, number>> = {
  source: 2,
  synthetic: 1,
};

/**
 * Dedupe candidate edges by precedence. Processes candidates in order; on a
 * key collision keeps the higher-precedence origin (`source` over
 * `synthetic`), replacing an already-kept lower-precedence edge in place when
 * a higher-precedence candidate arrives later. Equal precedence keeps the
 * first edge. Returns the surviving edges in first-seen order plus the number
 * of dropped duplicates.
 */
export function dedupeSeedEdgesByPrecedence<E extends SeedEdgeIdentity>(
  candidates: readonly OriginTaggedEdge<E>[],
): DedupedSeedEdges<E> {
  const slotByKey = new Map<string, number>();
  const edges: E[] = [];
  const originByIndex: SeedPortEdgeOrigin[] = [];
  let duplicatesDropped = 0;

  for (const candidate of candidates) {
    const key = seedEdgeKey(candidate.edge);
    const existingIndex = slotByKey.get(key);
    if (existingIndex === undefined) {
      slotByKey.set(key, edges.length);
      edges.push(candidate.edge);
      originByIndex.push(candidate.origin);
      continue;
    }
    duplicatesDropped += 1;
    const existingOrigin = originByIndex[existingIndex]!;
    if (ORIGIN_PRECEDENCE[candidate.origin] > ORIGIN_PRECEDENCE[existingOrigin]) {
      edges[existingIndex] = candidate.edge;
      originByIndex[existingIndex] = candidate.origin;
    }
  }

  return { edges, duplicatesDropped };
}

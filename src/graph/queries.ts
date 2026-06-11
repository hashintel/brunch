/**
 * Graph read helpers.
 *
 * SPEC: D52-L (graph/ reads db/), D60-L (PULL owns fact selection).
 *
 * These are pure read functions over BrunchDb. They return typed domain objects
 * (GraphNode, GraphEdge), not raw Drizzle rows.
 */

import { and, eq, inArray, or } from 'drizzle-orm';

import type { BrunchDb } from '../db/connection.js';
import * as schema from '../db/schema.js';
import type { Lsn } from './atoms.js';
import type { EdgeCategory, GraphEdge } from './schema/edges.js';
import type { ElicitationGap, GapDisposition, GapPredicate } from './schema/elicitation-gaps.js';
import {
  NODE_KIND_METADATA,
  parseGraphNodeCode,
  type GraphNode,
  type NodeDetail,
  type NodeKind,
  type ReadinessBand,
} from './schema/nodes.js';
import type { ReconciliationNeed, ReconciliationNeedTarget } from './schema/reconciliation-need.js';

export type GraphVisibility = 'active' | 'all';

export interface GraphReadOptions {
  readonly visibility?: GraphVisibility;
}

export interface GraphSlice {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly lsn: Lsn;
}

export type NodeSelector = { readonly id: number } | { readonly code: string };

export interface GetNodesOptions extends GraphReadOptions {
  readonly hops?: number;
}

export type NodeNeighborhood =
  | {
      readonly selector: NodeSelector;
      readonly status: 'found';
      readonly node: GraphNode;
      readonly related: readonly GraphNode[];
      readonly edges: readonly GraphEdge[];
    }
  | {
      readonly selector: NodeSelector;
      readonly status: 'not_found';
      readonly related: readonly [];
      readonly edges: readonly [];
    };

export type EdgeDirection = 'outgoing' | 'incoming' | 'both';

interface EdgePresenceFilter {
  readonly categories?: readonly EdgeCategory[];
  readonly direction?: EdgeDirection;
}

export interface GraphFilter {
  readonly kinds?: readonly NodeKind[];
  readonly bands?: readonly ReadinessBand[];
  readonly hasEdge?: EdgePresenceFilter;
  readonly lacksEdge?: EdgePresenceFilter;
}

function rowToNode(row: typeof schema.nodes.$inferSelect): GraphNode {
  return {
    id: row.id,
    specId: row.spec_id,
    plane: row.plane as GraphNode['plane'],
    kind: row.kind as GraphNode['kind'],
    kindOrdinal: row.kind_ordinal,
    title: row.title,
    ...(row.body != null ? { body: row.body } : {}),
    basis: row.basis as GraphNode['basis'],
    ...(row.source != null ? { source: row.source } : {}),
    ...(row.detail != null ? { detail: JSON.parse(row.detail) as NodeDetail } : {}),
    createdAtLsn: row.created_at_lsn,
    updatedAtLsn: row.updated_at_lsn,
  };
}

function rowToEdge(row: typeof schema.edges.$inferSelect): GraphEdge {
  const base = {
    id: row.id,
    specId: row.spec_id,
    category: row.category as GraphEdge['category'],
    sourceId: row.source_id,
    targetId: row.target_id,
    basis: row.basis as GraphEdge['basis'],
    createdAtLsn: row.created_at_lsn,
    updatedAtLsn: row.updated_at_lsn,
  };
  return row.stance != null
    ? row.rationale != null
      ? {
          ...base,
          stance: row.stance as NonNullable<GraphEdge['stance']>,
          rationale: row.rationale,
        }
      : { ...base, stance: row.stance as NonNullable<GraphEdge['stance']> }
    : row.rationale != null
      ? { ...base, rationale: row.rationale }
      : base;
}

function graphVisibility(options?: GraphReadOptions): GraphVisibility {
  return options?.visibility ?? 'active';
}

function getSupersededIds(db: BrunchDb, specId: number): Set<number> {
  const rows = db
    .select({ targetId: schema.edges.target_id })
    .from(schema.edges)
    .where(and(eq(schema.edges.category, 'supersession'), eq(schema.edges.spec_id, specId)))
    .all();
  return new Set(rows.map((row) => row.targetId));
}

function visibleGraphState(db: BrunchDb, specId: number, visibility: GraphVisibility) {
  const supersededIds = visibility === 'active' ? getSupersededIds(db, specId) : new Set<number>();
  const allNodeRows = db.select().from(schema.nodes).where(eq(schema.nodes.spec_id, specId)).all();
  const visibleNodeRows = allNodeRows.filter((row) => !supersededIds.has(row.id));
  const visibleNodeIds = new Set(visibleNodeRows.map((row) => row.id));
  const allEdgeRows = db.select().from(schema.edges).where(eq(schema.edges.spec_id, specId)).all();
  const visibleEdgeRows = allEdgeRows.filter(
    (edge) =>
      visibility === 'all' || (visibleNodeIds.has(edge.source_id) && visibleNodeIds.has(edge.target_id)),
  );

  return { allNodeRows, visibleNodeRows, visibleNodeIds, allEdgeRows, visibleEdgeRows };
}

function withClock(db: BrunchDb, specId: number, slice: Omit<GraphSlice, 'lsn'>): GraphSlice {
  const clockRow = db.select().from(schema.graphClock).where(eq(schema.graphClock.spec_id, specId)).get();
  return { ...slice, lsn: clockRow?.lsn ?? 0 };
}

export function queryGraph(
  db: BrunchDb,
  specId: number,
  filter: GraphFilter = {},
  options: GraphReadOptions = {},
): GraphSlice {
  const state = visibleGraphState(db, specId, graphVisibility(options));
  const matchingIds = new Set(
    state.visibleNodeRows
      .filter((row) => nodeMatchesFilter(row, state.visibleEdgeRows, filter))
      .map((row) => row.id),
  );
  const nodeRows = state.visibleNodeRows.filter((row) => matchingIds.has(row.id));
  const edgeRows = state.visibleEdgeRows.filter(
    (edge) => matchingIds.has(edge.source_id) && matchingIds.has(edge.target_id),
  );

  return withClock(db, specId, {
    nodes: nodeRows.map(rowToNode),
    edges: edgeRows.map(rowToEdge),
  });
}

export function getNodes(
  db: BrunchDb,
  specId: number,
  selectors: readonly NodeSelector[],
  options: GetNodesOptions = {},
): readonly NodeNeighborhood[] {
  return selectors.map((selector) => getOneNode(db, specId, selector, options));
}

function getOneNode(
  db: BrunchDb,
  specId: number,
  selector: NodeSelector,
  options: GetNodesOptions,
): NodeNeighborhood {
  const nodeId = 'id' in selector ? selector.id : resolveGraphNodeCode(db, specId, selector.code);
  if (nodeId === undefined) return { selector, status: 'not_found', related: [], edges: [] };

  const anchorRow = db
    .select()
    .from(schema.nodes)
    .where(and(eq(schema.nodes.id, nodeId), eq(schema.nodes.spec_id, specId)))
    .get();
  if (!anchorRow) return { selector, status: 'not_found', related: [], edges: [] };

  const visibility = graphVisibility(options);
  const hops = options.hops ?? 0;
  const supersededIds = visibility === 'active' ? getSupersededIds(db, specId) : new Set<number>();
  const visited = new Set<number>([nodeId]);
  let frontier = new Set<number>([nodeId]);
  const edgeIds = new Set<number>();

  for (let hop = 0; hop < hops; hop++) {
    if (frontier.size === 0) break;
    const frontierIds = [...frontier];
    const edgeRows = db
      .select()
      .from(schema.edges)
      .where(
        and(
          eq(schema.edges.spec_id, specId),
          or(inArray(schema.edges.source_id, frontierIds), inArray(schema.edges.target_id, frontierIds)),
        ),
      )
      .all();

    const nextFrontier = new Set<number>();
    for (const edge of edgeRows) {
      edgeIds.add(edge.id);
      for (const peerId of [edge.source_id, edge.target_id]) {
        if (visited.has(peerId)) continue;
        if (visibility === 'active' && supersededIds.has(peerId)) continue;
        visited.add(peerId);
        nextFrontier.add(peerId);
      }
    }
    frontier = nextFrontier;
  }

  const relatedIds = [...visited].filter((id) => id !== nodeId);
  const visibleIds = new Set([nodeId, ...relatedIds]);
  const related = relatedIds.length
    ? db
        .select()
        .from(schema.nodes)
        .where(and(eq(schema.nodes.spec_id, specId), inArray(schema.nodes.id, relatedIds)))
        .all()
        .map(rowToNode)
    : [];
  const edges = edgeIds.size
    ? db
        .select()
        .from(schema.edges)
        .where(and(eq(schema.edges.spec_id, specId), inArray(schema.edges.id, [...edgeIds])))
        .all()
        .filter(
          (edge) =>
            visibility === 'all' || (visibleIds.has(edge.source_id) && visibleIds.has(edge.target_id)),
        )
        .map(rowToEdge)
    : [];

  return { selector, status: 'found', node: rowToNode(anchorRow), related, edges };
}

function nodeMatchesFilter(
  row: typeof schema.nodes.$inferSelect,
  edges: readonly (typeof schema.edges.$inferSelect)[],
  filter: GraphFilter,
): boolean {
  if (filter.kinds && filter.kinds.length > 0 && !filter.kinds.includes(row.kind as NodeKind)) {
    return false;
  }
  if (filter.bands && filter.bands.length > 0) {
    const metadata = NODE_KIND_METADATA[row.kind as NodeKind];
    if (!metadata.readinessBands.some((band) => filter.bands?.includes(band))) return false;
  }
  if (filter.hasEdge && !hasMatchingEdge(row.id, edges, filter.hasEdge)) return false;
  if (filter.lacksEdge && hasMatchingEdge(row.id, edges, filter.lacksEdge)) return false;
  return true;
}

function hasMatchingEdge(
  nodeId: number,
  edges: readonly (typeof schema.edges.$inferSelect)[],
  filter: EdgePresenceFilter,
): boolean {
  const direction = filter.direction ?? 'both';
  return edges.some((edge) => {
    if (filter.categories && filter.categories.length > 0 && !filter.categories.includes(edge.category)) {
      return false;
    }
    if (direction === 'incoming') return edge.target_id === nodeId;
    if (direction === 'outgoing') return edge.source_id === nodeId;
    return edge.source_id === nodeId || edge.target_id === nodeId;
  });
}

export function resolveGraphNodeCode(db: BrunchDb, specId: number, code: string): number | undefined {
  const parsed = parseGraphNodeCode(code);
  if (!parsed) return undefined;
  return db
    .select({ id: schema.nodes.id })
    .from(schema.nodes)
    .where(
      and(
        eq(schema.nodes.spec_id, specId),
        eq(schema.nodes.kind, parsed.kind),
        eq(schema.nodes.kind_ordinal, parsed.kindOrdinal),
      ),
    )
    .get()?.id;
}

export function resolveGraphEdgeId(db: BrunchDb, specId: number, edgeId: number): number | undefined {
  return db
    .select({ id: schema.edges.id })
    .from(schema.edges)
    .where(and(eq(schema.edges.spec_id, specId), eq(schema.edges.id, edgeId)))
    .get()?.id;
}

function rowToReconNeed(row: typeof schema.reconciliationNeed.$inferSelect): ReconciliationNeed {
  const target: ReconciliationNeedTarget =
    row.target_kind === 'edge'
      ? { kind: 'edge', edgeId: row.target_edge_id! }
      : { kind: 'node_pair', aId: row.target_a_id!, bId: row.target_b_id! };

  return {
    id: String(row.id),
    specId: row.spec_id,
    kind: row.kind as ReconciliationNeed['kind'],
    target,
    ...(row.reason != null ? { rationale: row.reason } : {}),
    createdAtLsn: row.created_at_lsn,
    ...(row.resolved_at_lsn != null ? { resolvedAtLsn: row.resolved_at_lsn } : {}),
  };
}

export function getOpenReconciliationNeeds(db: BrunchDb, specId: number): ReconciliationNeed[] {
  const rows = db
    .select()
    .from(schema.reconciliationNeed)
    .where(and(eq(schema.reconciliationNeed.status, 'open'), eq(schema.reconciliationNeed.spec_id, specId)))
    .all();
  return rows.map(rowToReconNeed);
}

function derivePresenceCoverage(
  db: BrunchDb,
  specId: number,
  predicate: Extract<GapPredicate, { kind: 'presence' }>,
): number {
  const rows = db.select().from(schema.nodes).where(eq(schema.nodes.spec_id, specId)).all();
  const count = rows.filter((row) => {
    if (predicate.plane !== undefined && row.plane !== predicate.plane) return false;
    if (predicate.nodeKind !== undefined && row.kind !== predicate.nodeKind) return false;
    if (predicate.band !== undefined) {
      const metadata = NODE_KIND_METADATA[row.kind as NodeKind];
      if (!(metadata.readinessBands as readonly ReadinessBand[]).includes(predicate.band)) return false;
    }
    return true;
  }).length;
  return Math.min(1, count / predicate.minimum);
}

function deriveGapCoverage(
  db: BrunchDb,
  specId: number,
  predicate: GapPredicate,
  disposition: GapDisposition,
): number {
  if (disposition === 'not_applicable' || disposition === 'irrelevant' || disposition === 'answered')
    return 1;
  if (predicate.kind === 'presence') return derivePresenceCoverage(db, specId, predicate);
  return 0;
}

function rowToElicitationGap(db: BrunchDb, row: typeof schema.elicitationGaps.$inferSelect): ElicitationGap {
  type MutableElicitationGap = {
    -readonly [K in keyof ElicitationGap]: ElicitationGap[K];
  };

  const storedDisposition = row.disposition as GapDisposition;
  const predicate = JSON.parse(row.predicate) as GapPredicate;
  if (row.predicate_kind !== predicate.kind) {
    throw new Error(
      `elicitation gap ${row.id} predicate_kind ${row.predicate_kind} does not match predicate JSON kind ${predicate.kind}`,
    );
  }
  if ('nodeKind' in predicate && predicate.nodeKind !== undefined && row.refers_to !== predicate.nodeKind) {
    throw new Error(
      `elicitation gap ${row.id} refers_to ${row.refers_to} does not match predicate nodeKind ${predicate.nodeKind}`,
    );
  }
  const coverage = deriveGapCoverage(db, row.spec_id, predicate, storedDisposition);
  const answered = coverage >= 1;
  const disposition = answered && storedDisposition === 'open' ? 'answered' : storedDisposition;

  const entry: MutableElicitationGap = {
    id: String(row.id),
    specId: row.spec_id,
    refersTo: row.refers_to as ElicitationGap['refersTo'],
    question: row.question,
    rationale: row.rationale,
    disposition,
    basis: row.basis as ElicitationGap['basis'],
    band: row.readiness_band as ElicitationGap['band'],
    predicate,
    importance: row.importance,
    coverage,
    answered,
    createdAtLsn: row.created_at_lsn,
  };

  if (row.plane_affinity != null) {
    entry.planeAffinity = row.plane_affinity as NonNullable<ElicitationGap['planeAffinity']>;
  }

  if (row.lens_affinity != null) {
    entry.lensAffinity = row.lens_affinity as NonNullable<ElicitationGap['lensAffinity']>;
  }

  if (row.arose_from_gap_id != null) {
    entry.aroseFromGapId = String(row.arose_from_gap_id);
  }

  if (row.resolved_by_node_id != null) {
    entry.resolvedByNodeId = row.resolved_by_node_id;
  }

  if (row.disposition_set_at_lsn != null) {
    entry.dispositionSetAtLsn = row.disposition_set_at_lsn;
  }

  return entry;
}

export function getElicitationGaps(db: BrunchDb, specId: number): ElicitationGap[] {
  const rows = db
    .select()
    .from(schema.elicitationGaps)
    .where(eq(schema.elicitationGaps.spec_id, specId))
    .orderBy(schema.elicitationGaps.created_at_lsn, schema.elicitationGaps.id)
    .all();
  return rows.map((row) => rowToElicitationGap(db, row));
}

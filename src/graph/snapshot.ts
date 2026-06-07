/**
 * Graph snapshot readers — cursory overview and node neighborhood.
 *
 * SPEC: I35-L (two detail levels), D52-L (graph/ reads db/)
 *
 * These are pure read functions over BrunchDb. They return typed
 * domain objects (GraphNode, GraphEdge), not raw Drizzle rows.
 * Superseded predecessors (nodes that are targets of a `supersession`
 * edge) are excluded per CATEGORY_POLICY projectionEffect.
 */

import { and, eq, inArray, or } from 'drizzle-orm';

import type { BrunchDb } from '../db/connection.js';
import * as schema from '../db/schema.js';
import type { Lsn } from './atoms.js';
import type { GraphEdge } from './schema/edges.js';
import {
  NODE_KIND_METADATA,
  parseGraphNodeCode,
  type GraphNode,
  type NodeDetail,
  type NodeKind,
  type ReadinessBand,
} from './schema/nodes.js';
import type { ReconciliationNeed, ReconciliationNeedTarget } from './schema/reconciliation-need.js';

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

/** Full-graph cursory overview. */
export type GraphProjection = 'active_context' | 'graph_truth';

/** Full-graph cursory overview. */
export interface GraphOverview {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly lsn: Lsn;
}

export interface GraphOverviewOptions {
  readonly projection?: GraphProjection;
}

export interface GraphSliceByKindsOptions extends GraphOverviewOptions {
  readonly kinds: readonly string[];
}

export interface GraphSliceByReadinessBandsOptions extends GraphOverviewOptions {
  readonly readinessBands: readonly string[];
}

export type RelatedDirection = 'outgoing' | 'incoming' | 'both';

export interface RelatedNodesOptions extends GraphOverviewOptions {
  readonly anchorIds: readonly number[];
  readonly edgeCategory: GraphEdge['category'];
  readonly direction?: RelatedDirection;
  readonly hops?: number;
}

/** Successful neighborhood result. */
export interface NeighborhoodSuccess {
  readonly status: 'success';
  readonly anchor: GraphNode;
  readonly neighbors: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

/** Node not found. */
export interface NeighborhoodNotFound {
  readonly status: 'not_found';
}

export type NeighborhoodResult = NeighborhoodSuccess | NeighborhoodNotFound;

export interface RelatedNodesSuccess {
  readonly status: 'success';
  readonly anchors: readonly GraphNode[];
  readonly relatedNodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

export type RelatedNodesResult = RelatedNodesSuccess | NeighborhoodNotFound;

export interface NeighborhoodOptions {
  /** Number of hops from the anchor node. Defaults to 1. */
  readonly hops?: number;
  readonly projection?: GraphProjection;
}

const DEFAULT_RELATED_HOPS = 1;
const MAX_RELATED_HOPS = 3;

// ---------------------------------------------------------------------------
// Row → domain mapping
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Supersession helpers
// ---------------------------------------------------------------------------

/** Return the set of node ids that are superseded predecessors within a spec. */
function getSupersededIds(db: BrunchDb, specId: number): Set<number> {
  const rows = db
    .select({ targetId: schema.edges.target_id })
    .from(schema.edges)
    .where(and(eq(schema.edges.category, 'supersession'), eq(schema.edges.spec_id, specId)))
    .all();
  return new Set(rows.map((r) => r.targetId));
}

function getProjectionState(db: BrunchDb, specId: number, projection: GraphProjection) {
  const supersededIds = projection === 'active_context' ? getSupersededIds(db, specId) : new Set<number>();
  const allNodeRows = db.select().from(schema.nodes).where(eq(schema.nodes.spec_id, specId)).all();
  const visibleNodeRows = allNodeRows.filter((row) => !supersededIds.has(row.id));
  const visibleNodeIds = new Set(visibleNodeRows.map((row) => row.id));
  const allEdgeRows = db.select().from(schema.edges).where(eq(schema.edges.spec_id, specId)).all();

  return { supersededIds, allNodeRows, visibleNodeRows, visibleNodeIds, allEdgeRows };
}

function getProjectedEdges(
  edgeRows: readonly (typeof schema.edges.$inferSelect)[],
  projection: GraphProjection,
  visibleNodeIds: ReadonlySet<number>,
): GraphEdge[] {
  return edgeRows
    .filter(
      (edge) =>
        projection === 'graph_truth' ||
        (visibleNodeIds.has(edge.source_id) && visibleNodeIds.has(edge.target_id)),
    )
    .map(rowToEdge);
}

function isNodeKind(value: string): value is NodeKind {
  return value in NODE_KIND_METADATA;
}

function getKindsForReadinessBands(readinessBands: readonly string[]): Set<NodeKind> {
  const requestedBands = new Set(
    readinessBands.filter(
      (band): band is ReadinessBand =>
        band === 'grounding' || band === 'elicitation' || band === 'commitment',
    ),
  );

  if (requestedBands.size === 0) {
    return new Set();
  }

  return new Set(
    Object.entries(NODE_KIND_METADATA)
      .filter(([, metadata]) => metadata.readinessBands.some((band) => requestedBands.has(band)))
      .map(([kind]) => kind as NodeKind),
  );
}

function buildGraphSlice(
  projectionState: ReturnType<typeof getProjectionState>,
  projection: GraphProjection,
  matchingNodeIds: ReadonlySet<number>,
): GraphOverview {
  const visibleNodeRows = projectionState.visibleNodeRows.filter((row) => matchingNodeIds.has(row.id));
  const visibleNodeIds = new Set(visibleNodeRows.map((row) => row.id));
  const edgeRows = projectionState.allEdgeRows.filter(
    (edge) => visibleNodeIds.has(edge.source_id) && visibleNodeIds.has(edge.target_id),
  );

  return {
    nodes: visibleNodeRows.map(rowToNode),
    edges: getProjectedEdges(edgeRows, projection, visibleNodeIds),
    nodeCount: visibleNodeRows.length,
    edgeCount: edgeRows.length,
    lsn: 0,
  };
}

function withClock(db: BrunchDb, specId: number, overview: Omit<GraphOverview, 'lsn'>): GraphOverview {
  const clockRow = db.select().from(schema.graphClock).where(eq(schema.graphClock.spec_id, specId)).get();
  return {
    ...overview,
    lsn: clockRow?.lsn ?? 0,
  };
}

// ---------------------------------------------------------------------------
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

// getGraphOverview
// ---------------------------------------------------------------------------

/**
 * Cursory selected-spec graph overview (D61-L).
 *
 * Returns all accepted nodes and edges for the given spec with current LSN.
 * Superseded predecessors are excluded from the node list per
 * CATEGORY_POLICY.supersession.projectionEffect.
 */
export function getGraphOverview(
  db: BrunchDb,
  specId: number,
  options: GraphOverviewOptions = {},
): GraphOverview {
  const projection = options.projection ?? 'active_context';
  const projectionState = getProjectionState(db, specId, projection);
  const nodes = projectionState.visibleNodeRows.map(rowToNode);
  const edges = getProjectedEdges(projectionState.allEdgeRows, projection, projectionState.visibleNodeIds);

  return withClock(db, specId, {
    nodes,
    edges,
    nodeCount: nodes.length,
    edgeCount: edges.length,
  });
}

export function getGraphSliceByKinds(
  db: BrunchDb,
  specId: number,
  options: GraphSliceByKindsOptions,
): GraphOverview {
  const projection = options.projection ?? 'active_context';
  const requestedKinds = new Set(options.kinds.filter(isNodeKind));
  if (requestedKinds.size === 0) {
    return withClock(db, specId, { nodes: [], edges: [], nodeCount: 0, edgeCount: 0 });
  }

  const projectionState = getProjectionState(db, specId, projection);
  const matchingNodeIds = new Set(
    projectionState.visibleNodeRows
      .filter((row) => requestedKinds.has(row.kind as NodeKind))
      .map((row) => row.id),
  );

  return withClock(db, specId, buildGraphSlice(projectionState, projection, matchingNodeIds));
}

export function getGraphSliceByReadinessBands(
  db: BrunchDb,
  specId: number,
  options: GraphSliceByReadinessBandsOptions,
): GraphOverview {
  const projection = options.projection ?? 'active_context';
  const matchingKinds = getKindsForReadinessBands(options.readinessBands);
  if (matchingKinds.size === 0) {
    return withClock(db, specId, { nodes: [], edges: [], nodeCount: 0, edgeCount: 0 });
  }

  const projectionState = getProjectionState(db, specId, projection);
  const matchingNodeIds = new Set(
    projectionState.visibleNodeRows
      .filter((row) => matchingKinds.has(row.kind as NodeKind))
      .map((row) => row.id),
  );

  return withClock(db, specId, buildGraphSlice(projectionState, projection, matchingNodeIds));
}

export function getRelatedNodes(
  db: BrunchDb,
  specId: number,
  options: RelatedNodesOptions,
): RelatedNodesResult {
  const projection = options.projection ?? 'active_context';
  const direction = options.direction ?? 'both';
  const hops = Math.max(
    DEFAULT_RELATED_HOPS,
    Math.min(options.hops ?? DEFAULT_RELATED_HOPS, MAX_RELATED_HOPS),
  );

  const anchorRows = db
    .select()
    .from(schema.nodes)
    .where(and(eq(schema.nodes.spec_id, specId), inArray(schema.nodes.id, [...options.anchorIds])))
    .all();

  if (anchorRows.length !== options.anchorIds.length) {
    return { status: 'not_found' };
  }

  const projectionState = getProjectionState(db, specId, projection);
  const hiddenNodeIds = new Set(
    projectionState.allNodeRows
      .filter((row) => !projectionState.visibleNodeIds.has(row.id))
      .map((row) => row.id),
  );
  const anchorIds = new Set(options.anchorIds);
  const visited = new Set<number>(options.anchorIds);
  let frontier = new Set<number>(options.anchorIds);
  const collectedRelatedIds = new Set<number>();
  const collectedEdgeIds = new Set<number>();

  for (let hop = 0; hop < hops; hop++) {
    if (frontier.size === 0) break;

    const frontierIds = [...frontier];
    const edgeRows = db
      .select()
      .from(schema.edges)
      .where(
        and(
          eq(schema.edges.spec_id, specId),
          eq(schema.edges.category, options.edgeCategory),
          direction === 'outgoing'
            ? inArray(schema.edges.source_id, frontierIds)
            : direction === 'incoming'
              ? inArray(schema.edges.target_id, frontierIds)
              : or(
                  inArray(schema.edges.source_id, frontierIds),
                  inArray(schema.edges.target_id, frontierIds),
                ),
        ),
      )
      .all();

    const nextFrontier = new Set<number>();
    for (const edge of edgeRows) {
      const candidateIds =
        direction === 'outgoing'
          ? [edge.target_id]
          : direction === 'incoming'
            ? [edge.source_id]
            : frontier.has(edge.source_id)
              ? [edge.target_id]
              : frontier.has(edge.target_id)
                ? [edge.source_id]
                : [edge.source_id, edge.target_id];

      for (const candidateId of candidateIds) {
        if (candidateId === edge.source_id && !frontier.has(edge.target_id) && direction === 'both') continue;
        if (hiddenNodeIds.has(candidateId) && !anchorIds.has(candidateId)) continue;

        collectedEdgeIds.add(edge.id);
        if (!visited.has(candidateId)) {
          visited.add(candidateId);
          if (!anchorIds.has(candidateId)) {
            collectedRelatedIds.add(candidateId);
          }
          nextFrontier.add(candidateId);
        }
      }
    }
    frontier = nextFrontier;
  }

  const visibleIds = new Set([...anchorIds, ...collectedRelatedIds]);
  const nodesById = new Map(
    db
      .select()
      .from(schema.nodes)
      .where(and(eq(schema.nodes.spec_id, specId), inArray(schema.nodes.id, [...visibleIds])))
      .all()
      .map((row) => [row.id, rowToNode(row)] as const),
  );

  const edges = db
    .select()
    .from(schema.edges)
    .where(and(eq(schema.edges.spec_id, specId), inArray(schema.edges.id, [...collectedEdgeIds])))
    .all()
    .filter((edge) => visibleIds.has(edge.source_id) && visibleIds.has(edge.target_id))
    .map(rowToEdge);

  return {
    status: 'success',
    anchors: options.anchorIds.map((anchorId) => nodesById.get(anchorId)!).filter(Boolean),
    relatedNodes: [...collectedRelatedIds].map((nodeId) => nodesById.get(nodeId)!).filter(Boolean),
    edges,
  };
}

// ---------------------------------------------------------------------------
// getNodeNeighborhood
// ---------------------------------------------------------------------------

/**
 * Neighborhood snapshot around a given node, scoped to a single spec (D61-L).
 *
 * Returns `not_found` if the anchor does not exist or belongs to a different
 * spec. Returns the anchor node, all reachable same-spec neighbors within
 * `hops` distance (default 1), and the edges connecting them. Superseded
 * predecessors are excluded from neighbors (unless the predecessor is the
 * anchor itself).
 */
export function getNodeNeighborhood(
  db: BrunchDb,
  specId: number,
  nodeId: number,
  options?: NeighborhoodOptions,
): NeighborhoodResult {
  const hops = options?.hops ?? 1;
  const projection = options?.projection ?? 'active_context';

  // Verify anchor exists in the requested spec
  const anchorRow = db
    .select()
    .from(schema.nodes)
    .where(and(eq(schema.nodes.id, nodeId), eq(schema.nodes.spec_id, specId)))
    .get();

  if (!anchorRow) {
    return { status: 'not_found' };
  }

  const supersededIds = projection === 'active_context' ? getSupersededIds(db, specId) : new Set<number>();
  const anchor = rowToNode(anchorRow);

  // BFS traversal: collect reachable node ids within hop distance.
  // Edges are spec-scoped, so endpoints discovered here are also spec-scoped.
  const visited = new Set<number>([nodeId]);
  let frontier = new Set<number>([nodeId]);
  const collectedEdgeIds = new Set<number>();

  for (let hop = 0; hop < hops; hop++) {
    if (frontier.size === 0) break;

    // Find all edges touching frontier nodes (within this spec)
    const frontierArr = [...frontier];
    const edgeRows = db
      .select()
      .from(schema.edges)
      .where(
        and(
          eq(schema.edges.spec_id, specId),
          or(inArray(schema.edges.source_id, frontierArr), inArray(schema.edges.target_id, frontierArr)),
        ),
      )
      .all();

    const nextFrontier = new Set<number>();
    for (const edge of edgeRows) {
      collectedEdgeIds.add(edge.id);
      for (const peerId of [edge.source_id, edge.target_id]) {
        if (!visited.has(peerId)) {
          // Exclude superseded predecessors (unless it's the anchor)
          if (supersededIds.has(peerId) && peerId !== nodeId) continue;
          visited.add(peerId);
          nextFrontier.add(peerId);
        }
      }
    }
    frontier = nextFrontier;
  }

  // Fetch neighbor nodes (exclude anchor) — restrict to same spec defensively
  const neighborIds = [...visited].filter((id) => id !== nodeId);
  const neighborNodes: GraphNode[] = [];
  const visibleIds = new Set([nodeId, ...neighborIds]);
  if (neighborIds.length > 0) {
    const rows = db
      .select()
      .from(schema.nodes)
      .where(and(inArray(schema.nodes.id, neighborIds), eq(schema.nodes.spec_id, specId)))
      .all();
    neighborNodes.push(...rows.map(rowToNode));
  }

  // Fetch collected edges
  const edgeIdArr = [...collectedEdgeIds];
  const edgeNodes: GraphEdge[] = [];
  if (edgeIdArr.length > 0) {
    const rows = db.select().from(schema.edges).where(inArray(schema.edges.id, edgeIdArr)).all();
    edgeNodes.push(
      ...rows
        .filter(
          (row) =>
            projection === 'graph_truth' || (visibleIds.has(row.source_id) && visibleIds.has(row.target_id)),
        )
        .map(rowToEdge),
    );
  }

  return {
    status: 'success',
    anchor,
    neighbors: neighborNodes,
    edges: edgeNodes,
  };
}

// ---------------------------------------------------------------------------
// getOpenReconciliationNeeds
// ---------------------------------------------------------------------------

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

/**
 * Return all open (unresolved) reconciliation needs for a single spec.
 */
export function getOpenReconciliationNeeds(db: BrunchDb, specId: number): ReconciliationNeed[] {
  const rows = db
    .select()
    .from(schema.reconciliationNeed)
    .where(and(eq(schema.reconciliationNeed.status, 'open'), eq(schema.reconciliationNeed.spec_id, specId)))
    .all();
  return rows.map(rowToReconNeed);
}

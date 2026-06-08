/**
 * Graph read helpers — cursory overview and node neighborhood.
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
import type { ElicitationBacklogEntry } from './schema/elicitation-backlog.js';
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

/** Visibility policy for graph reads. */
export type GraphShow = 'active' | 'all';

/** Full-graph cursory overview. */
export interface GraphOverview {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly lsn: Lsn;
}

export interface GraphOverviewOptions {
  readonly show?: GraphShow;
}

export type NodeSelector = { readonly id: number } | { readonly code: string };

export interface GetNodesOptions {
  /** Number of traversal hops from each found node. Defaults to 0. */
  readonly hops?: number;
  readonly show?: GraphShow;
}

export type NodeReadResult =
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

export interface GraphSliceByKindsOptions extends GraphOverviewOptions {
  readonly kinds: readonly string[];
}

export interface GraphSliceByReadinessBandsOptions extends GraphOverviewOptions {
  readonly readinessBands: readonly string[];
}

export interface GraphGapsOptions extends GraphOverviewOptions {
  readonly kinds?: readonly string[];
  readonly readinessBands?: readonly string[];
  readonly absentEdgeCategory: GraphEdge['category'];
  readonly direction?: RelatedDirection;
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
  readonly show?: GraphShow;
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

function getProjectionState(db: BrunchDb, specId: number, show: GraphShow) {
  const supersededIds = show === 'active' ? getSupersededIds(db, specId) : new Set<number>();
  const allNodeRows = db.select().from(schema.nodes).where(eq(schema.nodes.spec_id, specId)).all();
  const visibleNodeRows = allNodeRows.filter((row) => !supersededIds.has(row.id));
  const visibleNodeIds = new Set(visibleNodeRows.map((row) => row.id));
  const allEdgeRows = db.select().from(schema.edges).where(eq(schema.edges.spec_id, specId)).all();

  return { supersededIds, allNodeRows, visibleNodeRows, visibleNodeIds, allEdgeRows };
}

function getProjectedEdges(
  edgeRows: readonly (typeof schema.edges.$inferSelect)[],
  show: GraphShow,
  visibleNodeIds: ReadonlySet<number>,
): GraphEdge[] {
  return edgeRows
    .filter(
      (edge) => show === 'all' || (visibleNodeIds.has(edge.source_id) && visibleNodeIds.has(edge.target_id)),
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

function getMatchingNodeIds(
  projectionState: ReturnType<typeof getProjectionState>,
  options: {
    readonly kinds?: readonly string[];
    readonly readinessBands?: readonly string[];
  },
): Set<number> {
  const requestedKinds = new Set((options.kinds ?? []).filter(isNodeKind));
  const bandKinds = getKindsForReadinessBands(options.readinessBands ?? []);
  const matchingKinds = new Set<NodeKind>([...requestedKinds, ...bandKinds]);

  if (matchingKinds.size === 0) {
    return new Set();
  }

  return new Set(
    projectionState.visibleNodeRows
      .filter((row) => matchingKinds.has(row.kind as NodeKind))
      .map((row) => row.id),
  );
}

function buildGraphSlice(
  projectionState: ReturnType<typeof getProjectionState>,
  show: GraphShow,
  matchingNodeIds: ReadonlySet<number>,
): GraphOverview {
  const visibleNodeRows = projectionState.visibleNodeRows.filter((row) => matchingNodeIds.has(row.id));
  const visibleNodeIds = new Set(visibleNodeRows.map((row) => row.id));
  const edgeRows = projectionState.allEdgeRows.filter(
    (edge) => visibleNodeIds.has(edge.source_id) && visibleNodeIds.has(edge.target_id),
  );

  const nodes = visibleNodeRows.map(rowToNode);
  const edges = getProjectedEdges(edgeRows, show, visibleNodeIds);
  return {
    nodes,
    edges,
    nodeCount: nodes.length,
    edgeCount: edges.length,
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
  const show = options.show ?? 'active';
  const projectionState = getProjectionState(db, specId, show);
  const nodes = projectionState.visibleNodeRows.map(rowToNode);
  const edges = getProjectedEdges(projectionState.allEdgeRows, show, projectionState.visibleNodeIds);

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
  const show = options.show ?? 'active';
  const projectionState = getProjectionState(db, specId, show);
  const matchingNodeIds = getMatchingNodeIds(projectionState, { kinds: options.kinds });

  if (matchingNodeIds.size === 0) {
    return withClock(db, specId, { nodes: [], edges: [], nodeCount: 0, edgeCount: 0 });
  }

  return withClock(db, specId, buildGraphSlice(projectionState, show, matchingNodeIds));
}

export function getGraphSliceByReadinessBands(
  db: BrunchDb,
  specId: number,
  options: GraphSliceByReadinessBandsOptions,
): GraphOverview {
  const show = options.show ?? 'active';
  const projectionState = getProjectionState(db, specId, show);
  const matchingNodeIds = getMatchingNodeIds(projectionState, {
    readinessBands: options.readinessBands,
  });

  if (matchingNodeIds.size === 0) {
    return withClock(db, specId, { nodes: [], edges: [], nodeCount: 0, edgeCount: 0 });
  }

  return withClock(db, specId, buildGraphSlice(projectionState, show, matchingNodeIds));
}

export function getGraphGaps(db: BrunchDb, specId: number, options: GraphGapsOptions): GraphOverview {
  const show = options.show ?? 'active';
  const direction = options.direction ?? 'both';
  const projectionState = getProjectionState(db, specId, show);
  const baseNodeIds = getMatchingNodeIds(projectionState, {
    ...(options.kinds != null ? { kinds: options.kinds } : {}),
    ...(options.readinessBands != null ? { readinessBands: options.readinessBands } : {}),
  });

  if (baseNodeIds.size === 0) {
    return withClock(db, specId, { nodes: [], edges: [], nodeCount: 0, edgeCount: 0 });
  }

  const nodesWithVisibleEdges = new Set<number>();
  for (const edge of projectionState.allEdgeRows) {
    const sourceVisible = projectionState.visibleNodeIds.has(edge.source_id);
    const targetVisible = projectionState.visibleNodeIds.has(edge.target_id);
    if (!sourceVisible || !targetVisible) {
      continue;
    }
    if (edge.category !== options.absentEdgeCategory) {
      continue;
    }
    if (direction === 'outgoing' || direction === 'both') {
      if (baseNodeIds.has(edge.source_id)) {
        nodesWithVisibleEdges.add(edge.source_id);
      }
    }
    if (direction === 'incoming' || direction === 'both') {
      if (baseNodeIds.has(edge.target_id)) {
        nodesWithVisibleEdges.add(edge.target_id);
      }
    }
  }

  const gapNodeIds = new Set([...baseNodeIds].filter((nodeId) => !nodesWithVisibleEdges.has(nodeId)));
  return withClock(db, specId, buildGraphSlice(projectionState, show, gapNodeIds));
}

export function getRelatedNodes(
  db: BrunchDb,
  specId: number,
  options: RelatedNodesOptions,
): RelatedNodesResult {
  const show = options.show ?? 'active';
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

  const projectionState = getProjectionState(db, specId, show);
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
// getNodes
// ---------------------------------------------------------------------------

export function getNodes(
  db: BrunchDb,
  specId: number,
  selectors: readonly NodeSelector[],
  options: GetNodesOptions = {},
): readonly NodeReadResult[] {
  return selectors.map((selector) => getOneNode(db, specId, selector, options));
}

function getOneNode(
  db: BrunchDb,
  specId: number,
  selector: NodeSelector,
  options: GetNodesOptions,
): NodeReadResult {
  const nodeId = 'id' in selector ? selector.id : resolveGraphNodeCode(db, specId, selector.code);
  if (nodeId === undefined) {
    return { selector, status: 'not_found', related: [], edges: [] };
  }

  const anchorRow = db
    .select()
    .from(schema.nodes)
    .where(and(eq(schema.nodes.id, nodeId), eq(schema.nodes.spec_id, specId)))
    .get();

  if (!anchorRow) {
    return { selector, status: 'not_found', related: [], edges: [] };
  }

  const show = options.show ?? 'active';
  const hops = options.hops ?? 0;
  const anchor = rowToNode(anchorRow);
  const supersededIds = show === 'active' ? getSupersededIds(db, specId) : new Set<number>();
  const visited = new Set<number>([nodeId]);
  let frontier = new Set<number>([nodeId]);
  const collectedEdgeIds = new Set<number>();

  for (let hop = 0; hop < hops; hop++) {
    if (frontier.size === 0) break;
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
          if (supersededIds.has(peerId) && peerId !== nodeId) continue;
          visited.add(peerId);
          nextFrontier.add(peerId);
        }
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
        .where(and(inArray(schema.nodes.id, relatedIds), eq(schema.nodes.spec_id, specId)))
        .all()
        .map(rowToNode)
    : [];
  const edgeIds = [...collectedEdgeIds];
  const edges = edgeIds.length
    ? db
        .select()
        .from(schema.edges)
        .where(and(eq(schema.edges.spec_id, specId), inArray(schema.edges.id, edgeIds)))
        .all()
        .filter((row) => show === 'all' || (visibleIds.has(row.source_id) && visibleIds.has(row.target_id)))
        .map(rowToEdge)
    : [];

  return { selector, status: 'found', node: anchor, related, edges };
}

// ---------------------------------------------------------------------------
// getNodeNeighborhood
// ---------------------------------------------------------------------------

/**
 * Neighborhood read around a given node, scoped to a single spec (D61-L).
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
  const [result] = getNodes(db, specId, [{ id: nodeId }], {
    hops: options?.hops ?? 1,
    show: options?.show ?? 'active',
  });
  if (!result || result.status === 'not_found') {
    return { status: 'not_found' };
  }
  return {
    status: 'success',
    anchor: result.node,
    neighbors: result.related,
    edges: result.edges,
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

function rowToElicitationBacklogEntry(
  row: typeof schema.elicitationBacklog.$inferSelect,
): ElicitationBacklogEntry {
  type MutableElicitationBacklogEntry = {
    -readonly [K in keyof ElicitationBacklogEntry]: ElicitationBacklogEntry[K];
  };

  const entry: MutableElicitationBacklogEntry = {
    id: String(row.id),
    specId: row.spec_id,
    kind: row.kind,
    question: row.question,
    status: row.status as ElicitationBacklogEntry['status'],
    basis: row.basis as ElicitationBacklogEntry['basis'],
    readinessBand: row.readiness_band as ElicitationBacklogEntry['readinessBand'],
    createdAtLsn: row.created_at_lsn,
  };

  if (row.plane_affinity != null) {
    entry.planeAffinity = row.plane_affinity as NonNullable<ElicitationBacklogEntry['planeAffinity']>;
  }

  if (row.lens_affinity != null) {
    entry.lensAffinity = row.lens_affinity as NonNullable<ElicitationBacklogEntry['lensAffinity']>;
  }

  if (row.arose_from_entry_id != null) {
    entry.aroseFromEntryId = String(row.arose_from_entry_id);
  }

  if (row.resolved_by_node_id != null) {
    entry.resolvedByNodeId = row.resolved_by_node_id;
  }

  if (row.rationale != null) {
    entry.rationale = row.rationale;
  }

  if (row.closed_at_lsn != null) {
    entry.closedAtLsn = row.closed_at_lsn;
  }

  return entry;
}

/**
 * Return all open elicitation-backlog entries for a single spec.
 */
export function getOpenElicitationBacklogEntries(db: BrunchDb, specId: number): ElicitationBacklogEntry[] {
  const rows = db
    .select()
    .from(schema.elicitationBacklog)
    .where(and(eq(schema.elicitationBacklog.status, 'open'), eq(schema.elicitationBacklog.spec_id, specId)))
    .orderBy(schema.elicitationBacklog.created_at_lsn, schema.elicitationBacklog.id)
    .all();
  return rows.map(rowToElicitationBacklogEntry);
}

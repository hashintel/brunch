import { eq } from 'drizzle-orm';

import type { BrunchDb } from '../../db/connection.js';
import * as schema from '../../db/schema.js';
import { formatCreatedGraphNode, type PlannedBatchEndpoint } from './create-graph-batch.js';
import type { PlannedGraphMutation } from './graph-mutation-planner.js';
import type { MutateGraphInput, MutateGraphSuccess } from './graph-mutation-types.js';

export function writeGraphMutation(options: {
  readonly tx: Pick<BrunchDb, 'select' | 'insert' | 'update' | 'delete'>;
  readonly input: MutateGraphInput;
  readonly plan: PlannedGraphMutation;
  readonly operation: 'mutate_graph' | 'accept_review_set';
  readonly payloadExtras?: Record<string, unknown>;
  readonly bumpExistingSpecLsn: (tx: Pick<BrunchDb, 'select' | 'update'>, specId: number) => number;
  readonly allocateNodeKindOrdinal: (
    tx: Pick<BrunchDb, 'select' | 'insert' | 'update'>,
    specId: number,
    plane: string,
    kind: string,
  ) => number;
}): MutateGraphSuccess {
  const {
    allocateNodeKindOrdinal,
    bumpExistingSpecLsn,
    input,
    operation,
    payloadExtras = {},
    plan,
    tx,
  } = options;
  const lsn = bumpExistingSpecLsn(tx, input.specId);

  const createdNodes: Record<string, { id: number; code: string }> = {};
  for (const node of plan.createInput.nodes) {
    const kindOrdinal = allocateNodeKindOrdinal(tx, input.specId, node.plane, node.kind);
    const row = tx
      .insert(schema.nodes)
      .values({
        spec_id: input.specId,
        plane: node.plane,
        kind: node.kind,
        kind_ordinal: kindOrdinal,
        title: node.title,
        body: node.body ?? null,
        basis: input.createBasis ?? 'explicit',
        source: node.source ?? null,
        detail: node.detail != null ? JSON.stringify(node.detail) : null,
        created_at_lsn: lsn,
        updated_at_lsn: lsn,
      })
      .returning()
      .get();
    createdNodes[node.ref] = formatCreatedGraphNode(row!);
  }

  const resolvePlannedEndpoint = (endpoint: PlannedBatchEndpoint): number => {
    if (endpoint.kind === 'existing') return endpoint.ref as number;
    return createdNodes[endpoint.ref as string]!.id;
  };

  const createdEdges: number[] = [];
  for (const edge of plan.createEdges) {
    const row = tx
      .insert(schema.edges)
      .values({
        spec_id: input.specId,
        category: edge.category,
        source_id: resolvePlannedEndpoint(edge.source),
        target_id: resolvePlannedEndpoint(edge.target),
        stance: edge.stance,
        basis: input.createBasis ?? 'explicit',
        rationale: edge.rationale,
        created_at_lsn: lsn,
        updated_at_lsn: lsn,
      })
      .returning({ id: schema.edges.id })
      .get();
    createdEdges.push(row!.id);
  }

  const updatedNodes: number[] = [];
  for (const node of plan.patchNodes) {
    const patchRecord = node.patch as Record<string, unknown>;
    const values: Record<string, unknown> = { updated_at_lsn: lsn };
    if (hasOwn(patchRecord, 'title')) values['title'] = node.patch.title;
    if (hasOwn(patchRecord, 'body')) values['body'] = node.patch.body ?? null;
    if (hasOwn(patchRecord, 'source')) values['source'] = node.patch.source ?? null;
    if (hasOwn(patchRecord, 'detail')) {
      values['detail'] = node.patch.detail == null ? null : JSON.stringify(node.patch.detail);
    }
    tx.update(schema.nodes).set(values).where(eq(schema.nodes.id, node.nodeId)).run();
    updatedNodes.push(node.nodeId);
  }

  const updatedEdges: number[] = [];
  for (const edge of plan.patchEdges) {
    const patchRecord = edge.patch as Record<string, unknown>;
    const values: Record<string, unknown> = { updated_at_lsn: lsn };
    if (hasOwn(patchRecord, 'rationale')) values['rationale'] = edge.patch.rationale ?? null;
    tx.update(schema.edges).set(values).where(eq(schema.edges.id, edge.edgeId)).run();
    updatedEdges.push(edge.edgeId);
  }

  const deletedEdges = new Set<number>();
  for (const edgeId of plan.deleteEdges) {
    tx.delete(schema.edges).where(eq(schema.edges.id, edgeId)).run();
    deletedEdges.add(edgeId);
  }

  const deletedNodes: number[] = [];
  for (const node of plan.deleteNodes) {
    for (const edgeId of node.incidentEdgeIds) {
      if (deletedEdges.has(edgeId)) continue;
      tx.delete(schema.edges).where(eq(schema.edges.id, edgeId)).run();
      deletedEdges.add(edgeId);
    }
    tx.delete(schema.nodes).where(eq(schema.nodes.id, node.nodeId)).run();
    deletedNodes.push(node.nodeId);
  }

  tx.insert(schema.changeLog)
    .values({
      spec_id: input.specId,
      lsn,
      operation,
      payload: JSON.stringify({
        specId: input.specId,
        createBasis: input.createBasis ?? 'explicit',
        createdNodes: Object.fromEntries(Object.entries(createdNodes).map(([ref, node]) => [ref, node.id])),
        createdEdges,
        updatedNodes,
        updatedEdges,
        deletedNodes,
        deletedEdges: [...deletedEdges],
        ...payloadExtras,
      }),
    })
    .run();

  return {
    status: 'success',
    lsn,
    createdNodes,
    createdEdges,
    updatedNodes,
    updatedEdges,
    deletedNodes,
    deletedEdges: [...deletedEdges],
  };
}

function hasOwn(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

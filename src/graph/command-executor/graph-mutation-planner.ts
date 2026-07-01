import { and, eq, inArray, sql } from 'drizzle-orm';

import type { BrunchDb } from '../../db/connection.js';
import * as schema from '../../db/schema.js';
import { planCreateGraphBatch, type PlannedBatchEdge } from './create-graph-batch.js';
import type {
  CreateGraphInput,
  Diagnostic,
  EdgePatch,
  GraphMutationOp,
  MutateGraphInput,
  NodePatch,
  StructuralIllegal,
} from './graph-mutation-types.js';
import { normalizeRoleNamedEdgeDraft } from './role-named-edge-draft.js';

interface PlannedNodePatch {
  readonly nodeId: number;
  readonly patch: NodePatch;
}

interface PlannedEdgePatch {
  readonly edgeId: number;
  readonly patch: EdgePatch;
}

interface PlannedNodeDelete {
  readonly nodeId: number;
  readonly incidentEdgeIds: readonly number[];
}

export interface PlannedGraphMutation {
  readonly createInput: CreateGraphInput;
  readonly createEdges: readonly PlannedBatchEdge[];
  readonly patchNodes: readonly PlannedNodePatch[];
  readonly patchEdges: readonly PlannedEdgePatch[];
  readonly deleteEdges: readonly number[];
  readonly deleteNodes: readonly PlannedNodeDelete[];
}

export function planGraphMutation(options: {
  readonly db: Pick<BrunchDb, 'select'>;
  readonly input: MutateGraphInput;
  readonly validateCreateNode: (
    op: Extract<GraphMutationOp, { readonly op: 'create_node' }>,
    index: number,
  ) => readonly Diagnostic[];
  readonly validateNodePatch: (
    row: typeof schema.nodes.$inferSelect,
    patch: NodePatch,
  ) => readonly Diagnostic[];
  readonly validateEdgePatch: (patch: EdgePatch) => readonly Diagnostic[];
}): { readonly status: 'success'; readonly plan: PlannedGraphMutation } | StructuralIllegal {
  const { db, input, validateCreateNode, validateEdgePatch, validateNodePatch } = options;
  const diagnostics: Diagnostic[] = [];

  if (input.ops.length === 0) {
    return {
      status: 'structural_illegal',
      diagnostics: [{ field: 'ops', message: 'empty mutation batch — nothing to mutate' }],
    };
  }

  const createNodes = input.ops.filter(
    (op): op is Extract<GraphMutationOp, { readonly op: 'create_node' }> => op.op === 'create_node',
  );
  const createEdges = input.ops.filter(
    (op): op is Extract<GraphMutationOp, { readonly op: 'create_edge' }> => op.op === 'create_edge',
  );
  const patchNodes = input.ops.filter(
    (op): op is Extract<GraphMutationOp, { readonly op: 'patch_node' }> => op.op === 'patch_node',
  );
  const patchEdges = input.ops.filter(
    (op): op is Extract<GraphMutationOp, { readonly op: 'patch_edge' }> => op.op === 'patch_edge',
  );
  const deleteEdges = input.ops.filter(
    (op): op is Extract<GraphMutationOp, { readonly op: 'delete_edge' }> => op.op === 'delete_edge',
  );
  const deleteNodes = input.ops.filter(
    (op): op is Extract<GraphMutationOp, { readonly op: 'delete_node' }> => op.op === 'delete_node',
  );

  const normalizedCreateEdges = createEdges.flatMap((edge, index) => {
    try {
      return [normalizeRoleNamedEdgeDraft(edge)];
    } catch (error) {
      diagnostics.push({
        field: `ops[${input.ops.indexOf(edge)}]`,
        message: error instanceof Error ? error.message : `invalid create_edge op at index ${index}`,
      });
      return [];
    }
  });

  const createInput: CreateGraphInput = {
    specId: input.specId,
    basis: input.createBasis,
    settlement: input.createSettlement,
    nodes: createNodes.map(({ ref, plane, kind, title, body, source, detail }) => ({
      ref,
      plane,
      kind,
      title,
      body,
      source,
      detail,
    })),
    edges: normalizedCreateEdges,
  };

  const createPlan =
    createInput.nodes.length === 0 && createInput.edges.length === 0
      ? { status: 'success' as const, plan: { edges: [] as const } }
      : planCreateGraphBatch(db, createInput, (nodeIndex) =>
          validateCreateNode(createNodes[nodeIndex]!, nodeIndex).map((diagnostic) => ({
            field: `nodes[${nodeIndex}].${diagnostic.field}`,
            message: diagnostic.message,
          })),
        );
  if (createPlan.status === 'structural_illegal') diagnostics.push(...createPlan.diagnostics);

  const referencedNodeIds = new Set<number>();
  const referencedEdgeIds = new Set<number>();
  for (const op of patchNodes) referencedNodeIds.add(op.node.existing);
  for (const op of deleteNodes) referencedNodeIds.add(op.node.existing);
  for (const op of patchEdges) referencedEdgeIds.add(op.edge.existing);
  for (const op of deleteEdges) referencedEdgeIds.add(op.edge.existing);

  const nodeRows =
    referencedNodeIds.size === 0
      ? []
      : db
          .select()
          .from(schema.nodes)
          .where(inArray(schema.nodes.id, [...referencedNodeIds]))
          .all();
  const edgeRows =
    referencedEdgeIds.size === 0
      ? []
      : db
          .select()
          .from(schema.edges)
          .where(inArray(schema.edges.id, [...referencedEdgeIds]))
          .all();

  const nodeRowsById = new Map(nodeRows.map((row) => [row.id, row]));
  const edgeRowsById = new Map(edgeRows.map((row) => [row.id, row]));

  const patchNodeTargets = new Set<number>();
  const plannedNodePatches: PlannedNodePatch[] = [];
  for (const op of patchNodes) {
    const path = `ops[${input.ops.indexOf(op)}]`;
    const row = nodeRowsById.get(op.node.existing);
    if (!row) {
      diagnostics.push({
        field: `${path}.node.existing`,
        message: `node ${op.node.existing} does not exist`,
      });
      continue;
    }
    if (row.spec_id !== input.specId) {
      diagnostics.push({
        field: `${path}.node.existing`,
        message: `node ${op.node.existing} belongs to a different spec (command spec ${input.specId})`,
      });
      continue;
    }
    if (patchNodeTargets.has(op.node.existing)) {
      diagnostics.push({
        field: `${path}.node.existing`,
        message: `node ${op.node.existing} is patched more than once`,
      });
      continue;
    }
    patchNodeTargets.add(op.node.existing);
    diagnostics.push(
      ...validateNodePatch(row, op.patch).map((diagnostic) => ({
        field: `${path}.${diagnostic.field}`,
        message: diagnostic.message,
      })),
    );
    plannedNodePatches.push({ nodeId: op.node.existing, patch: op.patch });
  }

  const patchEdgeTargets = new Set<number>();
  const plannedEdgePatches: PlannedEdgePatch[] = [];
  for (const op of patchEdges) {
    const path = `ops[${input.ops.indexOf(op)}]`;
    const row = edgeRowsById.get(op.edge.existing);
    if (!row) {
      diagnostics.push({
        field: `${path}.edge.existing`,
        message: `edge ${op.edge.existing} does not exist`,
      });
      continue;
    }
    if (row.spec_id !== input.specId) {
      diagnostics.push({
        field: `${path}.edge.existing`,
        message: `edge ${op.edge.existing} belongs to a different spec (command spec ${input.specId})`,
      });
      continue;
    }
    if (patchEdgeTargets.has(op.edge.existing)) {
      diagnostics.push({
        field: `${path}.edge.existing`,
        message: `edge ${op.edge.existing} is patched more than once`,
      });
      continue;
    }
    patchEdgeTargets.add(op.edge.existing);
    diagnostics.push(
      ...validateEdgePatch(op.patch).map((diagnostic) => ({
        field: `${path}.${diagnostic.field}`,
        message: diagnostic.message,
      })),
    );
    plannedEdgePatches.push({ edgeId: op.edge.existing, patch: op.patch });
  }

  const deletedEdgeIds = new Set<number>();
  const plannedEdgeDeletes: number[] = [];
  for (const op of deleteEdges) {
    const path = `ops[${input.ops.indexOf(op)}]`;
    const row = edgeRowsById.get(op.edge.existing);
    if (!row) {
      diagnostics.push({
        field: `${path}.edge.existing`,
        message: `edge ${op.edge.existing} does not exist`,
      });
      continue;
    }
    if (row.spec_id !== input.specId) {
      diagnostics.push({
        field: `${path}.edge.existing`,
        message: `edge ${op.edge.existing} belongs to a different spec (command spec ${input.specId})`,
      });
      continue;
    }
    if (deletedEdgeIds.has(op.edge.existing)) {
      diagnostics.push({
        field: `${path}.edge.existing`,
        message: `edge ${op.edge.existing} is deleted more than once`,
      });
      continue;
    }
    deletedEdgeIds.add(op.edge.existing);
    plannedEdgeDeletes.push(op.edge.existing);
  }

  const deletedNodeIds = new Set<number>();
  const deletedExistingNodeIds = new Set(deleteNodes.map((op) => op.node.existing));
  const createEdgePlans = createPlan.status === 'success' ? createPlan.plan.edges : [];
  const plannedNodeDeletes: PlannedNodeDelete[] = [];
  for (const op of deleteNodes) {
    const path = `ops[${input.ops.indexOf(op)}]`;
    const row = nodeRowsById.get(op.node.existing);
    if (!row) {
      diagnostics.push({
        field: `${path}.node.existing`,
        message: `node ${op.node.existing} does not exist`,
      });
      continue;
    }
    if (row.spec_id !== input.specId) {
      diagnostics.push({
        field: `${path}.node.existing`,
        message: `node ${op.node.existing} belongs to a different spec (command spec ${input.specId})`,
      });
      continue;
    }
    if (deletedNodeIds.has(op.node.existing)) {
      diagnostics.push({
        field: `${path}.node.existing`,
        message: `node ${op.node.existing} is deleted more than once`,
      });
      continue;
    }
    deletedNodeIds.add(op.node.existing);

    if (patchNodeTargets.has(op.node.existing)) {
      diagnostics.push({
        field: `${path}.node.existing`,
        message: `node ${op.node.existing} cannot be patched and deleted in one batch`,
      });
    }

    const incidentRows = db
      .select({ id: schema.edges.id })
      .from(schema.edges)
      .where(
        and(
          eq(schema.edges.spec_id, input.specId),
          sql`(${schema.edges.source_id} = ${op.node.existing} or ${schema.edges.target_id} = ${op.node.existing})`,
        ),
      )
      .all();

    const remainingIncidentEdgeIds = incidentRows
      .map((edge) => edge.id)
      .filter((edgeId) => !deletedEdgeIds.has(edgeId));

    const createsIncidentEdge = createEdgePlans.some(
      (edge) =>
        (edge.source.kind === 'existing' && edge.source.ref === op.node.existing) ||
        (edge.target.kind === 'existing' && edge.target.ref === op.node.existing),
    );
    if (createsIncidentEdge) {
      diagnostics.push({
        field: `${path}.node.existing`,
        message: `node ${op.node.existing} cannot be deleted in the same batch that creates incident edges`,
      });
    }

    if (!op.deleteIncidentEdges && remainingIncidentEdgeIds.length > 0) {
      diagnostics.push({
        field: `${path}.deleteIncidentEdges`,
        message: `node ${op.node.existing} has incident edges; set deleteIncidentEdges to true to delete it`,
      });
    }

    plannedNodeDeletes.push({ nodeId: op.node.existing, incidentEdgeIds: remainingIncidentEdgeIds });
  }

  for (const edgeId of patchEdgeTargets) {
    const row = edgeRowsById.get(edgeId);
    if (!row) continue;
    if (
      deletedEdgeIds.has(edgeId) ||
      deletedExistingNodeIds.has(row.source_id) ||
      deletedExistingNodeIds.has(row.target_id)
    ) {
      diagnostics.push({
        field: 'ops',
        message: `edge ${edgeId} cannot be patched when it is deleted or attached to a deleted node in the same batch`,
      });
    }
  }

  if (diagnostics.length > 0 || createPlan.status === 'structural_illegal') {
    return { status: 'structural_illegal', diagnostics };
  }

  return {
    status: 'success',
    plan: {
      createInput,
      createEdges: createPlan.plan.edges,
      patchNodes: plannedNodePatches,
      patchEdges: plannedEdgePatches,
      deleteEdges: plannedEdgeDeletes,
      deleteNodes: plannedNodeDeletes,
    },
  };
}

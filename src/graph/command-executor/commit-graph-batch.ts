import { and, eq, inArray } from 'drizzle-orm';

import type { BrunchDb } from '../../db/connection.js';
import * as schema from '../../db/schema.js';
import type { EdgeCategory, EdgeStance } from '../schema/edges.js';
import { formatGraphNodeCode, type NodeKind } from '../schema/nodes.js';
import type {
  BatchEdgeInput,
  BatchEdgeRef,
  CommitGraphInput,
  CreatedGraphNodeResult,
  Diagnostic,
} from './commit-graph-types.js';

const VALID_CATEGORIES = schema.EDGE_CATEGORIES as unknown as string[];
const STANCE_REQUIRED_CATEGORIES = new Set(['proof', 'support']);
const VALID_STANCES = schema.EDGE_STANCES as unknown as string[];
const VALID_BASES = schema.NODE_BASES as unknown as string[];

export interface PlannedBatchEndpoint {
  readonly kind: 'batch' | 'existing';
  readonly ref: string | number;
}

export interface PlannedBatchEdge {
  readonly source: PlannedBatchEndpoint;
  readonly target: PlannedBatchEndpoint;
  readonly category: EdgeCategory;
  readonly stance: EdgeStance | null;
  readonly rationale: string | null;
}

export interface CommitGraphBatchPlan {
  readonly edges: readonly PlannedBatchEdge[];
}

export interface InsertedNodeRow {
  readonly id: number;
  readonly kind: string;
  readonly kind_ordinal: number;
}

export function formatCreatedGraphNode(row: InsertedNodeRow): CreatedGraphNodeResult {
  return {
    id: row.id,
    code: formatGraphNodeCode(row.kind as NodeKind, row.kind_ordinal),
  };
}

export function planCommitGraphBatch(
  db: Pick<BrunchDb, 'select'>,
  input: CommitGraphInput,
  validateNode: (nodeIndex: number) => readonly Diagnostic[],
):
  | { readonly status: 'success'; readonly plan: CommitGraphBatchPlan }
  | { readonly status: 'structural_illegal'; readonly diagnostics: readonly Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  if (input.nodes.length === 0 && input.edges.length === 0) {
    diagnostics.push({ field: 'batch', message: 'empty batch — nothing to commit' });
    return { status: 'structural_illegal', diagnostics };
  }
  if (input.basis != null && !VALID_BASES.includes(input.basis)) {
    diagnostics.push({
      field: 'basis',
      message: `"${String(input.basis)}" is not a valid graph approval basis`,
    });
  }

  const specRow = db
    .select({ id: schema.specs.id })
    .from(schema.specs)
    .where(eq(schema.specs.id, input.specId))
    .get();
  if (!specRow) {
    diagnostics.push({ field: 'specId', message: `spec ${input.specId} does not exist` });
    return { status: 'structural_illegal', diagnostics };
  }

  const batchRefs = new Map<string, string>();
  for (let i = 0; i < input.nodes.length; i++) {
    const bn = input.nodes[i]!;
    if (batchRefs.has(bn.ref)) {
      diagnostics.push({
        field: `nodes[${i}].ref`,
        message: `duplicate batch ref "${bn.ref}"`,
      });
    }
    batchRefs.set(bn.ref, bn.ref);
    for (const diagnostic of validateNode(i)) {
      diagnostics.push(diagnostic);
    }
  }
  if (diagnostics.length > 0) return { status: 'structural_illegal', diagnostics };

  const existingRefs = new Set<number>();
  for (const edge of input.edges) {
    addExistingRefId(edge.source, existingRefs);
    addExistingRefId(edge.target, existingRefs);
  }

  const verifiedExisting = new Set<number>();
  const crossSpecExisting = new Set<number>();
  if (existingRefs.size > 0) {
    const rows = db
      .select({ id: schema.nodes.id, spec_id: schema.nodes.spec_id })
      .from(schema.nodes)
      .where(inArray(schema.nodes.id, [...existingRefs]))
      .all();
    for (const row of rows) {
      if (row.spec_id === input.specId) {
        verifiedExisting.add(row.id);
      } else {
        crossSpecExisting.add(row.id);
      }
    }
  }

  const plannedEdges: PlannedBatchEdge[] = [];
  for (let i = 0; i < input.edges.length; i++) {
    const result = validateAndPlanBatchEdge(
      input.edges[i]!,
      i,
      batchRefs,
      verifiedExisting,
      crossSpecExisting,
      input.specId,
    );
    diagnostics.push(...result.diagnostics);
    if (result.planned) plannedEdges.push(result.planned);
  }
  if (diagnostics.length > 0) return { status: 'structural_illegal', diagnostics };

  const cycleDiagnostic = findSupersessionCycle(db, input.specId, plannedEdges);
  if (cycleDiagnostic) return { status: 'structural_illegal', diagnostics: [cycleDiagnostic] };

  return { status: 'success', plan: { edges: plannedEdges } };
}

function addExistingRefId(ref: BatchEdgeRef, refs: Set<number>): void {
  if (typeof ref === 'string') return;
  refs.add(ref.existing);
}

function endpointKey(endpoint: PlannedBatchEndpoint): string | number {
  return endpoint.kind === 'existing' ? endpoint.ref : `batch:${endpoint.ref}`;
}

function resolveEndpointRef(
  ref: BatchEdgeRef,
  specId: number,
  batchRefs: ReadonlyMap<string, string>,
  existingNodeIds: ReadonlySet<number>,
  crossSpecExisting: ReadonlySet<number>,
  field: string,
  diagnostics: Diagnostic[],
): PlannedBatchEndpoint | undefined {
  if (typeof ref === 'string') {
    const batchRef = batchRefs.get(ref);
    if (batchRef === undefined) {
      diagnostics.push({ field, message: `unresolvable intra-batch ref "${ref}"` });
      return undefined;
    }
    return { kind: 'batch', ref: batchRef };
  }

  const id = ref.existing;
  if (crossSpecExisting.has(id)) {
    diagnostics.push({
      field,
      message: `existing node ${id} belongs to a different spec (command spec ${specId})`,
    });
  } else if (!existingNodeIds.has(id)) {
    diagnostics.push({ field, message: `existing node ${id} not found` });
  }
  return { kind: 'existing', ref: id };
}

function validateAndPlanBatchEdge(
  input: BatchEdgeInput,
  index: number,
  batchRefs: ReadonlyMap<string, string>,
  existingNodeIds: ReadonlySet<number>,
  crossSpecExisting: ReadonlySet<number>,
  specId: number,
): { readonly diagnostics: readonly Diagnostic[]; readonly planned?: PlannedBatchEdge } {
  const diagnostics: Diagnostic[] = [];
  const p = `edges[${index}]`;

  if (!VALID_CATEGORIES.includes(input.category)) {
    diagnostics.push({
      field: `${p}.category`,
      message: `"${input.category}" is not a valid edge category`,
    });
    return { diagnostics };
  }

  const stanceRequired = STANCE_REQUIRED_CATEGORIES.has(input.category);
  if (stanceRequired && input.stance == null) {
    diagnostics.push({ field: `${p}.stance`, message: `stance is required for "${input.category}" edges` });
  }
  if (!stanceRequired && input.stance != null) {
    diagnostics.push({
      field: `${p}.stance`,
      message: `stance is not allowed for "${input.category}" edges`,
    });
  }
  if (input.stance != null && !VALID_STANCES.includes(input.stance)) {
    diagnostics.push({ field: `${p}.stance`, message: `"${input.stance}" is not a valid stance` });
  }

  const source = resolveEndpointRef(
    input.source,
    specId,
    batchRefs,
    existingNodeIds,
    crossSpecExisting,
    `${p}.source`,
    diagnostics,
  );
  const target = resolveEndpointRef(
    input.target,
    specId,
    batchRefs,
    existingNodeIds,
    crossSpecExisting,
    `${p}.target`,
    diagnostics,
  );

  if (source !== undefined && target !== undefined && endpointKey(source) === endpointKey(target)) {
    diagnostics.push({ field: p, message: 'self-loop: source and target resolve to the same node' });
  }

  if (diagnostics.length > 0 || source === undefined || target === undefined) return { diagnostics };
  return {
    diagnostics,
    planned: {
      source,
      target,
      category: input.category as EdgeCategory,
      stance: (input.stance as EdgeStance) ?? null,
      rationale: input.rationale ?? null,
    },
  };
}

function findSupersessionCycle(
  db: Pick<BrunchDb, 'select'>,
  specId: number,
  proposedEdges: readonly PlannedBatchEdge[],
): Diagnostic | undefined {
  const supersessionEdges = proposedEdges.filter((edge) => edge.category === 'supersession');
  if (supersessionEdges.length === 0) return undefined;

  const adjacency = new Map<string | number, (string | number)[]>();
  const addEdge = (source: string | number, target: string | number) => {
    const targets = adjacency.get(source);
    if (targets) {
      targets.push(target);
    } else {
      adjacency.set(source, [target]);
    }
  };

  for (const edge of db
    .select({ sourceId: schema.edges.source_id, targetId: schema.edges.target_id })
    .from(schema.edges)
    .where(and(eq(schema.edges.spec_id, specId), eq(schema.edges.category, 'supersession')))
    .all()) {
    addEdge(edge.sourceId, edge.targetId);
  }
  for (const edge of supersessionEdges) {
    addEdge(endpointKey(edge.source), endpointKey(edge.target));
  }

  const visiting = new Set<string | number>();
  const visited = new Set<string | number>();
  const hasCycle = (node: string | number): boolean => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const target of adjacency.get(node) ?? []) {
      if (hasCycle(target)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };

  for (const node of adjacency.keys()) {
    if (hasCycle(node)) {
      return { field: 'edges', message: 'supersession edges must be acyclic within one spec' };
    }
  }
  return undefined;
}

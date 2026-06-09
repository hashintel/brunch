import type { NodeBasis, NodePlane } from '../schema/nodes.js';

/** A single validation problem discovered during structural checks. */
export interface Diagnostic {
  readonly field: string;
  readonly message: string;
}

/** Structurally invalid input — validation failed before any write. */
export interface StructuralIllegal {
  readonly status: 'structural_illegal';
  readonly diagnostics: readonly Diagnostic[];
}

/** Successful dry-run validation without mutation. */
interface DryRunSuccess {
  readonly status: 'success';
}

export interface CreatedGraphNodeResult {
  readonly id: number;
  readonly code: string;
}

export type CreatedGraphNodes = Readonly<Record<string, CreatedGraphNodeResult>>;

/** Successful commitGraph batch execution. */
export interface CommitGraphSuccess {
  readonly status: 'success';
  readonly lsn: number;
  readonly createdNodes: CreatedGraphNodes;
  readonly edges: readonly number[];
}

/** Result of a commitGraph command. */
export type CommitGraphResult = CommitGraphSuccess | StructuralIllegal;

/** Result of a commitGraph dry-run validation. */
export type CommitGraphDryRunResult = DryRunSuccess | StructuralIllegal;

/** Reference to a node endpoint in a batch edge. */
export type BatchEdgeRef = string | { readonly existing: number };

/** A node to create inside a commitGraph batch. */
export interface BatchNodeInput {
  readonly ref: string;
  readonly plane: NodePlane;
  readonly kind: string;
  readonly title: string;
  readonly body?: string | undefined;
  readonly source?: string | undefined;
  readonly detail?: unknown;
}

/** An edge to create inside a commitGraph batch. */
export interface BatchEdgeInput {
  readonly category: string;
  readonly source: BatchEdgeRef;
  readonly target: BatchEdgeRef;
  readonly stance?: string | undefined;
  readonly rationale?: string | undefined;
}

/** Input for the commitGraph atomic batch mutation. */
export interface CommitGraphInput {
  readonly specId: number;
  readonly basis?: NodeBasis | undefined;
  readonly nodes: readonly BatchNodeInput[];
  readonly edges: readonly BatchEdgeInput[];
}

export interface NodePatch {
  readonly title?: string | undefined;
  readonly body?: string | null | undefined;
  readonly source?: string | null | undefined;
  readonly detail?: unknown;
}

export interface EdgePatch {
  readonly rationale?: string | null | undefined;
}

export type MutateGraphNodeRef = { readonly existing: number };
export type MutateGraphEdgeRef = { readonly existing: number };

export type GraphMutationOp =
  | ({ readonly op: 'create_node' } & BatchNodeInput)
  | ({ readonly op: 'create_edge' } & import('./role-named-edge-draft.js').RoleNamedEdgeDraft)
  | { readonly op: 'patch_node'; readonly node: MutateGraphNodeRef; readonly patch: NodePatch }
  | { readonly op: 'patch_edge'; readonly edge: MutateGraphEdgeRef; readonly patch: EdgePatch }
  | { readonly op: 'delete_edge'; readonly edge: MutateGraphEdgeRef }
  | {
      readonly op: 'delete_node';
      readonly node: MutateGraphNodeRef;
      readonly deleteIncidentEdges?: boolean | undefined;
    };

export interface MutateGraphInput {
  readonly specId: number;
  readonly createBasis?: NodeBasis | undefined;
  readonly ops: readonly GraphMutationOp[];
}

export interface MutateGraphSuccess {
  readonly status: 'success';
  readonly lsn: number;
  readonly createdNodes: CreatedGraphNodes;
  readonly createdEdges: readonly number[];
  readonly updatedNodes: readonly number[];
  readonly updatedEdges: readonly number[];
  readonly deletedNodes: readonly number[];
  readonly deletedEdges: readonly number[];
}

export type MutateGraphResult = MutateGraphSuccess | StructuralIllegal;
export type MutateGraphDryRunResult = DryRunSuccess | StructuralIllegal;

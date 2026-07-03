import type { NodeBasis, NodePlane, NodeSettlement } from '../schema/nodes.js';

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

export type GraphMutationNodeRef = string | { readonly existing: number };

export interface CreateGraphNodeInput {
  readonly ref: string;
  readonly plane: NodePlane;
  readonly kind: string;
  readonly title: string;
  readonly body?: string | undefined;
  readonly source?: string | undefined;
  readonly detail?: unknown;
}

export interface CreateGraphEdgeInput {
  readonly category: string;
  readonly source: GraphMutationNodeRef;
  readonly target: GraphMutationNodeRef;
  readonly stance?: string | undefined;
  readonly rationale?: string | undefined;
}

export interface CreateGraphInput {
  readonly specId: number;
  readonly basis?: NodeBasis | undefined;
  /** Defaults to `settled`; applies to both created nodes and created edges. */
  readonly settlement?: NodeSettlement | undefined;
  readonly nodes: readonly CreateGraphNodeInput[];
  readonly edges: readonly CreateGraphEdgeInput[];
}

export interface NodePatch {
  readonly title?: string | undefined;
  readonly body?: string | null | undefined;
  readonly source?: string | null | undefined;
  readonly detail?: unknown;
  /** Promotion path (I52-L): only `advisory -> settled` is a legal transition. */
  readonly settlement?: NodeSettlement | undefined;
}

export interface EdgePatch {
  readonly rationale?: string | null | undefined;
  /** Promotion path (I52-L): only `advisory -> settled` is a legal transition. */
  readonly settlement?: NodeSettlement | undefined;
}

export type ExistingGraphNodeRef = { readonly existing: number };
export type ExistingGraphEdgeRef = { readonly existing: number };

export type GraphMutationOp =
  | ({ readonly op: 'create_node' } & CreateGraphNodeInput)
  | ({ readonly op: 'create_edge' } & import('./role-named-edge-draft.js').RoleNamedEdgeDraft)
  | { readonly op: 'patch_node'; readonly node: ExistingGraphNodeRef; readonly patch: NodePatch }
  | { readonly op: 'patch_edge'; readonly edge: ExistingGraphEdgeRef; readonly patch: EdgePatch }
  | { readonly op: 'delete_edge'; readonly edge: ExistingGraphEdgeRef }
  | {
      readonly op: 'delete_node';
      readonly node: ExistingGraphNodeRef;
      readonly deleteIncidentEdges?: boolean | undefined;
    };

export interface MutateGraphInput {
  readonly specId: number;
  readonly createBasis?: NodeBasis | undefined;
  /** Defaults to `settled`; advisory bulk-acquisition capture passes `advisory` (D99-L). */
  readonly createSettlement?: NodeSettlement | undefined;
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

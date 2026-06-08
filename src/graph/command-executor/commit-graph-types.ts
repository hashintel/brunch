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

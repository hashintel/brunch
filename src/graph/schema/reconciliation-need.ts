/**
 * Reconciliation-need type definitions.
 *
 * Canonical reference: memory/SPEC.md D8-L (reconciliation-need substrate), D51-L
 *
 * A reconciliation_need is a first-class record of an open impasse
 * over graph state — typically "this edge needs re-validation"
 * (after an upstream change) or "these two nodes might need an edge."
 *
 * Reconciliation_needs reference graph state. They are NOT graph
 * edges and do not appear in projection neighborhoods as edges.
 * They surface to the user through next-turn delivery as advisory
 * items (D29-L).
 *
 * Phase 1 lock-and-materialize: type definitions only.
 * Drizzle table definitions and CommandExecutor write paths land
 * with subsequent M4 slices.
 */

import type { EdgeId, Lsn, NodeId } from '../atoms.js';

/**
 * Persisted reconciliation-need kinds — the judgment-shaped impasses with no
 * LSN-derivable staleness signal (canonical vocabulary home).
 *
 * `edge_revalidation` was retired from this substrate (reconciliation-derivation
 * frontier): edge staleness is now a derived LSN read
 * (`../projection/derived-revalidation.ts`), cleared by the per-edge
 * `acknowledgedLsn` watermark — never a persisted row. These three remain
 * agent-authored via `create_reconciliation_need`.
 */
export const RECONCILIATION_NEED_KINDS = [
  'possible_relation',
  'possible_duplicate',
  'semantic_conflict',
] as const;

/** What sort of impasse a persisted need records. */
export type ReconciliationNeedKind = (typeof RECONCILIATION_NEED_KINDS)[number];

/**
 * What this need is about.
 *
 * `edge` is the default — the need describes a relation whose
 * semantic basis may have changed.
 *
 * `node_pair` covers cases where no edge exists yet (possible
 * duplicate, possible relation). When such a need resolves to
 * "yes, edge exists," create the edge and close the need.
 */
export type ReconciliationNeedTarget =
  | {
      readonly kind: 'edge';
      readonly edgeId: EdgeId;
    }
  | {
      readonly kind: 'node_pair';
      readonly aId: NodeId;
      readonly bId: NodeId;
    };

export interface ReconciliationNeed {
  readonly id: string;
  readonly specId: number;
  readonly kind: ReconciliationNeedKind;
  readonly target: ReconciliationNeedTarget;
  readonly rationale?: string;
  readonly createdAtLsn: Lsn;
  readonly resolvedAtLsn?: Lsn;
}

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
 * What sort of impasse this need records.
 *
 * Open extension — new kinds may be added as concrete needs surface.
 * Most needs are `edge_revalidation`.
 */
type ReconciliationNeedKind =
  | 'edge_revalidation'
  | 'possible_relation'
  | 'possible_duplicate'
  | 'semantic_conflict';

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

/**
 * Graph edge type definitions.
 *
 * Canonical reference: memory/SPEC.md D51-L (closed edge categories); src/graph/policy/category-policy.ts (per-category metadata)
 * Supersedes: docs/architecture/pi-seam-extensions.md §"Edge types"
 *             (the prior named-relation catalogue)
 *
 * Phase 1 lock-and-materialize: type definitions only.
 * Drizzle table definitions, structural validators, and the
 * agent-facing link* command surface land with subsequent M4/M5 slices.
 */

import type { EdgeId, Lsn, NodeId } from '../atoms.js';
import { EDGE_CATEGORIES, EDGE_STANCES, NODE_BASES, NODE_SETTLEMENTS } from './kinds.js';

/**
 * Closed set of structural edge categories.
 *
 * Derived from `graph/schema/kinds.ts` — the single enum source.
 *
 * - `dependency`   dependency  → dependent      hard upstream; cascade
 * - `witness`        oracle      → claim          witness or refutation (stance required)
 * - `rationale`      support     → claim          motivation / rationale (stance required)
 * - `realization`    abstract    → concrete       expression / implementation
 * - `refinement`     abstract    → concrete       formal refinement / specialization
 * - `exclusion`      boundary    → subject        scope / constraint / exclusion
 * - `composition`    whole       → part           containment / decomposition
 * - `supersession`   successor   → predecessor    replacement lineage (acyclic)
 * - `cross_reference` peer       ↔ peer           weak relatedness (symmetric)
 */
export type EdgeCategory = (typeof EDGE_CATEGORIES)[number];

/**
 * Polarity for stance-bearing edges.
 *
 * Required for `witness` and `rationale`.
 * Invalid (must be omitted) for every other category.
 */
export type EdgeStance = (typeof EDGE_STANCES)[number];

/**
 * How an edge entered graph truth.
 *
 * `explicit` means the graph item was directly stated or exact-review approved;
 * `implicit` means an approved concept was materialized without per-item review.
 * The mutation path lives in `change_log.operation`, not in `basis` (D63-L).
 */
type EdgeBasis = (typeof NODE_BASES)[number];

/**
 * Settlement dimension for edges, orthogonal to `basis` (I52-L) — same
 * semantics as `NodeSettlement` in `./nodes.ts`.
 */
type EdgeSettlement = (typeof NODE_SETTLEMENTS)[number];

// EdgeProvenance retired — change_log owns the full audit trail.

/**
 * A structurally-typed edge in the Brunch graph.
 *
 * Immutability after acceptance:
 *  - `category`, `sourceId`, `targetId`, `stance` are immutable.
 *  - `rationale` may be updated (advances `updatedAtLsn`).
 *  - To change category: delete and recreate.
 *
 * Stance:
 *  - REQUIRED iff `category` is `"witness"` or `"rationale"`.
 *  - INVALID (must be omitted) for every other category.
 *  - Structural validators in the CommandExecutor enforce this.
 *
 * No `status` field: accepted graph edges are present-or-absent.
 * Stale edges surface as a derived `edge_revalidation` staleness signal
 * (see `src/graph/projection/derived-revalidation.ts`), cleared per-edge by
 * the `acknowledgedLsn` watermark below.
 */
export interface GraphEdge {
  readonly id: EdgeId;
  readonly specId: number;
  readonly category: EdgeCategory;
  readonly sourceId: NodeId;
  readonly targetId: NodeId;
  readonly stance?: EdgeStance;
  readonly basis: EdgeBasis;
  readonly settlement: EdgeSettlement;
  readonly rationale?: string;
  readonly createdAtLsn: Lsn;
  readonly updatedAtLsn: Lsn;
  /**
   * Per-edge acknowledged-LSN watermark (reconciliation-derivation frontier,
   * correction 3). Null until an acknowledgement bumps it. The derived
   * `edge_revalidation` staleness test treats the edge as acknowledged up to
   * `max(acknowledgedLsn, updatedAtLsn)`, so a null watermark is equivalent to
   * the edge's own `updatedAtLsn` (the pre-watermark proxy).
   */
  readonly acknowledgedLsn?: Lsn;
}

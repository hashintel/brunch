/**
 * Graph edge type definitions.
 *
 * Canonical reference: docs/design/GRAPH_MODEL.md
 * Supersedes: docs/architecture/pi-seam-extensions.md §"Edge types"
 *             (the prior named-relation catalogue)
 *
 * Phase 1 lock-and-materialize: type definitions only.
 * Drizzle table definitions, structural validators, and the
 * agent-facing link* command surface land with subsequent M4/M5 slices.
 */

import type { EdgeId, Lsn, NodeId } from '../atoms.js';
import { EDGE_CATEGORIES, EDGE_STANCES, NODE_BASES } from './kinds.js';

/**
 * Closed set of structural edge categories.
 *
 * Derived from `graph/schema/kinds.ts` — the single enum source.
 *
 * - `dependency`   dependency  → dependent      hard upstream; cascade
 * - `proof`        oracle      → claim          witness or refutation (stance required)
 * - `support`      support     → claim          motivation / rationale (stance required)
 * - `realization`  abstract    → concrete       expression / implementation
 * - `boundary`     boundary    → subject        scope / constraint / exclusion
 * - `composition`  whole       → part           containment / decomposition
 * - `supersession` successor   → predecessor    replacement lineage (acyclic)
 * - `association`  peer        ↔ peer           weak relatedness (symmetric)
 */
export type EdgeCategory = (typeof EDGE_CATEGORIES)[number];

/**
 * Polarity for stance-bearing edges.
 *
 * Required for `proof` and `support`.
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
 *  - REQUIRED iff `category` is `"proof"` or `"support"`.
 *  - INVALID (must be omitted) for every other category.
 *  - Structural validators in the CommandExecutor enforce this.
 *
 * No `status` field: accepted graph edges are present-or-absent.
 * Stale edges surface as `ReconciliationNeed` records pointing at
 * the edge (see `src/graph/schema/reconciliation-need.ts`).
 */
export interface GraphEdge {
  readonly id: EdgeId;
  readonly specId: number;
  readonly category: EdgeCategory;
  readonly sourceId: NodeId;
  readonly targetId: NodeId;
  readonly stance?: EdgeStance;
  readonly basis: EdgeBasis;
  readonly rationale?: string;
  readonly createdAtLsn: Lsn;
  readonly updatedAtLsn: Lsn;
}

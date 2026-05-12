// V3.0 hard-impact cascade — relation→kind mapping (D139, A84, I112).
//
// When a hard-impact `propose_edit` apply mutates an item, the server enumerates
// edges incident on that item (Path 1 from MULTI_CHAT.md §5.1) and opens one
// reconciliation_need per affected pair. The kind expresses what the user owes
// against the downstream target after the source change:
//
//   supersedes         — target was built FROM the source (derivation/refinement);
//                        source change invalidates target's foundation.
//   needs_confirmation — target may still hold but the user must re-check
//                        (dependency, constraint, verification).
//
// V3.0 ships this table mechanical and conservative. V3.1's reconciliation
// agent may reclassify needs into auto-confirm / auto-edit / substantive groups
// without changing the underlying queue rows.

import type { ReconciliationNeedKind } from './db.js';

export type CascadeRelation = 'depends_on' | 'derived_from' | 'constrains' | 'verifies' | 'refines';

const RELATION_TO_KIND: Readonly<Record<CascadeRelation, ReconciliationNeedKind>> = Object.freeze({
  depends_on: 'needs_confirmation',
  derived_from: 'supersedes',
  constrains: 'needs_confirmation',
  verifies: 'needs_confirmation',
  refines: 'supersedes',
});

export function relationToKind(relation: CascadeRelation): ReconciliationNeedKind {
  return RELATION_TO_KIND[relation];
}

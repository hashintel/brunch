/**
 * Per-edge-category policy table.
 *
 * Canonical reference: docs/design/GRAPH_MODEL.md §"Per-category policy"
 *
 * This table replaces the prior multi-axis per-relation policy
 * registry. Only the axes that have a present reader in M4 or M5
 * are encoded here:
 *
 *  - `cascadeOnSourceChange`  — automatic block / mark-stale on the
 *                               dependent (assumption-invalidation
 *                               cascade). Only `dependency` cascades.
 *  - `reconNeedOnSourceChange` — generate a ReconciliationNeed pointing
 *                               at the edge. `"advisory"` = generated
 *                               only if a coherence rule asks for it;
 *                               `true` = generated unconditionally.
 *  - `criteriaHelpSignal`     — the interviewer uses this edge when
 *                               suggesting criteria for the target
 *                               node ("requirement with no `proof`
 *                               incoming → suggest criterion").
 *  - `projectionEffect`       — non-default effect on active-context /
 *                               neighborhood builders. `"none"` means
 *                               the edge is rendered ordinarily.
 *
 * Phase 1 lock-and-materialize: data only. The CommandExecutor,
 * coherence triggers, projection builders, and interviewer prompts
 * consume this table in subsequent M4/M5 slices.
 */

import type { EdgeCategory } from '../schema/edges.js';

type ReconNeedTrigger = false | 'advisory' | true;

type ProjectionEffect = 'none' | 'hide_predecessor_from_active_context';

interface CategoryPolicy {
  readonly cascadeOnSourceChange: boolean;
  readonly reconNeedOnSourceChange: ReconNeedTrigger;
  readonly criteriaHelpSignal: boolean;
  readonly projectionEffect: ProjectionEffect;
}

export const CATEGORY_POLICY: Readonly<Record<EdgeCategory, CategoryPolicy>> = {
  dependency: {
    cascadeOnSourceChange: true,
    reconNeedOnSourceChange: true,
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  proof: {
    cascadeOnSourceChange: false,
    reconNeedOnSourceChange: 'advisory',
    criteriaHelpSignal: true,
    projectionEffect: 'none',
  },
  support: {
    cascadeOnSourceChange: false,
    reconNeedOnSourceChange: 'advisory',
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  realization: {
    cascadeOnSourceChange: false,
    reconNeedOnSourceChange: 'advisory',
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  boundary: {
    cascadeOnSourceChange: false,
    reconNeedOnSourceChange: true,
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  composition: {
    cascadeOnSourceChange: false,
    reconNeedOnSourceChange: false,
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  association: {
    cascadeOnSourceChange: false,
    reconNeedOnSourceChange: false,
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  supersession: {
    cascadeOnSourceChange: false,
    reconNeedOnSourceChange: false,
    criteriaHelpSignal: false,
    projectionEffect: 'hide_predecessor_from_active_context',
  },
};

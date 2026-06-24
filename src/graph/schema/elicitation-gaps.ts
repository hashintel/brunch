/**
 * Elicitation-gaps type definitions.
 *
 * Canonical reference: memory/SPEC.md D65-L
 *
 * The elicitation_gaps register is the elicitor's prospective coverage-obligation
 * register: typed obligations seeded at spec creation and grown later by
 * capture-reflection. It is a flat table, not a graph node/plane. Structural
 * coverage is derived from the graph at read time, not stored here.
 */

import type { Lsn, NodeId } from '../atoms.js';
import { GAP_DISPOSITIONS, GAP_PREDICATE_KINDS, LENS_AFFINITIES, type ReadinessBand } from './kinds.js';
import type { NodeBasis, NodeKind, NodePlane } from './nodes.js';

export type GapDisposition = (typeof GAP_DISPOSITIONS)[number];
export type GapPredicateKind = (typeof GAP_PREDICATE_KINDS)[number];

export type ElicitationGapLensAffinity = (typeof LENS_AFFINITIES)[number];

/**
 * Single owner of per-arm predicate semantics. Boundary validation
 * (CommandExecutor rejects `unsupported` arms) and coverage derivation
 * (queries derive only `structural` arms; `manual` rides disposition)
 * both consume this classifier. The never check makes adding a
 * GapPredicate arm without deciding its semantics a compile error.
 */
export type GapPredicateSupport = 'structural' | 'manual' | 'unsupported';

export function gapPredicateSupport(kind: GapPredicateKind): GapPredicateSupport {
  switch (kind) {
    case 'presence':
      return 'structural';
    case 'manual':
      return 'manual';
    case 'field':
    case 'coverage':
      return 'unsupported';
    default: {
      const unhandled: never = kind;
      throw new Error(`Unhandled gap predicate kind: ${String(unhandled)}`);
    }
  }
}

export type GapPredicate =
  | {
      readonly kind: 'presence';
      readonly minimum: number;
      readonly plane?: NodePlane;
      readonly nodeKind?: NodeKind;
      readonly band?: ReadinessBand;
    }
  | {
      readonly kind: 'field';
      readonly nodeKind: NodeKind;
      readonly field: string;
    }
  | {
      readonly kind: 'coverage';
      readonly subjectKind: NodeKind;
      readonly relation: string;
    }
  | {
      readonly kind: 'manual';
      readonly rubric: string;
    };

export interface ElicitationGap {
  readonly id: string;
  readonly specId: number;
  readonly refersTo: NodeKind;
  readonly question: string;
  readonly rationale: string;
  readonly basis: NodeBasis;
  readonly band: ReadinessBand;
  readonly predicate: GapPredicate;
  readonly importance: number;
  readonly coverage: number;
  readonly answered: boolean;
  readonly disposition: GapDisposition;
  readonly planeAffinity?: NodePlane;
  readonly lensAffinity?: ElicitationGapLensAffinity;
  readonly aroseFromGapId?: string;
  readonly resolvedByNodeId?: NodeId;
  readonly createdAtLsn: Lsn;
  readonly dispositionSetAtLsn?: Lsn;
}

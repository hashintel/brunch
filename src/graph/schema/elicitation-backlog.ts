/**
 * Elicitation-backlog type definitions.
 *
 * Canonical reference: memory/SPEC.md D65-L
 *
 * The elicitation_backlog is the elicitor's prospective process-agenda register:
 * open questions the user has not answered yet, seeded at spec creation and grown
 * later by capture-reflection. It is a flat table, not a graph node/plane.
 */

import type { Lsn, NodeId } from '../atoms.js';
import { ELICITATION_BACKLOG_STATUSES, LENS_AFFINITIES } from './kinds.js';
import type { NodeBasis, NodePlane, ReadinessBand } from './nodes.js';

type ElicitationBacklogStatus = (typeof ELICITATION_BACKLOG_STATUSES)[number];

export type ElicitationBacklogLensAffinity = (typeof LENS_AFFINITIES)[number];

export interface ElicitationBacklogEntry {
  readonly id: string;
  readonly specId: number;
  readonly kind: string;
  readonly question: string;
  readonly status: ElicitationBacklogStatus;
  readonly basis: NodeBasis;
  readonly readinessBand: ReadinessBand;
  readonly planeAffinity?: NodePlane;
  readonly lensAffinity?: ElicitationBacklogLensAffinity;
  readonly aroseFromEntryId?: string;
  readonly resolvedByNodeId?: NodeId;
  readonly rationale?: string;
  readonly createdAtLsn: Lsn;
  readonly closedAtLsn?: Lsn;
}

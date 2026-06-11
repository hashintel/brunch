/**
 * Synthetic elicitation-gap builders.
 *
 * Single owner of the synthetic `ElicitationGap` shape used by production
 * fail-closed composition points (the runtime extension's
 * `conservativeUncoveredFloorGaps` rides `groundingFloorGaps`) and by test
 * fixtures across projections, session, agents, and app layers. Production
 * owns the shape; tests import it — never the reverse. Not test-only code.
 */

import type { Lsn } from '../atoms.js';
import type { ElicitationGap } from './elicitation-gaps.js';
import type { NodeKind } from './nodes.js';

/** Node kinds the conservative grounding floor spans. */
export const GROUNDING_FLOOR_KINDS = [
  'context',
  'thesis',
  'goal',
  'constraint',
] as const satisfies readonly NodeKind[];

export type ElicitationGapSeed = Partial<ElicitationGap> & Pick<ElicitationGap, 'refersTo'>;

/**
 * Build one synthetic presence-predicate gap. `coverage` defaults to 1
 * (covered); `answered` and `disposition` derive from coverage unless
 * overridden explicitly through the seed.
 */
export function presenceGap(seed: ElicitationGapSeed): ElicitationGap {
  const { refersTo } = seed;
  const coverage = seed.coverage ?? 1;
  return {
    id: `${refersTo}:gap`,
    specId: 1,
    question: `${refersTo} question`,
    rationale: `${refersTo} rationale`,
    basis: 'implicit',
    band: 'grounding',
    predicate: { kind: 'presence', minimum: 1, nodeKind: refersTo },
    importance: 1,
    coverage,
    answered: coverage >= 1,
    disposition: coverage >= 1 ? 'answered' : 'open',
    createdAtLsn: 1,
    ...seed,
  };
}

export interface GroundingFloorGapsOptions {
  readonly kinds?: readonly NodeKind[];
  /** Per-kind coverage; kinds absent from the map fall back to `defaultCoverage`. */
  readonly coverage?: Readonly<Partial<Record<NodeKind, number>>>;
  /** Coverage for kinds not named in `coverage`. Defaults to 1 (covered). */
  readonly defaultCoverage?: number;
  readonly specId?: number;
  /** Gap ids become `${kind}:${idSuffix}`; defaults to `${kind}:gap`. */
  readonly idSuffix?: string;
  /** Shared rationale; defaults to `${kind} rationale` per gap. */
  readonly rationale?: string;
  readonly createdAtLsn?: Lsn;
}

/**
 * Build one presence gap per grounding-floor node kind (or per `kinds`),
 * with a per-kind coverage knob.
 */
export function groundingFloorGaps(options: GroundingFloorGapsOptions = {}): ElicitationGap[] {
  const kinds = options.kinds ?? GROUNDING_FLOOR_KINDS;
  return kinds.map((kind) =>
    presenceGap({
      refersTo: kind,
      coverage: options.coverage?.[kind] ?? options.defaultCoverage ?? 1,
      ...(options.idSuffix === undefined ? {} : { id: `${kind}:${options.idSuffix}` }),
      ...(options.specId === undefined ? {} : { specId: options.specId }),
      ...(options.rationale === undefined ? {} : { rationale: options.rationale }),
      ...(options.createdAtLsn === undefined ? {} : { createdAtLsn: options.createdAtLsn }),
    }),
  );
}

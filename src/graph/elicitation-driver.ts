import type { ElicitationGap } from './schema/elicitation-gaps.js';
import { READINESS_BANDS } from './schema/kinds.js';

export interface ElicitationDriverState {
  readonly agentLens?: 'auto' | ElicitationGap['lensAffinity'];
}

type RankedGap = ElicitationGap & { readonly __rankIndex?: never };

const BAND_RANK = new Map(READINESS_BANDS.map((band, index) => [band, index]));

export function sortElicitationGapsForAsking(
  gaps: readonly ElicitationGap[],
  state: ElicitationDriverState = {},
): readonly ElicitationGap[] {
  return gaps.filter(isEligibleGap).sort((left, right) => compareGaps(left, right, state));
}

export function selectElicitationGap(
  gaps: readonly ElicitationGap[],
  state: ElicitationDriverState = {},
): ElicitationGap | undefined {
  return sortElicitationGapsForAsking(gaps, state)[0];
}

function isEligibleGap(gap: ElicitationGap): boolean {
  return !gap.answered && (gap.disposition === 'open' || gap.disposition === 'reopened');
}

function compareGaps(left: RankedGap, right: RankedGap, state: ElicitationDriverState): number {
  return (
    compareNumber(bandRank(left), bandRank(right)) ||
    compareNumber(right.importance, left.importance) ||
    compareNumber(left.coverage, right.coverage) ||
    compareNumber(affinityScore(right, state), affinityScore(left, state)) ||
    compareNumber(left.createdAtLsn, right.createdAtLsn) ||
    left.id.localeCompare(right.id, undefined, { numeric: true })
  );
}

function bandRank(gap: ElicitationGap): number {
  return BAND_RANK.get(gap.band) ?? Number.MAX_SAFE_INTEGER;
}

function affinityScore(gap: ElicitationGap, state: ElicitationDriverState): number {
  const lens = state.agentLens;
  if (!lens || lens === 'auto') return 0;
  if (gap.lensAffinity === lens) return 1;
  if (gap.planeAffinity === lens) return 1;
  return 0;
}

function compareNumber(left: number, right: number): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

import type { ElicitationGap } from '../../graph/schema/elicitation-gaps.js';
import { READINESS_BANDS } from '../../graph/schema/kinds.js';
import type { ReadinessBand } from '../../graph/schema/nodes.js';

export interface ReadinessEstimate {
  readonly coverage: Readonly<Record<ReadinessBand, number>>;
}

/**
 * Derives the soft D45-L readiness estimate for UI display only.
 *
 * The estimate reports every D64-L band as an importance-weighted mean of gap
 * coverage. Empty bands report 0: no obligations in a band means no established
 * coverage yet, not authority to proceed. This projection gates nothing and may
 * regress honestly as gap coverage changes.
 */
export function readinessEstimate(gaps: readonly ElicitationGap[]): ReadinessEstimate {
  return {
    coverage: Object.fromEntries(
      READINESS_BANDS.map((band) => [band, estimateBandCoverage(gaps.filter((gap) => gap.band === band))]),
    ) as Record<ReadinessBand, number>,
  };
}

function estimateBandCoverage(gaps: readonly ElicitationGap[]): number {
  if (gaps.length === 0) return 0;

  const totalImportance = gaps.reduce((total, gap) => total + Math.max(0, gap.importance), 0);
  if (totalImportance === 0) return average(gaps.map((gap) => clampCoverage(gap.coverage)));

  return (
    gaps.reduce((total, gap) => total + clampCoverage(gap.coverage) * Math.max(0, gap.importance), 0) /
    totalImportance
  );
}

function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function clampCoverage(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

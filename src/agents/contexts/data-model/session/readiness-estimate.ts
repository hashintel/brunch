import type { ElicitationGap } from '../../../../graph/schema/elicitation-gaps.js';
import { READINESS_BANDS } from '../../../../graph/schema/kinds.js';
import { readinessEstimate } from '../../../../projections/session/readiness-estimate.js';

export function renderSoftReadinessEstimate(gaps: readonly ElicitationGap[]): string {
  const estimate = readinessEstimate(gaps);
  const coverage = READINESS_BANDS.map((band) => `${band}=${estimate.coverage[band].toFixed(2)}`).join(', ');
  return `readiness estimate (soft; gates nothing): ${coverage}`;
}

import type { ElicitationGap } from '../../graph/schema/elicitation-gaps.js';
import type { NodeKind } from '../../graph/schema/nodes.js';

export type CapabilityId = 'generative-lens' | 'propose-graph' | 'project-graph' | 'commitment-review';

export const CAPABILITY_RELEVANT_GAPS: Record<CapabilityId, readonly NodeKind[]> = {
  'generative-lens': ['context', 'thesis', 'goal', 'constraint'],
  'propose-graph': ['context', 'thesis', 'goal', 'constraint'],
  'project-graph': ['context', 'thesis', 'goal', 'constraint'],
  'commitment-review': ['context', 'thesis', 'goal', 'constraint'],
};

interface CapabilityMissingGap {
  readonly id: string;
  readonly refersTo: NodeKind;
  readonly question: string;
  readonly rationale: string;
  readonly coverage: number;
}

interface EstablishmentOffer {
  readonly kind: 'establishment_offer';
  readonly message: string;
  readonly missingGaps: readonly CapabilityMissingGap[];
}

export type CapabilityReadinessOutcome =
  | { readonly status: 'proceed' }
  | { readonly status: 'proceed_low_epistemic'; readonly coverage: number }
  | { readonly status: 'negotiate'; readonly offer: EstablishmentOffer };

export function evaluateCapabilityReadiness(
  capability: CapabilityId,
  gaps: readonly ElicitationGap[],
): CapabilityReadinessOutcome {
  const relevantGaps = relevantGapRecords(capability, gaps);
  const missing = relevantGaps.filter((record) => record.coverage <= 0);
  if (missing.length > 0) {
    return {
      status: 'negotiate',
      offer: {
        kind: 'establishment_offer',
        message: `I can try, but answering ${formatGapList(missing)} first would make this materially safer.`,
        missingGaps: missing.map((record) => ({
          id: record.id,
          refersTo: record.refersTo,
          question: record.question,
          rationale: record.rationale,
          coverage: record.coverage,
        })),
      },
    };
  }

  const coverage = relevantGaps.length === 0 ? 0 : average(relevantGaps.map((record) => record.coverage));
  if (coverage >= 1) return { status: 'proceed' };
  return { status: 'proceed_low_epistemic', coverage };
}

function relevantGapRecords(
  capability: CapabilityId,
  gaps: readonly ElicitationGap[],
): readonly ElicitationGap[] {
  const relevantKinds = CAPABILITY_RELEVANT_GAPS[capability];
  return relevantKinds.flatMap((kind) => {
    const records = gaps.filter((record) => record.refersTo === kind);
    if (records.length === 0) throw new Error(`capability ${capability} has no elicitation gap for ${kind}`);
    return records;
  });
}

function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function formatGapList(gaps: readonly ElicitationGap[]): string {
  return gaps.map((record) => `${record.refersTo}: ${record.question}`).join('; ');
}

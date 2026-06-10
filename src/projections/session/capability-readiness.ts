import type { ElicitationGap } from '../../graph/schema/elicitation-gaps.js';

export type CapabilityId = 'generative-lens' | 'propose-graph' | 'project-graph' | 'commitment-review';

type RelevantGapName = 'domain' | 'protagonist' | 'pain_pull' | 'constraint';

export const CAPABILITY_RELEVANT_GAPS: Record<CapabilityId, readonly RelevantGapName[]> = {
  'generative-lens': ['domain', 'protagonist', 'pain_pull', 'constraint'],
  'propose-graph': ['domain', 'protagonist', 'pain_pull', 'constraint'],
  'project-graph': ['domain', 'protagonist', 'pain_pull', 'constraint'],
  'commitment-review': ['domain', 'protagonist', 'pain_pull', 'constraint'],
};

interface CapabilityMissingGap {
  readonly id: string;
  readonly name: string;
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
  const missing = relevantGaps.filter((gap) => gap.coverage <= 0);
  if (missing.length > 0) {
    return {
      status: 'negotiate',
      offer: {
        kind: 'establishment_offer',
        message: `I can try, but answering ${formatGapList(missing)} first would make this materially safer.`,
        missingGaps: missing.map((gap) => ({
          id: gap.id,
          name: gap.name,
          rationale: gap.rationale,
          coverage: gap.coverage,
        })),
      },
    };
  }

  const coverage = relevantGaps.length === 0 ? 0 : average(relevantGaps.map((gap) => gap.coverage));
  if (coverage >= 1) return { status: 'proceed' };
  return { status: 'proceed_low_epistemic', coverage };
}

function relevantGapRecords(
  capability: CapabilityId,
  gaps: readonly ElicitationGap[],
): readonly ElicitationGap[] {
  const relevantNames = CAPABILITY_RELEVANT_GAPS[capability];
  return relevantNames.map((name) => gaps.find((gap) => gap.name === name) ?? missingGap(name));
}

function missingGap(name: RelevantGapName): ElicitationGap {
  return {
    id: `missing:${name}`,
    specId: 0,
    name,
    rationale: `Missing seeded grounding gap: ${name}`,
    basis: 'implicit',
    band: 'grounding',
    predicate: { kind: 'presence', minimum: 1, band: 'grounding' },
    importance: 1,
    coverage: 0,
    answered: false,
    disposition: 'open',
    createdAtLsn: 0,
  };
}

function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function formatGapList(gaps: readonly ElicitationGap[]): string {
  return gaps.map((gap) => gap.name).join(', ');
}

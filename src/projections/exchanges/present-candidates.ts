import type {
  PresentCandidatesDetails,
  PresentCandidatesParams,
} from '../../.pi/extensions/exchanges/schemas/index.js';
import {
  STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
  zPresentCandidatesDetails,
} from '../../.pi/extensions/exchanges/schemas/index.js';

export interface PresentCandidatesProjection {
  readonly heading: string;
  readonly body?: string;
  readonly details: PresentCandidatesDetails;
}

export function projectPresentCandidates(input: PresentCandidatesParams): PresentCandidatesProjection {
  const heading = input.heading.trim();
  const body = normalizeOptionalText(input.body);
  const details = zPresentCandidatesDetails.parse({
    schema: STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
    v: 1,
    exchange_id: input.exchangeId,
    tool_meta: { curr: 'present_candidates', next: 'request_response' },
    display: {
      heading,
      ...(body ? { body } : {}),
    },
    candidates: input.candidates.map((candidate) => ({
      id: candidate.id,
      title: candidate.title.trim(),
      user_rubric: candidate.user_rubric,
      meta_rubric: candidate.meta_rubric,
      graph_refs: candidate.graph_refs,
    })),
  });
  return { heading, ...(body ? { body } : {}), details };
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

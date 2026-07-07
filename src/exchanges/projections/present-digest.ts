import type { PresentDigestDetails, PresentDigestParams } from '../schemas/index.js';
import { STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA } from '../schemas/index.js';

export interface PresentDigestProjection {
  readonly heading: string;
  readonly body?: string;
  readonly details: PresentDigestDetails;
}

export function projectPresentDigest(input: PresentDigestParams): PresentDigestProjection {
  const heading = input.heading.trim();
  const body = normalizeOptionalText(input.body);
  const details: PresentDigestDetails = {
    schema: STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
    v: 1,
    exchange_id: input.exchangeId,
    tool_meta: { curr: 'present_digest', next: 'request_response' },
    display: {
      heading,
      ...(body ? { body } : {}),
    },
    digest: {
      abstract: input.digest.abstract.trim(),
      ...(normalizeOptionalText(input.digest.analysis)
        ? { analysis: normalizeOptionalText(input.digest.analysis) }
        : {}),
      ...(normalizeOptionalText(input.digest.recommendation)
        ? { recommendation: normalizeOptionalText(input.digest.recommendation) }
        : {}),
    },
  };
  return { heading, ...(body ? { body } : {}), details };
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

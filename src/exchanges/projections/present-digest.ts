import type {
  FreeTextAskContinuationDeclaration,
  PresentDigestDetails,
  PresentDigestParams,
} from '../schemas/index.js';
import { STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA } from '../schemas/index.js';
import { normalizeOptionalText } from '../text.js';

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
    tool_meta: { curr: 'present_digest', next: 'ask' },
    display: {
      heading,
      ...(body ? { body } : {}),
    },
    continuation: digestContinuation({ heading, body, digest: input.digest }),
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

function digestContinuation(input: {
  readonly heading: string;
  readonly body: string | undefined;
  readonly digest: PresentDigestParams['digest'];
}): FreeTextAskContinuationDeclaration {
  const digestBody = [
    input.heading,
    input.body,
    `**Abstract**\n\n${input.digest.abstract.trim()}`,
    normalizeOptionalText(input.digest.analysis)
      ? `**Analysis**\n\n${normalizeOptionalText(input.digest.analysis)}`
      : undefined,
    normalizeOptionalText(input.digest.recommendation)
      ? `**Recommendation**\n\n${normalizeOptionalText(input.digest.recommendation)}`
      : undefined,
  ]
    .filter((part): part is string => part !== undefined && part.length > 0)
    .join('\n\n');
  return {
    tool: 'ask',
    params: {
      body: `${digestBody}\n\nDoes this understanding sound right? Add corrections or clarifications before capture.`,
    },
  };
}

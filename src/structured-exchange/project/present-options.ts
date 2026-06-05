import type { PresentOptionsDetails } from '../../.pi/extensions/structured-exchange/schemas/index.js';
import {
  STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
  zPresentOptionsDetails,
  type PresentOptionsParams,
} from '../../.pi/extensions/structured-exchange/schemas/index.js';

export interface PresentOptionsProjection {
  readonly heading: string;
  readonly body?: string;
  readonly details: PresentOptionsDetails;
}

export function projectPresentOptions(input: PresentOptionsParams): PresentOptionsProjection {
  const heading = input.heading.trim();
  const body = normalizeOptionalText(input.body);
  const details = zPresentOptionsDetails.parse({
    schema: STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
    v: 1,
    exchange_id: input.exchangeId,
    tool_meta: {
      curr: 'present_options',
      next: input.expectedRequestTool ?? 'request_choice',
    },
    display: {
      heading,
      ...(body ? { body } : {}),
    },
    options: input.options.map((option) => ({
      id: option.id,
      content: option.content,
      ...(option.rationale !== undefined ? { rationale: option.rationale } : {}),
    })),
  });
  return { heading, ...(body ? { body } : {}), details };
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

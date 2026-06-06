import type { RequestChoiceDetails, SelectedChoice } from '../../.pi/extensions/exchanges/schemas/index.js';
import {
  STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
  zRequestChoiceDetails,
} from '../../.pi/extensions/exchanges/schemas/index.js';

export type RequestChoicePresentTool = 'present_options' | 'present_candidates';

export function projectRequestChoice(input: {
  readonly exchangeId: string;
  readonly respondsToPresentTool: RequestChoicePresentTool;
  readonly status: 'answered' | 'cancelled' | 'unavailable';
  readonly choice?: SelectedChoice | undefined;
  readonly comment?: string | undefined;
  readonly message?: string | undefined;
}): RequestChoiceDetails {
  const base = {
    schema: STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
    v: 1,
    exchange_id: input.exchangeId,
    tool_meta: {
      prev: input.respondsToPresentTool,
      curr: 'request_choice' as const,
    },
  };
  if (input.status === 'answered') {
    const comment = normalizeOptionalText(input.comment);
    return zRequestChoiceDetails.parse({
      ...base,
      answered: {
        choice: input.choice,
        ...(comment !== undefined ? { comment } : {}),
      },
    });
  }
  if (input.status === 'cancelled') {
    return zRequestChoiceDetails.parse({ ...base, cancelled: {} });
  }
  return zRequestChoiceDetails.parse({
    ...base,
    unavailable: { message: input.message ?? 'request_choice unavailable' },
  });
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

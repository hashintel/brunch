import type {
  RequestChoiceDetails,
  RequestOutcomeKey,
  SelectedChoice,
} from '../../.pi/extensions/exchanges/schemas/index.js';
import {
  STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
  zRequestChoiceDetails,
} from '../../.pi/extensions/exchanges/schemas/index.js';

export type { RequestChoiceDetails, RequestOutcomeKey, SelectedChoice };
export type RequestChoicePresentTool = 'present_options' | 'present_candidates';

export function projectRequestChoice(input: {
  readonly exchangeId: string;
  readonly respondsToPresentTool: RequestChoicePresentTool;
  readonly status: RequestOutcomeKey;
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
      tool_meta: {
        ...base.tool_meta,
        next: captureToolForPresentTool(input.respondsToPresentTool),
      },
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

/**
 * The capture tool that answers a request_choice depends on which present tool
 * the request responds to: option lists capture as a plain choice, candidate
 * lists capture as a candidate selection.
 */
function captureToolForPresentTool(
  presentTool: RequestChoicePresentTool,
): 'capture_choice' | 'capture_candidate' {
  return presentTool === 'present_candidates' ? 'capture_candidate' : 'capture_choice';
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

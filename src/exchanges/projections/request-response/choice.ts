import type { AnsweredOptionEcho, RequestChoiceDetails, SelectedChoice } from '../../schemas/index.js';
import { STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA } from '../../schemas/index.js';
import { normalizeOptionalText } from '../../text.js';

export type { AnsweredOptionEcho, RequestChoiceDetails, SelectedChoice };
export type RequestChoicePresentTool = 'present_question' | 'present_candidates';

type RequestChoiceProjectionInput =
  | {
      readonly exchangeId: string;
      readonly respondsToPresentTool: RequestChoicePresentTool;
      readonly status: 'answered';
      readonly choice: SelectedChoice;
      readonly options: readonly AnsweredOptionEcho[];
      readonly comment?: string | undefined;
    }
  | {
      readonly exchangeId: string;
      readonly respondsToPresentTool: RequestChoicePresentTool;
      readonly status: 'cancelled' | 'unavailable';
      readonly message?: string | undefined;
    };

export function projectRequestChoice(input: RequestChoiceProjectionInput): RequestChoiceDetails {
  const base = {
    schema: STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
    v: 1 as const,
    exchange_id: input.exchangeId,
    tool_meta: {
      prev: input.respondsToPresentTool,
      curr: 'request_choice' as const,
    },
  };
  if (input.status === 'answered') {
    const comment = normalizeOptionalText(input.comment);
    const tool_meta =
      input.respondsToPresentTool === 'present_candidates'
        ? ({
            ...base.tool_meta,
            prev: 'present_candidates',
            next: 'capture_candidate',
          } as const)
        : ({
            ...base.tool_meta,
            prev: 'present_question',
            next: 'capture_choice',
          } as const);
    return {
      ...base,
      tool_meta,
      answered: {
        choice: input.choice,
        options: [...input.options],
        ...(comment !== undefined ? { comment } : {}),
      },
    };
  }
  if (input.status === 'cancelled') {
    return { ...base, cancelled: {} };
  }
  return {
    ...base,
    unavailable: { message: input.message ?? 'request_choice unavailable' },
  };
}

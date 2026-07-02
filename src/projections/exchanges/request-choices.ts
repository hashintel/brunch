import type { RequestChoicesDetails, SelectedChoice } from '../../.pi/extensions/exchanges/schemas/index.js';
import {
  REQUEST_OUTCOME_KEYS,
  STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
} from '../../.pi/extensions/exchanges/schemas/index.js';

// Re-exported so session-side consumers can reach the outcome union without
// importing extension internals.
export { REQUEST_OUTCOME_KEYS };
export type { RequestChoicesDetails, SelectedChoice };
type RequestChoicesProjectionInput =
  | {
      readonly exchangeId: string;
      readonly status: 'answered';
      readonly choices: readonly SelectedChoice[];
      readonly comment?: string | undefined;
    }
  | {
      readonly exchangeId: string;
      readonly status: 'cancelled' | 'unavailable';
      readonly message?: string | undefined;
    };

export function projectRequestChoices(input: RequestChoicesProjectionInput): RequestChoicesDetails {
  const base = {
    schema: STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
    v: 1 as const,
    exchange_id: input.exchangeId,
    tool_meta: {
      prev: 'present_question' as const,
      curr: 'request_choices' as const,
    },
  };
  if (input.status === 'answered') {
    const comment = normalizeOptionalText(input.comment);
    return {
      ...base,
      tool_meta: { ...base.tool_meta, next: 'capture_choices' as const },
      answered: {
        choices: [...input.choices],
        ...(comment !== undefined ? { comment } : {}),
      },
    };
  }
  if (input.status === 'cancelled') {
    return { ...base, cancelled: {} };
  }
  return {
    ...base,
    unavailable: { message: input.message ?? 'request_choices unavailable' },
  };
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

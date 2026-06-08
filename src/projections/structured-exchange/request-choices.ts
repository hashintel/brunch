import type { RequestChoicesDetails, SelectedChoice } from '../../.pi/extensions/exchanges/schemas/index.js';
import {
  STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
  zRequestChoicesDetails,
} from '../../.pi/extensions/exchanges/schemas/index.js';

export type { RequestChoicesDetails, SelectedChoice };
export function projectRequestChoices(input: {
  readonly exchangeId: string;
  readonly status: 'answered' | 'cancelled' | 'unavailable';
  readonly choices?: readonly SelectedChoice[] | undefined;
  readonly comment?: string | undefined;
  readonly message?: string | undefined;
}): RequestChoicesDetails {
  const base = {
    schema: STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
    v: 1,
    exchange_id: input.exchangeId,
    tool_meta: {
      prev: 'present_options' as const,
      curr: 'request_choices' as const,
    },
  };
  if (input.status === 'answered') {
    const comment = normalizeOptionalText(input.comment);
    return zRequestChoicesDetails.parse({
      ...base,
      tool_meta: { ...base.tool_meta, next: 'capture_choices' as const },
      answered: {
        choices: input.choices ?? [],
        ...(comment !== undefined ? { comment } : {}),
      },
    });
  }
  if (input.status === 'cancelled') {
    return zRequestChoicesDetails.parse({ ...base, cancelled: {} });
  }
  return zRequestChoicesDetails.parse({
    ...base,
    unavailable: { message: input.message ?? 'request_choices unavailable' },
  });
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

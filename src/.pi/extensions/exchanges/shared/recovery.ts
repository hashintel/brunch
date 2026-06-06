import type { PresentDetails, RequestDetails } from '../schemas/index.js';
import { zPresentDetails, zRequestDetails } from '../schemas/index.js';

export function isStructuredExchangePresentDetails(value: unknown): value is PresentDetails {
  return zPresentDetails.safeParse(value).success;
}

export function isStructuredExchangeRequestDetails(value: unknown): value is RequestDetails {
  return zRequestDetails.safeParse(value).success;
}

interface EntryLike {
  type?: unknown;
  message?: {
    role?: unknown;
    details?: unknown;
  };
}

function toolResultDetails(entry: EntryLike): unknown {
  return entry.type === 'message' && entry.message?.role === 'toolResult' ? entry.message.details : undefined;
}

export interface IncompleteStructuredExchangePresent {
  entry: EntryLike;
  details: PresentDetails;
}

export function findIncompleteStructuredExchangePresents(
  entries: readonly EntryLike[],
): IncompleteStructuredExchangePresent[] {
  const presents = new Map<string, IncompleteStructuredExchangePresent>();
  const completed = new Set<string>();

  for (const entry of entries) {
    const details = toolResultDetails(entry);
    if (isStructuredExchangePresentDetails(details)) {
      presents.set(details.exchange_id, { entry, details });
    } else if (isStructuredExchangeRequestDetails(details)) {
      completed.add(details.exchange_id);
    }
  }

  return [...presents.values()].filter((present) => !completed.has(present.details.exchange_id));
}

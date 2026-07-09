import type { PresentDetails, RequestDetails } from './schemas/index.js';
import { zPresentDetails, zRequestDetails } from './schemas/index.js';

export function isStructuredExchangePresentDetails(value: unknown): value is PresentDetails {
  return zPresentDetails.safeParse(value).success;
}

export function isStructuredExchangeRequestDetails(value: unknown): value is RequestDetails {
  return zRequestDetails.safeParse(value).success;
}

export interface EntryLike {
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
  continuationTool: 'ask';
}

export function findIncompleteStructuredExchangePresents(
  entries: readonly EntryLike[],
): IncompleteStructuredExchangePresent[] {
  const presents = new Map<string, IncompleteStructuredExchangePresent>();
  const completed = new Set<string>();

  for (const entry of entries) {
    const details = toolResultDetails(entry);
    if (isStructuredExchangePresentDetails(details)) {
      if (details.tool_meta.curr === 'present_question') continue;
      presents.set(details.exchange_id, {
        entry,
        details,
        continuationTool: 'continuation' in details ? (details.continuation?.tool ?? 'ask') : 'ask',
      });
    } else if (isStructuredExchangeRequestDetails(details)) {
      // Completion contract: only an answered terminal closes an exchange for
      // recovery purposes. Cancelled/unavailable terminals keep the declared
      // continuation resumable — the /brunch:continue hint and ask({continues})
      // both promise re-collection after those outcomes.
      if ('answered' in details) completed.add(details.exchange_id);
    }
  }

  return [...presents.values()].filter((present) => !completed.has(present.details.exchange_id));
}

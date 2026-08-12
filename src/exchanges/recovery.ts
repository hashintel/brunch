import type { PresentDetails, RequestDetails, StandaloneAskParams } from './schemas/index.js';
import {
  parseAskParams,
  zAskDetails,
  zPresentDetails,
  zPresentDigestDetails,
  zRequestDetails,
  zRequestReviewDetails,
} from './schemas/index.js';

export function isStructuredExchangePresentDetails(value: unknown): value is PresentDetails {
  return zPresentDetails.safeParse(value).success;
}

export function isStructuredExchangeRequestDetails(value: unknown): value is RequestDetails {
  return zRequestDetails.safeParse(value).success;
}

export function resolveEligibleDigestAcceptance(
  entries: readonly EntryLike[],
  acceptsDigest: string,
): ReturnType<typeof zPresentDigestDetails.parse> | undefined {
  const details = entries.map(toolResultDetails).filter((value) => value !== undefined);
  const digests = details.flatMap((value) => {
    const parsed = zPresentDigestDetails.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });
  const digestClosedForAcceptance = details.some((value) => {
    const ask = zAskDetails.safeParse(value);
    if (ask.success && 'accepts_digest' in ask.data && ask.data.accepts_digest === acceptsDigest) return true;

    const legacyReview = zRequestReviewDetails.safeParse(value);
    return (
      legacyReview.success &&
      legacyReview.data.exchange_id === acceptsDigest &&
      legacyReview.data.tool_meta.prev === 'present_digest' &&
      'answered' in legacyReview.data
    );
  });
  const digest = [...digests].reverse().find((candidate) => candidate.exchange_id === acceptsDigest);
  return digest && digests.at(-1)?.exchange_id === acceptsDigest && !digestClosedForAcceptance
    ? digest
    : undefined;
}

export interface EntryLike {
  type?: unknown;
  message?: {
    role?: unknown;
    content?: unknown;
    toolCallId?: unknown;
    toolName?: unknown;
    details?: unknown;
  };
}

export interface UnresolvedStandaloneAsk {
  entry: EntryLike;
  toolCallId: string;
  params: StandaloneAskParams;
}

/** Recover only an unambiguous, provider-authored standalone ask on the supplied active branch. */
export function findProviderStandaloneAskCalls(entries: readonly EntryLike[]): UnresolvedStandaloneAsk[] {
  const calls: UnresolvedStandaloneAsk[] = [];

  for (const entry of entries) {
    const message = entry.type === 'message' ? entry.message : undefined;
    if (message?.role === 'assistant' && Array.isArray(message.content)) {
      for (const block of message.content) {
        if (
          !isRecord(block) ||
          block.type !== 'toolCall' ||
          block.name !== 'ask' ||
          typeof block.id !== 'string'
        )
          continue;
        const parsed = parseAskParams(block.arguments);
        if (!parsed.success || 'continues' in parsed.data || parsed.data.questions !== undefined) continue;
        calls.push({ entry, toolCallId: block.id, params: parsed.data });
      }
    }
  }
  return calls;
}

export function findUnresolvedStandaloneAsk(
  entries: readonly EntryLike[],
): UnresolvedStandaloneAsk | undefined {
  const calls = findProviderStandaloneAskCalls(entries);
  const resultCallIds = new Set(
    entries.flatMap((entry) => {
      const message = entry.type === 'message' ? entry.message : undefined;
      return message?.role === 'toolResult' &&
        message.toolName === 'ask' &&
        typeof message.toolCallId === 'string'
        ? [message.toolCallId]
        : [];
    }),
  );
  const unresolved = calls.filter((call) => !resultCallIds.has(call.toolCallId));
  if (unresolved.length !== 1) return undefined;
  const [candidate] = unresolved;
  if (calls.some((call) => call !== candidate && call.params.exchangeId === candidate!.params.exchangeId))
    return undefined;
  return candidate;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

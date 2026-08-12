import * as z from 'zod';

import { findUnresolvedStandaloneAsk, isStructuredExchangePresentDetails } from '../../exchanges/recovery.js';
import type { PresentDetails } from '../../exchanges/schemas/index.js';
import type { BrunchSessionEnvelope } from '../brunch-session-envelope.js';
import { projectLinearSessionExchangeProjection } from '../exchange-projection.js';

const zNonBlankString = z.string().min(1);

export const zPendingStructuredExchange = z
  .object({
    exchangeId: zNonBlankString,
    lens: z.literal('intent'),
    mode: z.enum(['text', 'single-select', 'multi-select', 'review']),
    prompt: zNonBlankString,
    details: zNonBlankString.optional(),
    options: z.array(
      z
        .object({
          id: zNonBlankString,
          label: zNonBlankString,
          content: zNonBlankString,
          rationale: zNonBlankString.optional(),
        })
        .strict(),
    ),
    note: z.object({ allowed: z.boolean() }).strict(),
    reviewSet: z.record(z.string(), z.unknown()).optional(),
    digestAbstract: zNonBlankString.optional(),
    // Which present tool opened this exchange when the terminal request detail
    // cannot be inferred from mode alone. Candidate lists and prompt option
    // lists both answer via request_choice; review-set and digest both answer
    // via request_review.
    respondsToPresentTool: z.enum(['present_candidates', 'present_review_set', 'present_digest']).optional(),
  })
  .strict();
export const PendingStructuredExchangeSchema = z.toJSONSchema(zPendingStructuredExchange, {
  unrepresentable: 'throw',
});

export type PendingStructuredExchange = z.infer<typeof zPendingStructuredExchange>;

const providerToolCallId = Symbol('providerToolCallId');
type ProviderCorrelatedPending = PendingStructuredExchange & { [providerToolCallId]?: string };

export function providerToolCallIdForPending(pending: PendingStructuredExchange): string | undefined {
  return (pending as ProviderCorrelatedPending)[providerToolCallId];
}

export interface PendingChoice {
  id: string;
  label: string;
  content: string;
  rationale?: string;
}

export function pendingExchangeFromEnvelope(
  envelope: BrunchSessionEnvelope,
): PendingStructuredExchange | null {
  const projection = projectLinearSessionExchangeProjection(envelope);
  if (!projection.openPrompt) {
    return null;
  }

  for (const entryId of projection.openPrompt.promptEntryIds) {
    const entry = envelope.entries.find(
      (candidate) =>
        candidate.type === 'custom_message' &&
        candidate.id === entryId &&
        candidate.customType === 'brunch.elicitation_prompt' &&
        zPendingStructuredExchange.safeParse(candidate.details).success,
    );
    if (entry?.type === 'custom_message') {
      return zPendingStructuredExchange.parse(entry.details);
    }
  }

  for (const entryId of projection.openPrompt.promptEntryIds) {
    const entry = envelope.entries.find(
      (candidate) => candidate.type === 'message' && candidate.id === entryId,
    );
    const details = structuredExchangePresentDetails(entry);
    if (!details) continue;
    const text = textContent((entry as { message: { content?: unknown } }).message.content);
    const pending = pendingExchangeFromStructuredPresent(details, text);
    if (pending) return pending;
  }

  const recovered = findUnresolvedStandaloneAsk(envelope.entries);
  if (!recovered) return null;
  const options = (recovered.params.options ?? []).map((option) => ({
    id: option.id,
    label: option.label,
    content: option.label,
    ...(option.description !== undefined ? { rationale: option.description } : {}),
  }));
  const pending: ProviderCorrelatedPending = {
    exchangeId: recovered.params.exchangeId,
    lens: 'intent',
    mode: options.length === 0 ? 'text' : recovered.params.multiple ? 'multi-select' : 'single-select',
    prompt: recovered.params.body,
    ...(recovered.params.commentPrompt ? { details: recovered.params.commentPrompt } : {}),
    options,
    note: { allowed: recovered.params.commentPrompt !== undefined },
  };
  Object.defineProperty(pending, providerToolCallId, { value: recovered.toolCallId });
  return pending;
}

export function projectPendingStructuredExchange(
  envelope: BrunchSessionEnvelope,
): { status: 'pending'; exchange: PendingStructuredExchange } | { status: 'idle'; exchange: null } {
  const exchange = pendingExchangeFromEnvelope(envelope);
  if (!exchange) {
    return { status: 'idle', exchange: null };
  }
  return { status: 'pending', exchange };
}

function pendingExchangeFromStructuredPresent(
  details: PresentDetails,
  markdown: string,
): PendingStructuredExchange | undefined {
  const prompt = details.display.heading;
  const detailsText = presentDetailsText(details, markdown);
  if ('review_set' in details) {
    return {
      exchangeId: details.exchange_id,
      lens: 'intent',
      mode: 'review',
      prompt,
      ...(detailsText.length > 0 ? { details: detailsText } : {}),
      options: pendingOptionsFromContinuation(details),
      note: { allowed: true },
      reviewSet: details.review_set,
      respondsToPresentTool: 'present_review_set',
    };
  }

  if ('digest' in details) {
    if (!details.continuation) return undefined;
    return {
      exchangeId: details.exchange_id,
      lens: 'intent',
      mode: 'text',
      prompt: details.continuation.params.body,
      ...(detailsText.length > 0 ? { details: detailsText } : {}),
      options: [],
      note: { allowed: true },
      digestAbstract: details.digest.abstract,
      respondsToPresentTool: 'present_digest',
    };
  }

  if ('candidates' in details) {
    return {
      exchangeId: details.exchange_id,
      lens: 'intent',
      mode: 'single-select',
      prompt,
      ...(detailsText.length > 0 ? { details: detailsText } : {}),
      options: pendingOptionsFromContinuation(details),
      note: { allowed: true },
      respondsToPresentTool: 'present_candidates',
    };
  }

  return undefined;
}

function presentDetailsText(details: PresentDetails, markdown: string): string {
  if ('preface' in details.display && details.display.preface && details.display.body) {
    return `${details.display.preface}\n\n${details.display.body}`;
  }
  if ('preface' in details.display && details.display.preface) return details.display.preface;
  return details.display.body ?? markdown;
}

function pendingOptionsFromContinuation(
  details: Extract<PresentDetails, { readonly continuation?: unknown }>,
): PendingChoice[] {
  if (details.continuation) {
    return (details.continuation.params.options ?? []).map((option) => ({
      id: option.id,
      label: option.label,
      content: option.label,
      ...(option.description !== undefined ? { rationale: option.description } : {}),
    }));
  }
  if ('candidates' in details) return parsePendingCandidates(details.candidates);
  return [];
}

function parsePendingCandidates(value: unknown, markdown: string = ''): PendingChoice[] {
  if (!Array.isArray(value)) return parseMarkdownPendingOptions(markdown);
  const candidates = value.flatMap((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return [];
    const id = (candidate as { id?: unknown }).id;
    const title = (candidate as { title?: unknown }).title;
    if (typeof id !== 'string' || typeof title !== 'string') return [];
    return [{ id, label: title, content: title }];
  });
  return candidates.length > 0 ? candidates : parseMarkdownPendingOptions(markdown);
}

function parseMarkdownPendingOptions(markdown: string): PendingChoice[] {
  const options: PendingChoice[] = [];
  let pending:
    | {
        content: string;
        rationale?: string;
      }
    | undefined;

  for (const line of markdown.split('\n')) {
    const heading = /^#{2,3}\s+\d+\.\s+(.+)$/.exec(line.trim());
    if (heading) {
      pending = { content: heading[1]!.trim() };
      continue;
    }

    const rationale = /^\*\*Rationale:\*\*\s+(.+)$/.exec(line.trim());
    if (rationale && pending) {
      pending.rationale = rationale[1]!.trim();
      continue;
    }

    const optionId = /<!--\s*option-id:\s*([^>]+?)\s*-->/.exec(line.trim());
    if (optionId && pending) {
      const content = pending.content;
      options.push({
        id: optionId[1]!.trim(),
        label: content,
        content,
        ...(pending.rationale === undefined ? {} : { rationale: pending.rationale }),
      });
      pending = undefined;
    }
  }

  return options;
}

function structuredExchangePresentDetails(entry: unknown): PresentDetails | undefined {
  if (typeof entry !== 'object' || entry === null || (entry as { type?: unknown }).type !== 'message') {
    return undefined;
  }
  const message = (entry as { message?: unknown }).message;
  if (
    typeof message !== 'object' ||
    message === null ||
    (message as { role?: unknown }).role !== 'toolResult'
  ) {
    return undefined;
  }
  const details = (message as { details?: unknown }).details;
  return isStructuredExchangePresentDetails(details) ? (details as PresentDetails) : undefined;
}

function textContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) =>
      typeof part === 'object' && part !== null && typeof (part as { text?: unknown }).text === 'string'
        ? (part as { text: string }).text
        : '',
    )
    .filter((text) => text.length > 0)
    .join('\n');
}

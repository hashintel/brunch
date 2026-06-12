import * as z from 'zod';

import type { PresentDetails } from '../.pi/extensions/exchanges/schemas/index.js';
import { isStructuredExchangePresentDetails } from '../.pi/extensions/exchanges/shared/recovery.js';
import { projectRequestAnswer } from '../projections/exchanges/request-answer.js';
import { projectRequestChoice } from '../projections/exchanges/request-choice.js';
import { projectRequestChoices } from '../projections/exchanges/request-choices.js';
import { projectRequestReview } from '../projections/exchanges/request-review.js';
import type { BrunchSessionEnvelope } from './brunch-session-envelope.js';
import { projectLinearSessionExchangeProjection } from './exchange-projection.js';

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
    // Which present tool opened a single-select exchange. Candidate lists and
    // option lists both answer via request_choice but capture differently
    // (capture_candidate vs capture_choice), so the provenance must round-trip
    // rather than be assumed. Absent ⇒ present_options.
    respondsToPresentTool: z.enum(['present_options', 'present_candidates']).optional(),
  })
  .strict();
export const PendingStructuredExchangeSchema = z.toJSONSchema(zPendingStructuredExchange, {
  unrepresentable: 'throw',
});

interface StructuredExchangeTextResponseInput {
  exchangeId: string;
  answer: { text: string };
  note?: string | undefined;
}

interface StructuredExchangeSingleChoiceResponseInput {
  exchangeId: string;
  answer: { optionId: string };
  note?: string | undefined;
}

interface StructuredExchangeMultiChoiceResponseInput {
  exchangeId: string;
  answer: { optionIds: string[] };
  note?: string | undefined;
}

interface StructuredExchangeReviewResponseInput {
  exchangeId: string;
  answer: { review: { decision: 'approve' | 'request_changes' | 'reject'; comment?: string | undefined } };
  note?: string | undefined;
}

export type StructuredExchangeResponseInput =
  | StructuredExchangeTextResponseInput
  | StructuredExchangeSingleChoiceResponseInput
  | StructuredExchangeMultiChoiceResponseInput
  | StructuredExchangeReviewResponseInput;

interface AcceptedToolTextContent {
  type: 'text';
  text: string;
}

interface AcceptedToolResultMessage {
  role: 'toolResult';
  toolCallId: string;
  toolName: string;
  content: AcceptedToolTextContent[];
  details: Record<string, unknown>;
  isError: false;
  timestamp: 0;
}

export type PendingStructuredExchange = z.infer<typeof zPendingStructuredExchange>;

export type AcceptedStructuredExchangeResponse =
  | {
      ok: true;
      answer: Record<string, unknown>;
      /** Synthetic assistant tool_use pairing `toolResultMessage`; append both, call first. */
      toolCallMessage: SyntheticExchangeToolCallMessage;
      toolResultMessage: AcceptedToolResultMessage;
    }
  | {
      ok: false;
      message: string;
    };

/**
 * Synthetic assistant tool-call message pairing a synthetic exchange
 * toolResult. Real providers require every `tool_result` to reference a
 * `tool_use` from the immediately preceding assistant message — an orphan
 * toolResult is a 400 — so product-originated exchange tuples persist the
 * same call+result pair an LLM-driven exchange produces. Provenance fields
 * are honest sentinels (`brunch-exchange`), never a real provider id.
 */
export interface SyntheticExchangeToolCallMessage {
  role: 'assistant';
  content: [{ type: 'toolCall'; id: string; name: string; arguments: Record<string, unknown> }];
  api: string;
  provider: string;
  model: string;
  usage: {
    input: 0;
    output: 0;
    cacheRead: 0;
    cacheWrite: 0;
    totalTokens: 0;
    cost: { input: 0; output: 0; cacheRead: 0; cacheWrite: 0; total: 0 };
  };
  stopReason: 'toolUse';
  timestamp: 0;
}

/**
 * Anthropic constrains `tool_use_id` to `^[a-zA-Z0-9_-]+$`, so the synthetic
 * id joins exchange id and tool name with `__` (never `:`).
 */
function exchangeToolCallId(exchangeId: string, toolName: string): string {
  return `${exchangeId}__${toolName}`;
}

export function syntheticExchangeToolCallMessage(
  exchangeId: string,
  toolName: string,
): SyntheticExchangeToolCallMessage {
  return {
    role: 'assistant',
    content: [
      {
        type: 'toolCall',
        id: exchangeToolCallId(exchangeId, toolName),
        name: toolName,
        arguments: { exchangeId },
      },
    ],
    api: 'brunch-exchange',
    provider: 'brunch',
    model: 'brunch-structured-exchange',
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: 'toolUse',
    timestamp: 0,
  };
}

interface PendingChoice {
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
    return pendingExchangeFromStructuredPresent(details, text);
  }

  return null;
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

export function acceptedResponseFromParams(
  pending: PendingStructuredExchange,
  params: StructuredExchangeResponseInput,
): AcceptedStructuredExchangeResponse {
  if ('text' in params.answer) {
    if (pending.mode !== 'text') return invalidResponseMode();
    return {
      ok: true,
      answer: { text: params.answer.text },
      toolCallMessage: syntheticExchangeToolCallMessage(pending.exchangeId, 'request_answer'),
      toolResultMessage: {
        ...toolResultMessageBase(pending, 'request_answer'),
        content: [{ type: 'text', text: `### Response\n\n${params.answer.text}` }],
        details: projectRequestAnswer({
          exchangeId: pending.exchangeId,
          status: 'answered',
          answer: params.answer.text,
        }),
      },
    };
  }

  if ('optionId' in params.answer) {
    if (pending.mode !== 'single-select') return invalidResponseMode();
    const optionId = params.answer.optionId;
    const choice = pending.options.find((option) => option.id === optionId);
    if (!choice) return { ok: false, message: 'Invalid elicitation option' };
    const comment = params.note?.trim();
    return {
      ok: true,
      answer: { optionId: choice.id, label: choice.label },
      toolCallMessage: syntheticExchangeToolCallMessage(pending.exchangeId, 'request_choice'),
      toolResultMessage: {
        ...toolResultMessageBase(pending, 'request_choice'),
        content: [{ type: 'text', text: choiceResponseMarkdown([choice], params.note) }],
        details: projectRequestChoice({
          exchangeId: pending.exchangeId,
          respondsToPresentTool: pending.respondsToPresentTool ?? 'present_options',
          status: 'answered',
          choice: { id: choice.id, label: choice.label, kind: choiceKind(choice.id) },
          comment,
        }),
      },
    };
  }

  if ('review' in params.answer) {
    if (pending.mode !== 'review') return invalidResponseMode();
    const review = params.answer.review;
    const comment = review.comment?.trim();
    if (review.decision === 'request_changes' && (comment === undefined || comment.length === 0)) {
      return { ok: false, message: 'Review request_changes requires a comment' };
    }
    return {
      ok: true,
      answer: {
        review: {
          decision: review.decision,
          ...(comment !== undefined ? { comment } : {}),
        },
      },
      toolCallMessage: syntheticExchangeToolCallMessage(pending.exchangeId, 'request_review'),
      toolResultMessage: {
        ...toolResultMessageBase(pending, 'request_review'),
        content: [{ type: 'text', text: reviewResponseMarkdown(review.decision, comment) }],
        details: projectRequestReview({
          exchangeId: pending.exchangeId,
          status: 'answered',
          review: review.decision,
          comment,
        }),
      },
    };
  }

  if (pending.mode !== 'multi-select') return invalidResponseMode();
  const selected = params.answer.optionIds.map((id) => pending.options.find((option) => option.id === id));
  if (selected.some((choice) => choice === undefined)) {
    return { ok: false, message: 'Invalid elicitation option' };
  }
  const choices = selected as PendingChoice[];
  if (
    choices.some((choice) => choice.id === 'other' || choice.id === 'none') &&
    (params.note === undefined || params.note.trim().length === 0)
  ) {
    return {
      ok: false,
      message: 'Elicitation response requires a comment for Other or None selections',
    };
  }
  const comment = params.note?.trim();
  return {
    ok: true,
    answer: { optionIds: choices.map((choice) => choice.id), choices },
    toolCallMessage: syntheticExchangeToolCallMessage(pending.exchangeId, 'request_choices'),
    toolResultMessage: {
      ...toolResultMessageBase(pending, 'request_choices'),
      content: [{ type: 'text', text: choiceResponseMarkdown(choices, params.note) }],
      details: projectRequestChoices({
        exchangeId: pending.exchangeId,
        status: 'answered',
        choices: choices.map((choice) => ({
          id: choice.id,
          label: choice.label,
          kind: choiceKind(choice.id),
        })),
        comment,
      }),
    },
  };
}

function invalidResponseMode(): AcceptedStructuredExchangeResponse {
  return {
    ok: false,
    message: 'Elicitation response mode does not match pending exchange',
  };
}

function choiceKind(id: string): 'listed' | 'other' | 'none' {
  if (id === 'other') return 'other';
  if (id === 'none') return 'none';
  return 'listed';
}

function toolResultMessageBase(
  pending: PendingStructuredExchange,
  requestTool: 'request_answer' | 'request_choice' | 'request_choices' | 'request_review',
) {
  return {
    role: 'toolResult' as const,
    toolCallId: exchangeToolCallId(pending.exchangeId, requestTool),
    toolName: requestTool,
    isError: false as const,
    timestamp: 0 as const,
  };
}

function choiceResponseMarkdown(choices: Array<{ label: string }>, comment: string | undefined): string {
  const lines = ['### Response', '', ...choices.map((choice) => `- ${choice.label}`)];
  if (comment !== undefined && comment.trim().length > 0) {
    lines.push('', 'Comment:', '', `> ${comment.trim()}`);
  }
  return lines.join('\n');
}

function reviewResponseMarkdown(
  decision: 'approve' | 'request_changes' | 'reject',
  comment: string | undefined,
): string {
  const label =
    decision === 'approve' ? 'Approved' : decision === 'request_changes' ? 'Requested changes' : 'Rejected';
  const lines = ['### Review decision', '', label];
  if (comment !== undefined && comment.length > 0) {
    lines.push('', 'Comment:', '', `> ${comment}`);
  }
  return lines.join('\n');
}

function pendingExchangeFromStructuredPresent(
  details: PresentDetails,
  markdown: string,
): PendingStructuredExchange {
  const prompt = details.display.heading;
  const detailsText = presentDetailsText(details, markdown);
  if ('review_set' in details) {
    return {
      exchangeId: details.exchange_id,
      lens: 'intent',
      mode: 'review',
      prompt,
      ...(detailsText.length > 0 ? { details: detailsText } : {}),
      options: [],
      note: { allowed: true },
      reviewSet: details.review_set,
    };
  }

  const mode =
    details.tool_meta.next === 'request_choices'
      ? 'multi-select'
      : details.tool_meta.curr === 'present_question'
        ? 'text'
        : 'single-select';

  return {
    exchangeId: details.exchange_id,
    lens: 'intent',
    mode,
    prompt,
    ...(detailsText.length > 0 ? { details: detailsText } : {}),
    options:
      'options' in details
        ? parsePendingOptions(details.options, markdown)
        : parsePendingOptions(undefined, markdown),
    note: { allowed: true },
    // Preserve which present tool opened a single-select exchange so the answer
    // captures as the matching tool (candidate vs choice).
    ...(mode === 'single-select' && details.tool_meta.curr === 'present_candidates'
      ? { respondsToPresentTool: 'present_candidates' as const }
      : {}),
  };
}

function presentDetailsText(details: PresentDetails, markdown: string): string {
  if ('preface' in details.display && details.display.preface && details.display.body) {
    return `${details.display.preface}\n\n${details.display.body}`;
  }
  if ('preface' in details.display && details.display.preface) return details.display.preface;
  return details.display.body ?? markdown;
}

function parsePendingOptions(value: unknown, markdown: string = ''): PendingChoice[] {
  if (!Array.isArray(value)) return parseMarkdownPendingOptions(markdown);
  const options = value.flatMap((option) => {
    if (typeof option !== 'object' || option === null) return [];
    const id = (option as { id?: unknown }).id;
    const label = (option as { label?: unknown }).label;
    const content = (option as { content?: unknown }).content;
    const rationale = (option as { rationale?: unknown }).rationale;
    if (typeof id !== 'string') return [];
    const optionContent =
      typeof content === 'string' ? content : typeof label === 'string' ? label : undefined;
    if (optionContent === undefined) return [];
    return [
      {
        id,
        label: typeof label === 'string' ? label : optionContent,
        content: optionContent,
        ...(typeof rationale === 'string' ? { rationale } : {}),
      },
    ];
  });
  return options.length > 0 ? options : parseMarkdownPendingOptions(markdown);
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
    const heading = /^###\s+\d+\.\s+(.+)$/.exec(line.trim());
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

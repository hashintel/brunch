import * as z from 'zod';

import type { PresentDetails } from '../.pi/extensions/exchanges/schemas/index.js';
import { isStructuredExchangePresentDetails } from '../.pi/extensions/exchanges/shared/recovery.js';
import { projectPresentOptions } from '../projections/structured-exchange/present-options.js';
import { projectPresentQuestion } from '../projections/structured-exchange/present-question.js';
import { projectRequestAnswer } from '../projections/structured-exchange/request-answer.js';
import { projectRequestChoice } from '../projections/structured-exchange/request-choice.js';
import { projectRequestChoices } from '../projections/structured-exchange/request-choices.js';
import { formatPresentOptions } from '../renderers/structured-exchange/present-options.js';
import { formatPresentQuestion } from '../renderers/structured-exchange/present-question.js';
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
  })
  .strict();
export const PendingStructuredExchangeSchema = z.toJSONSchema(zPendingStructuredExchange, {
  unrepresentable: 'throw',
});

export interface StructuredExchangeTextResponseInput {
  exchangeId: string;
  answer: { text: string };
  note?: string | undefined;
}

export interface StructuredExchangeSingleChoiceResponseInput {
  exchangeId: string;
  answer: { optionId: string };
  note?: string | undefined;
}

export interface StructuredExchangeMultiChoiceResponseInput {
  exchangeId: string;
  answer: { optionIds: string[] };
  note?: string | undefined;
}

export type StructuredExchangeResponseInput =
  | StructuredExchangeTextResponseInput
  | StructuredExchangeSingleChoiceResponseInput
  | StructuredExchangeMultiChoiceResponseInput;

export interface AcceptedToolTextContent {
  type: 'text';
  text: string;
}

export interface AcceptedToolResultMessage {
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
      toolResultMessage: AcceptedToolResultMessage;
    }
  | {
      ok: false;
      message: string;
    };

interface PendingChoice {
  id: string;
  label: string;
  content: string;
  rationale?: string;
}

export function nextDeterministicStructuredExchange(completedCount: number): PendingStructuredExchange {
  const turnNumber = completedCount + 1;
  const script: PendingStructuredExchange[] = [
    {
      exchangeId: `deterministic-grounding-choice-${turnNumber}`,
      lens: 'intent',
      mode: 'single-select',
      prompt: 'Is this a new product or feature from scratch?',
      details: 'Choose the best starting context so later elicitation can ask useful follow-ups.',
      options: [
        {
          id: 'new-from-scratch',
          label: 'Yes — this is new from scratch',
          content: 'Start a new spec workspace from a blank slate.',
          rationale: 'This keeps the parity run focused on initial grounding.',
        },
        {
          id: 'existing-codebase',
          label: 'No — this builds on existing code',
          content: 'Ground the spec in existing implementation constraints.',
          rationale: 'Existing code changes what the elicitor should inspect next.',
        },
        {
          id: 'relates-to-existing-spec',
          label: 'It relates to an existing spec',
          content: 'Connect this work to a prior specification thread.',
          rationale: 'Continuity matters when prior graph intent exists.',
        },
      ],
      note: { allowed: true },
    },
    {
      exchangeId: `deterministic-grounding-text-${turnNumber}`,
      lens: 'intent',
      mode: 'text',
      prompt: 'What are we specifying?',
      details:
        "This covers the text-answer permutation in Brunch's deterministic public-RPC structured-exchange parity proof.",
      options: [],
      note: { allowed: true },
    },
    {
      exchangeId: `deterministic-grounding-multi-${turnNumber}`,
      lens: 'intent',
      mode: 'multi-select',
      prompt: 'Which proof qualities matter for this parity run?',
      details:
        'Select all qualities the deterministic structured-exchange permutation proof should preserve.',
      options: [
        {
          id: 'transcript',
          label: 'Transcript fidelity',
          content: 'Pi JSONL keeps every present/request tuple recoverable.',
          rationale: 'The transcript is the durable source of truth.',
        },
        {
          id: 'projection',
          label: 'Projection fidelity',
          content: 'Brunch projections preserve semantic option artifacts.',
          rationale: 'Public clients depend on projected structured exchange data.',
        },
        {
          id: 'other',
          label: 'Other',
          content: 'Another proof quality should be captured in the note.',
          rationale: 'Other requires a comment so the transcript stays explicit.',
        },
        {
          id: 'none',
          label: 'None',
          content: 'No additional proof qualities matter for this run.',
          rationale: 'None requires a comment to avoid silent dismissal.',
        },
      ],
      note: { allowed: true },
    },
  ];
  return script[completedCount % script.length]!;
}

export function presentToolResultMessage(exchange: PendingStructuredExchange) {
  const projection = presentProjection(exchange);
  return {
    role: 'toolResult' as const,
    toolCallId: `${exchange.exchangeId}:${projection.toolName}`,
    toolName: projection.toolName,
    content: [{ type: 'text' as const, text: projection.markdown }],
    details: projection.details,
    isError: false as const,
    timestamp: 0 as const,
  };
}

function presentProjection(exchange: PendingStructuredExchange): {
  toolName: 'present_question' | 'present_options';
  markdown: string;
  details: PresentDetails;
} {
  if (exchange.mode === 'text') {
    const projection = projectPresentQuestion({
      exchangeId: exchange.exchangeId,
      heading: exchange.prompt,
      body: exchange.details,
    });
    return {
      toolName: 'present_question',
      markdown: formatPresentQuestion(projection),
      details: projection.details,
    };
  }

  const projection = projectPresentOptions({
    exchangeId: exchange.exchangeId,
    heading: exchange.prompt,
    body: exchange.details,
    options: exchange.options,
    expectedRequestTool: exchange.mode === 'multi-select' ? 'request_choices' : 'request_choice',
  });
  return {
    toolName: 'present_options',
    markdown: formatPresentOptions(projection),
    details: projection.details,
  };
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
      toolResultMessage: {
        ...toolResultMessageBase(pending, 'request_choice'),
        content: [{ type: 'text', text: choiceResponseMarkdown([choice], params.note) }],
        details: projectRequestChoice({
          exchangeId: pending.exchangeId,
          respondsToPresentTool: 'present_options',
          status: 'answered',
          choice: { id: choice.id, label: choice.label, kind: choiceKind(choice.id) },
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
  requestTool: 'request_answer' | 'request_choice' | 'request_choices',
) {
  return {
    role: 'toolResult' as const,
    toolCallId: `${pending.exchangeId}:${requestTool}`,
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

  return {
    exchangeId: details.exchange_id,
    lens: 'intent',
    mode:
      details.tool_meta.next === 'request_choices'
        ? 'multi-select'
        : details.tool_meta.curr === 'present_question'
          ? 'text'
          : 'single-select',
    prompt,
    ...(detailsText.length > 0 ? { details: detailsText } : {}),
    options:
      'options' in details
        ? parsePendingOptions(details.options, markdown)
        : parsePendingOptions(undefined, markdown),
    note: { allowed: true },
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

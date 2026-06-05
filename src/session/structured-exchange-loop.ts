import { Type, type Static } from 'typebox';
import { Value } from 'typebox/value';

import type { StructuredExchangePresentDetails } from '../.pi/extensions/structured-exchange/shared/model.js';
import { isStructuredExchangePresentDetails } from '../.pi/extensions/structured-exchange/shared/recovery.js';
import type { BrunchSessionEnvelope } from './brunch-session-envelope.js';
import { projectLinearSessionExchangeProjection } from './exchange-projection.js';

const NonBlankStringSchema = Type.String({ minLength: 1 });

export const PendingStructuredExchangeSchema = Type.Object(
  {
    exchangeId: NonBlankStringSchema,
    lens: Type.Literal('intent'),
    mode: Type.Union([
      Type.Literal('text'),
      Type.Literal('single-select'),
      Type.Literal('multi-select'),
      Type.Literal('review'),
    ]),
    prompt: NonBlankStringSchema,
    details: Type.Optional(NonBlankStringSchema),
    options: Type.Array(
      Type.Object(
        {
          id: NonBlankStringSchema,
          label: NonBlankStringSchema,
          content: NonBlankStringSchema,
          rationale: Type.Optional(NonBlankStringSchema),
        },
        { additionalProperties: false },
      ),
    ),
    note: Type.Object(
      { allowed: Type.Boolean() },
      {
        additionalProperties: false,
      },
    ),
    reviewSet: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  },
  { additionalProperties: false },
);

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

export type PendingStructuredExchange = Static<typeof PendingStructuredExchangeSchema>;

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
  const presentTool = exchange.mode === 'text' ? 'present_question' : 'present_options';
  const requestTool =
    exchange.mode === 'text'
      ? 'request_answer'
      : exchange.mode === 'multi-select'
        ? 'request_choices'
        : 'request_choice';
  const toolCallId = `${exchange.exchangeId}:${presentTool}`;
  return {
    role: 'toolResult' as const,
    toolCallId,
    toolName: presentTool,
    content: [{ type: 'text' as const, text: presentMarkdown(exchange) }],
    details: {
      schema: 'brunch.structured_exchange.present',
      schemaVersion: 1,
      exchangeId: exchange.exchangeId,
      presentTool,
      kind: exchange.mode === 'text' ? 'question' : 'options',
      status: 'presented',
      expectedRequest: { tool: requestTool, required: true },
      createdAtToolCallId: toolCallId,
      prompt: exchange.prompt,
      details: exchange.details,
      lens: exchange.lens,
      options: exchange.options,
    },
    isError: false as const,
    timestamp: 0 as const,
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
        Value.Check(PendingStructuredExchangeSchema, candidate.details),
    );
    if (entry?.type === 'custom_message') {
      return Value.Parse(PendingStructuredExchangeSchema, entry.details);
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
    const details = requestDetailsBase(pending, 'request_answer');
    return {
      ok: true,
      answer: { text: params.answer.text },
      toolResultMessage: {
        ...toolResultMessageBase(pending, 'request_answer'),
        content: [{ type: 'text', text: `### Response\n\n${params.answer.text}` }],
        details: { ...details, answer: params.answer.text },
      },
    };
  }

  if ('optionId' in params.answer) {
    if (pending.mode !== 'single-select') return invalidResponseMode();
    const optionId = params.answer.optionId;
    const choice = pending.options.find((option) => option.id === optionId);
    if (!choice) return { ok: false, message: 'Invalid elicitation option' };
    const details = requestDetailsBase(pending, 'request_choice');
    if (params.note !== undefined && params.note.trim().length > 0) {
      details.comment = params.note.trim();
    }
    return {
      ok: true,
      answer: { optionId: choice.id, label: choice.label },
      toolResultMessage: {
        ...toolResultMessageBase(pending, 'request_choice'),
        content: [{ type: 'text', text: choiceResponseMarkdown([choice], params.note) }],
        details: { ...details, choice },
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
  const details = requestDetailsBase(pending, 'request_choices');
  if (params.note !== undefined && params.note.trim().length > 0) {
    details.comment = params.note.trim();
  }
  return {
    ok: true,
    answer: { optionIds: choices.map((choice) => choice.id), choices },
    toolResultMessage: {
      ...toolResultMessageBase(pending, 'request_choices'),
      content: [{ type: 'text', text: choiceResponseMarkdown(choices, params.note) }],
      details: { ...details, choices },
    },
  };
}

function invalidResponseMode(): AcceptedStructuredExchangeResponse {
  return {
    ok: false,
    message: 'Elicitation response mode does not match pending exchange',
  };
}

function requestDetailsBase(
  pending: PendingStructuredExchange,
  requestTool: 'request_answer' | 'request_choice' | 'request_choices',
): Record<string, unknown> {
  return {
    schema: 'brunch.structured_exchange.request',
    schemaVersion: 1,
    exchangeId: pending.exchangeId,
    requestTool,
    status: 'answered',
    respondsTo: {
      exchangeId: pending.exchangeId,
      presentTool: pending.mode === 'text' ? 'present_question' : 'present_options',
    },
    createdAtToolCallId: `${pending.exchangeId}:${requestTool}`,
  };
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

function presentMarkdown(exchange: PendingStructuredExchange): string {
  if (exchange.mode === 'text') {
    return [`## ${exchange.prompt}`, exchange.details].filter(Boolean).join('\n\n');
  }
  const lines = [`## ${exchange.prompt}`];
  if (exchange.details) lines.push('', exchange.details);
  exchange.options.forEach((option, index) => {
    lines.push('', `### ${index + 1}. ${option.content}`);
    if (option.rationale) {
      lines.push('', `**Rationale:** ${option.rationale}`);
    }
    lines.push('', `<!-- option-id: ${option.id} -->`);
  });
  return lines.join('\n');
}

function pendingExchangeFromStructuredPresent(
  details: StructuredExchangePresentDetails,
  markdown: string,
): PendingStructuredExchange {
  const richDetails = details as StructuredExchangePresentDetails & {
    prompt?: unknown;
    details?: unknown;
    options?: unknown;
    reviewSet?: unknown;
  };
  const prompt =
    typeof richDetails.prompt === 'string'
      ? richDetails.prompt
      : (firstNonEmptyMarkdownLine(markdown) ?? markdown);
  const detailsText = typeof richDetails.details === 'string' ? richDetails.details : markdown;
  if (details.presentTool === 'present_review_set') {
    return {
      exchangeId: details.exchangeId,
      lens: 'intent',
      mode: 'review',
      prompt,
      ...(detailsText.length > 0 ? { details: detailsText } : {}),
      options: [],
      note: { allowed: true },
      ...(isRecord(richDetails.reviewSet) ? { reviewSet: richDetails.reviewSet } : {}),
    };
  }

  return {
    exchangeId: details.exchangeId,
    lens: 'intent',
    mode:
      details.expectedRequest?.tool === 'request_choices'
        ? 'multi-select'
        : details.presentTool === 'present_question'
          ? 'text'
          : 'single-select',
    prompt,
    ...(detailsText.length > 0 ? { details: detailsText } : {}),
    options: parsePendingOptions(richDetails.options, markdown),
    note: { allowed: true },
  };
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

function structuredExchangePresentDetails(entry: unknown): StructuredExchangePresentDetails | undefined {
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
  return isStructuredExchangePresentDetails(details)
    ? (details as StructuredExchangePresentDetails)
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function firstNonEmptyMarkdownLine(markdown: string): string | undefined {
  return markdown
    .split('\n')
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .find((line) => line.length > 0);
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

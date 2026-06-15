import { projectRequestAnswer } from '../../projections/exchanges/request-answer.js';
import { projectRequestChoice } from '../../projections/exchanges/request-choice.js';
import { projectRequestChoices } from '../../projections/exchanges/request-choices.js';
import { projectRequestReview } from '../../projections/exchanges/request-review.js';
import type { PendingChoice, PendingStructuredExchange } from './pending-exchange.js';
import {
  exchangeToolCallId,
  syntheticExchangeToolCallMessage,
  type SyntheticExchangeToolCallMessage,
} from './synthetic-tool-call.js';

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

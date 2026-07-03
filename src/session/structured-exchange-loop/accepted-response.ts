import { formatRequestAnswer } from '../../agents/contexts/exchanges/request-response.js';
import { formatRequestChoice } from '../../agents/contexts/exchanges/request-response.js';
import { formatRequestChoices } from '../../agents/contexts/exchanges/request-response.js';
import { formatRequestReview } from '../../agents/contexts/exchanges/request-response.js';
import { projectRequestAnswer } from '../../exchanges/projections/request-response.js';
import { projectRequestChoice } from '../../exchanges/projections/request-response.js';
import { projectRequestChoices } from '../../exchanges/projections/request-response.js';
import { projectRequestReview } from '../../exchanges/projections/request-response.js';
import { structuredExchangeResponseRequiresComment } from '../../exchanges/schemas/index.js';
import type { PendingStructuredExchange } from './pending-exchange.js';
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
      toolCallMessage: syntheticExchangeToolCallMessage(pending.exchangeId, 'request_response'),
      toolResultMessage: {
        ...toolResultMessageBase(pending, 'request_response'),
        content: [
          {
            type: 'text',
            text: formatRequestAnswer(
              projectRequestAnswer({
                exchangeId: pending.exchangeId,
                status: 'answered',
                answer: params.answer.text,
              }),
            ),
          },
        ],
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
    if (
      structuredExchangeResponseRequiresComment({ choiceKinds: [choiceKind(choice.id)] }) &&
      (comment === undefined || comment.length === 0)
    ) {
      return {
        ok: false,
        message: 'Elicitation response requires a comment for Other or None selections',
      };
    }
    return {
      ok: true,
      answer: { optionId: choice.id, label: choice.label },
      toolCallMessage: syntheticExchangeToolCallMessage(pending.exchangeId, 'request_response'),
      toolResultMessage: {
        ...toolResultMessageBase(pending, 'request_response'),
        content: [
          {
            type: 'text',
            text: formatRequestChoice(
              projectRequestChoice({
                exchangeId: pending.exchangeId,
                respondsToPresentTool: pending.respondsToPresentTool ?? 'present_question',
                status: 'answered',
                choice: { id: choice.id, label: choice.label, kind: choiceKind(choice.id) },
                options: optionEcho(pending.options),
                comment,
              }),
            ),
          },
        ],
        details: projectRequestChoice({
          exchangeId: pending.exchangeId,
          respondsToPresentTool: pending.respondsToPresentTool ?? 'present_question',
          status: 'answered',
          choice: { id: choice.id, label: choice.label, kind: choiceKind(choice.id) },
          options: optionEcho(pending.options),
          comment,
        }),
      },
    };
  }

  if ('review' in params.answer) {
    if (pending.mode !== 'review') return invalidResponseMode();
    const review = params.answer.review;
    const comment = review.comment?.trim();
    if (
      structuredExchangeResponseRequiresComment({ reviewDecision: review.decision }) &&
      (comment === undefined || comment.length === 0)
    ) {
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
      toolCallMessage: syntheticExchangeToolCallMessage(pending.exchangeId, 'request_response'),
      toolResultMessage: {
        ...toolResultMessageBase(pending, 'request_response'),
        content: [
          {
            type: 'text',
            text: formatRequestReview(
              projectRequestReview({
                exchangeId: pending.exchangeId,
                status: 'answered',
                review: review.decision,
                comment,
              }),
            ),
          },
        ],
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
  if (params.answer.optionIds.length === 0) {
    return { ok: false, message: 'Elicitation response requires at least one selected option' };
  }
  const selected = params.answer.optionIds.map((id) => pending.options.find((option) => option.id === id));
  if (selected.some((choice) => choice === undefined)) {
    return { ok: false, message: 'Invalid elicitation option' };
  }
  const choices = selected as Array<{
    id: string;
    label: string;
    content: string;
    rationale?: string | undefined;
  }>;
  if (
    structuredExchangeResponseRequiresComment({
      choiceKinds: choices.map((choice) => choiceKind(choice.id)),
    }) &&
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
    toolCallMessage: syntheticExchangeToolCallMessage(pending.exchangeId, 'request_response'),
    toolResultMessage: {
      ...toolResultMessageBase(pending, 'request_response'),
      content: [
        {
          type: 'text',
          text: formatRequestChoices(
            projectRequestChoices({
              exchangeId: pending.exchangeId,
              status: 'answered',
              choices: choices.map((choice) => ({
                id: choice.id,
                label: choice.label,
                kind: choiceKind(choice.id),
              })),
              options: optionEcho(pending.options),
              comment,
            }),
          ),
        },
      ],
      details: projectRequestChoices({
        exchangeId: pending.exchangeId,
        status: 'answered',
        choices: choices.map((choice) => ({
          id: choice.id,
          label: choice.label,
          kind: choiceKind(choice.id),
        })),
        options: optionEcho(pending.options),
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

function optionEcho(options: readonly { id: string; content: string; rationale?: string | undefined }[]) {
  return options.map((option) => ({
    id: option.id,
    content: option.content,
    ...(option.rationale !== undefined ? { rationale: option.rationale } : {}),
  }));
}

function toolResultMessageBase(
  pending: PendingStructuredExchange,
  requestTool: 'request_response' | 'request_review',
) {
  return {
    role: 'toolResult' as const,
    toolCallId: exchangeToolCallId(pending.exchangeId, requestTool),
    toolName: requestTool,
    isError: false as const,
    timestamp: 0 as const,
  };
}

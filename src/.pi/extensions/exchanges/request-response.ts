import { defineTool } from '@earendil-works/pi-coding-agent';

import { formatRequestResponseDiagnostic } from '../../../agents/contexts/exchanges/request-response.js';
import { findIncompleteStructuredExchangePresents } from '../../../exchanges/recovery.js';
import {
  zRequestResponseParams,
  type PresentCandidatesDetails,
  type PresentDetails,
  type PresentDigestDetails,
  type PresentQuestionDetails,
  type RequestResponseParams,
} from '../../../exchanges/schemas/index.js';
import type { LiveExchangeAwaiter } from '../../../session/live-exchange-broker.js';
import { piSchema } from './pi-schema.js';
import { collectAnswerFromSources } from './shared/answer-source.js';
import { collectChoiceFromUi } from './shared/choice-source.js';
import { requestChoicesFromSources } from './shared/choices-editor.js';
import { renderEmptyStructuredExchangeCall, renderMarkdownResult } from './shared/markdown.js';
import { collectReviewFromUi } from './shared/review-source.js';
import type { StructuredExchangeUiContext } from './shared/ui-context.js';

export const REQUEST_RESPONSE_TOOL = 'request_response' as const;

type RequestResponseDiagnosticStatus = 'unavailable';

interface RequestResponseDiagnosticDetails {
  readonly schema: 'brunch.structured_exchange.request_response';
  readonly v: 1;
  readonly exchange_id: string;
  readonly status: RequestResponseDiagnosticStatus;
  readonly message: string;
}

function diagnostic(
  exchangeId: string,
  status: RequestResponseDiagnosticStatus,
  message: string,
): RequestResponseDiagnosticDetails {
  return {
    schema: 'brunch.structured_exchange.request_response',
    v: 1,
    exchange_id: exchangeId,
    status,
    message,
  };
}

function diagnosticResult(details: RequestResponseDiagnosticDetails) {
  return { content: [{ type: 'text' as const, text: formatRequestResponseDiagnostic(details) }], details };
}

function assertNever(value: never): never {
  throw new Error(`request_response: unhandled present details ${JSON.stringify(value)}`);
}

async function collectQuestionResponse(
  present: PresentQuestionDetails,
  ctx: StructuredExchangeUiContext,
  answerBroker: LiveExchangeAwaiter | undefined,
  exchangeId: string,
) {
  switch (present.response_kind) {
    case 'answer':
      return collectAnswerFromSources({
        ctx,
        answerBroker,
        exchangeId,
        prompt: present.display.heading,
        unavailableMessage: 'request_response requires interactive UI',
      });
    case 'choice':
      return collectChoiceFromUi({
        ctx,
        exchangeId,
        prompt: present.display.heading,
        choices: present.options.map((option) => ({ id: option.id, label: option.content })),
        options: present.options,
        ...(present.allow_other !== undefined ? { allowOther: present.allow_other } : {}),
        ...(present.comment_prompt !== undefined ? { commentPrompt: present.comment_prompt } : {}),
      });
    case 'choices':
      return requestChoicesFromSources(
        {
          exchangeId,
          prompt: present.display.heading,
          choices: present.options.map((option) => ({ id: option.id, label: option.content })),
          options: present.options,
          ...(present.allow_other !== undefined ? { allowOther: present.allow_other } : {}),
          ...(present.allow_none !== undefined ? { allowNone: present.allow_none } : {}),
          ...(present.comment_prompt !== undefined ? { commentPrompt: present.comment_prompt } : {}),
        },
        ctx,
      );
    default:
      return assertNever(present);
  }
}

export function createRequestResponseTool(answerBroker?: LiveExchangeAwaiter) {
  return defineTool({
    name: REQUEST_RESPONSE_TOOL,
    label: 'Request response',
    description:
      'Collect the response for a pending Brunch structured exchange. The runtime derives the response UI from the pending present_* entry.',
    promptSnippet: 'Request the pending structured exchange response by exchangeId',
    promptGuidelines: [
      'Use request_response after any present_* tool; the pending present result is the only response-shape authority.',
      'Pass only the exchangeId from the pending present_* result; do not repeat the prompt or choose the response kind.',
    ],
    parameters: piSchema(zRequestResponseParams),
    executionMode: 'sequential',

    async execute(_toolCallId, rawParams, _signal, _onUpdate, ctx) {
      const params = zRequestResponseParams.parse(rawParams) satisfies RequestResponseParams;
      const uiCtx = ctx as unknown as StructuredExchangeUiContext;
      const branch = uiCtx.sessionManager?.getBranch();
      if (!branch) {
        return diagnosticResult(
          diagnostic(
            params.exchangeId,
            'unavailable',
            'request_response requires access to the current session transcript',
          ),
        );
      }

      const pending = findIncompleteStructuredExchangePresents(branch).find(
        (present) => present.details.exchange_id === params.exchangeId,
      );
      if (!pending) {
        return diagnosticResult(
          diagnostic(
            params.exchangeId,
            'unavailable',
            `No pending structured exchange found for ${params.exchangeId}`,
          ),
        );
      }

      // present_question is itself a nested union (zPromptWithOptions |
      // zPromptWithoutOptions), so TS does not reliably narrow the parent object
      // on the nested tool_meta.curr discriminant. Switch on the discriminant as a
      // plain string-literal-union local (which TS narrows, including the
      // exhaustive default), and apply one sound member cast for the question
      // branch. assertNever fires if a present tool is added without a branch here.
      const present = pending.details;
      const presentTool: PresentDetails['tool_meta']['curr'] = present.tool_meta.curr;
      switch (presentTool) {
        case 'present_question':
          return collectQuestionResponse(
            present as PresentQuestionDetails,
            uiCtx,
            answerBroker,
            params.exchangeId,
          );
        case 'present_review_set':
          return collectReviewFromUi(uiCtx, {
            exchangeId: params.exchangeId,
            prompt: present.display.heading,
          });
        case 'present_candidates': {
          const candidatesPresent = present as PresentCandidatesDetails;
          return collectChoiceFromUi({
            ctx: uiCtx,
            exchangeId: params.exchangeId,
            prompt: candidatesPresent.display.heading,
            choices: candidatesPresent.candidates.map((candidate) => ({
              id: candidate.id,
              label: candidate.title,
            })),
            options: candidatesPresent.candidates.map((candidate) => ({
              id: candidate.id,
              content: candidate.title,
            })),
            respondsToPresentTool: 'present_candidates',
          });
        }
        case 'present_digest': {
          const digestPresent = present as PresentDigestDetails;
          return collectReviewFromUi(uiCtx, {
            exchangeId: params.exchangeId,
            prompt: digestPresent.display.heading,
            respondsToPresentTool: 'present_digest',
            acceptedAbstract: digestPresent.digest.abstract,
          });
        }
        default:
          return assertNever(presentTool);
      }
    },

    renderCall() {
      return renderEmptyStructuredExchangeCall();
    },

    renderResult(result, _options, theme) {
      return renderMarkdownResult(result, theme);
    },
  });
}

export const requestResponseTool = createRequestResponseTool();

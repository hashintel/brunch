import { defineTool } from '@earendil-works/pi-coding-agent';

import { formatRequestResponseDiagnostic } from '../../../agents/contexts/exchanges/request-response.js';
import { findIncompleteStructuredExchangePresents } from '../../../exchanges/recovery.js';
import {
  zRequestResponseParams,
  type PresentCandidatesDetails,
  type PresentDetails,
  type PresentDigestDetails,
  type RequestResponseParams,
} from '../../../exchanges/schemas/index.js';
import type { LiveExchangeAwaiter } from '../../../session/live-exchange-broker.js';
import { piSchema } from './pi-schema.js';
import { collectChoiceFromUi } from './shared/choice-source.js';
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

export function createRequestResponseTool(_answerBroker?: LiveExchangeAwaiter) {
  return defineTool({
    name: REQUEST_RESPONSE_TOOL,
    label: 'Request response',
    description:
      'Collect the response for a pending Brunch structured exchange. The runtime derives the response UI from the pending present_* entry.',
    promptSnippet: 'Request the pending structured exchange response by exchangeId',
    promptGuidelines: [
      'Call request_response in the same turn as present_question or present_candidates; for present_review_set, wait for a successful result first. The pending present result is the only response-shape authority.',
      'Pass the same exchangeId you gave the present_* call; do not repeat the prompt or choose the response kind.',
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
          return diagnosticResult(
            diagnostic(
              params.exchangeId,
              'unavailable',
              'present_question has retired; use ask for standalone questions',
            ),
          );
        case 'present_review_set':
          return collectReviewFromUi(uiCtx, {
            exchangeId: params.exchangeId,
            prompt: present.display.heading,
            respondsToPresentTool: 'present_review_set',
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

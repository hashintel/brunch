import { defineTool } from '@earendil-works/pi-coding-agent';

import { projectRequestChoices } from '../../../projections/exchanges/request-choices.js';
import { formatRequestChoices } from '../../../renderers/exchanges/request-choices.js';
import type { LiveExchangeAwaiter } from '../../../session/live-exchange-broker.js';
import { piSchema } from './pi-schema.js';
import {
  zRequestResponseParams,
  type PresentDetails,
  type PresentQuestionDetails,
  type RequestResponseParams,
} from './schemas/index.js';
import { collectAnswerFromSources } from './shared/answer-source.js';
import { collectChoiceFromUi } from './shared/choice-source.js';
import { requestChoicesViaEditor } from './shared/choices-editor.js';
import { renderMarkdownResult } from './shared/markdown.js';
import { findIncompleteStructuredExchangePresents } from './shared/recovery.js';
import { collectReviewFromUi } from './shared/review-source.js';
import type { StructuredExchangeUiContext } from './shared/ui-context.js';

export const REQUEST_RESPONSE_TOOL = 'request_response' as const;

type RequestResponseDiagnosticStatus = 'unavailable' | 'not_supported';

interface RequestResponseDiagnosticDetails {
  readonly schema: 'brunch.structured_exchange.request_response';
  readonly v: 1;
  readonly exchange_id: string;
  readonly status: RequestResponseDiagnosticStatus;
  readonly message: string;
  readonly presentTool?: string;
}

function diagnostic(
  exchangeId: string,
  status: RequestResponseDiagnosticStatus,
  message: string,
  presentTool?: string,
): RequestResponseDiagnosticDetails {
  return {
    schema: 'brunch.structured_exchange.request_response',
    v: 1,
    exchange_id: exchangeId,
    status,
    message,
    ...(presentTool ? { presentTool } : {}),
  };
}

function diagnosticResult(details: RequestResponseDiagnosticDetails) {
  return { content: [{ type: 'text' as const, text: `### Response\n\n_${details.message}_` }], details };
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
        ...(present.allow_other !== undefined ? { allowOther: present.allow_other } : {}),
        ...(present.comment_prompt !== undefined ? { commentPrompt: present.comment_prompt } : {}),
      });
    case 'choices': {
      if (!ctx.hasUI || typeof ctx.ui?.editor !== 'function') {
        const details = projectRequestChoices({
          exchangeId,
          status: 'unavailable',
          message: 'request_response choices requires interactive UI',
        });
        return { content: [{ type: 'text' as const, text: formatRequestChoices(details) }], details };
      }
      const editor = ctx.ui.editor;
      return requestChoicesViaEditor(
        {
          exchangeId,
          prompt: present.display.heading,
          choices: present.options.map((option) => ({ id: option.id, label: option.content })),
          ...(present.allow_other !== undefined ? { allowOther: present.allow_other } : {}),
          ...(present.allow_none !== undefined ? { allowNone: present.allow_none } : {}),
          ...(present.comment_prompt !== undefined ? { commentPrompt: present.comment_prompt } : {}),
        },
        (prefill) => editor(prefill),
      );
    }
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
      'Use request_response after any present_* tool instead of choosing a request_* tool.',
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
        case 'present_candidates':
          return diagnosticResult(
            diagnostic(
              params.exchangeId,
              'not_supported',
              'request_response does not yet support present_candidates',
              'present_candidates',
            ),
          );
        default:
          return assertNever(presentTool);
      }
    },

    renderCall() {
      return renderMarkdownResult({ content: [] });
    },

    renderResult(result, _options, theme) {
      return renderMarkdownResult(result, theme);
    },
  });
}

export const requestResponseTool = createRequestResponseTool();

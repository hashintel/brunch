import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import type { LiveExchangeAwaiter } from '../../../session/live-exchange-broker.js';
import { PRESENT_CANDIDATES_TOOL } from './present-candidates.js';
import { PRESENT_OPTIONS_TOOL, presentOptionsTool } from './present-options.js';
import { PRESENT_QUESTION_TOOL, presentQuestionTool } from './present-question.js';
import {
  PRESENT_REVIEW_SET_TOOL,
  createPresentReviewSetTool,
  type ReviewSetStructuredExchangeDeps,
} from './present-review-set.js';
import { REQUEST_ANSWER_TOOL, createRequestAnswerTool, requestAnswerTool } from './request-answer.js';
import { REQUEST_CHOICE_TOOL, requestChoiceTool } from './request-choice.js';
import { REQUEST_CHOICES_TOOL, requestChoicesTool } from './request-choices.js';
import { REQUEST_REVIEW_TOOL, requestReviewTool } from './request-review.js';

export { requestChoicesViaEditor, type RequestChoicesEditorFlowParams } from './request-choices.js';
export {
  findIncompleteStructuredExchangePresents,
  isStructuredExchangePresentDetails,
  isStructuredExchangeRequestDetails,
} from './shared/recovery.js';
export {
  STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA as STRUCTURED_EXCHANGE_PRESENT_SCHEMA,
  STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA as STRUCTURED_EXCHANGE_REQUEST_SCHEMA,
  type PresentDetails as StructuredExchangePresentDetails,
  type RequestDetails as StructuredExchangeRequestDetails,
  type RequestDetails as StructuredExchangeToolResultDetails,
} from './schemas/index.js';
export {
  PRESENT_CANDIDATES_TOOL,
  PRESENT_OPTIONS_TOOL,
  PRESENT_QUESTION_TOOL,
  PRESENT_REVIEW_SET_TOOL,
  REQUEST_ANSWER_TOOL,
  REQUEST_CHOICE_TOOL,
  REQUEST_CHOICES_TOOL,
  REQUEST_REVIEW_TOOL,
};

export const STRUCTURED_EXCHANGE_IMPLEMENTED_TOOLS = [
  presentQuestionTool,
  presentOptionsTool,
  requestAnswerTool,
  requestChoiceTool,
  requestChoicesTool,
  requestReviewTool,
] as const;

export const STRUCTURED_EXCHANGE_STUB_TOOL_NAMES = [PRESENT_CANDIDATES_TOOL] as const;

export interface StructuredExchangeDeps {
  readonly review?: ReviewSetStructuredExchangeDeps | undefined;
  readonly liveExchange?: LiveExchangeAwaiter | undefined;
}

export function registerStructuredExchange(pi: ExtensionAPI, deps: StructuredExchangeDeps = {}) {
  for (const tool of [
    presentQuestionTool,
    presentOptionsTool,
    createPresentReviewSetTool(deps.review),
    deps.liveExchange ? createRequestAnswerTool(deps.liveExchange) : requestAnswerTool,
    requestChoiceTool,
    requestChoicesTool,
    requestReviewTool,
  ]) {
    pi.registerTool(tool);
  }
}

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import { PRESENT_CANDIDATES_TOOL, presentCandidatesTool } from './present-candidates.js';
import { PRESENT_OPTIONS_TOOL, presentOptionsTool } from './present-options.js';
import { PRESENT_QUESTION_TOOL, presentQuestionTool } from './present-question.js';
import { PRESENT_REVIEW_SET_TOOL, presentReviewSetTool } from './present-review-set.js';
import { REQUEST_ANSWER_TOOL, requestAnswerTool } from './request-answer.js';
import { REQUEST_CHOICE_TOOL, requestChoiceTool } from './request-choice.js';
import { REQUEST_CHOICES_TOOL, requestChoicesTool } from './request-choices.js';
import { REQUEST_REVIEW_TOOL, requestReviewTool } from './request-review.js';

export type { StructuredExchangeResultDetails as StructuredExchangeToolResultDetails } from '../../../session/structured-exchange.js';

export {
  buildStructuredExchangeEditorPrefill,
  parseStructuredExchangeEditorResponse,
  structuredExchangeResultFromEditor,
  type StructuredExchangeEditorPrefillParams,
} from './shared/editor-fallback.js';
export {
  findIncompleteStructuredExchangePresents,
  isStructuredExchangePresentDetails,
  isStructuredExchangeRequestDetails,
} from './shared/recovery.js';
export {
  STRUCTURED_EXCHANGE_PRESENT_SCHEMA,
  STRUCTURED_EXCHANGE_REQUEST_SCHEMA,
  type PresentToolName,
  type RequestToolName,
  type StructuredExchangePresentDetails,
  type StructuredExchangeRequestDetails,
} from './shared/model.js';
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
] as const;

export const STRUCTURED_EXCHANGE_STUB_TOOL_NAMES = [
  PRESENT_REVIEW_SET_TOOL,
  PRESENT_CANDIDATES_TOOL,
  REQUEST_REVIEW_TOOL,
] as const;

void presentReviewSetTool;
void presentCandidatesTool;
void requestReviewTool;

export function registerStructuredExchange(pi: ExtensionAPI) {
  for (const tool of STRUCTURED_EXCHANGE_IMPLEMENTED_TOOLS) {
    pi.registerTool(tool);
  }
}

export default registerStructuredExchange;

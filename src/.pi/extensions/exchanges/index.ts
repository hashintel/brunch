import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import type { LiveExchangeAwaiter } from '../../../session/live-exchange-broker.js';
import { PRESENT_CANDIDATES_TOOL, presentCandidatesTool } from './present-candidates.js';
import { PRESENT_QUESTION_TOOL, presentQuestionTool } from './present-question.js';
import {
  PRESENT_REVIEW_SET_TOOL,
  createPresentReviewSetTool,
  type ReviewSetStructuredExchangeDeps,
} from './present-review-set.js';
import { REQUEST_RESPONSE_TOOL, createRequestResponseTool, requestResponseTool } from './request-response.js';

export { requestChoicesViaEditor, type RequestChoicesEditorFlowParams } from './shared/choices-editor.js';
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
export { PRESENT_CANDIDATES_TOOL, PRESENT_QUESTION_TOOL, PRESENT_REVIEW_SET_TOOL, REQUEST_RESPONSE_TOOL };

export const STRUCTURED_EXCHANGE_IMPLEMENTED_TOOLS = [
  presentQuestionTool,
  presentCandidatesTool,
  requestResponseTool,
] as const;

export const STRUCTURED_EXCHANGE_STUB_TOOL_NAMES = [] as const;

export interface StructuredExchangeDeps {
  readonly review?: ReviewSetStructuredExchangeDeps | undefined;
  readonly liveExchange?: LiveExchangeAwaiter | undefined;
}

export function registerStructuredExchange(pi: ExtensionAPI, deps: StructuredExchangeDeps = {}) {
  for (const tool of [
    presentQuestionTool,
    createPresentReviewSetTool(deps.review),
    presentCandidatesTool,
    deps.liveExchange ? createRequestResponseTool(deps.liveExchange) : requestResponseTool,
  ]) {
    pi.registerTool({ ...tool, renderShell: 'self' as const });
  }
}

export default registerStructuredExchange;

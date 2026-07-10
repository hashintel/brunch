import { defineTool } from '@earendil-works/pi-coding-agent';

import {
  formatExchangeStructuralIllegal,
  formatPresentReviewSet,
} from '../../../agents/contexts/exchanges/present-review-set.js';
import { projectPresentReviewSet } from '../../../exchanges/projections/present-review-set.js';
import {
  zPresentReviewSetDetails,
  zPresentReviewSetParams,
  type PresentReviewSetDetails,
  type PresentReviewSetParams,
} from '../../../exchanges/schemas/index.js';
import type { CommandExecutor, StructuralIllegal } from '../../../graph/command-executor.js';
import type { ReviewSetProposalPayload } from '../../../graph/review-set.js';
import { ExchangeReviewSetResultComponent } from '../../components/exchange-review-set-result.js';
import { toolParameters } from '../shared/tool-schema.js';
import { renderDetailsOrMarkdownResult } from './shared/details-rendering.js';
import { renderEmptyStructuredExchangeCall, renderMarkdownResult } from './shared/markdown.js';
import { validationFailureResult, type ExchangeValidationFailureDetails } from './shared/validation.js';

export const PRESENT_REVIEW_SET_TOOL = 'present_review_set' as const;

export interface ReviewSetStructuredExchangeDeps {
  readonly specId: number;
  readonly commandExecutor: Pick<CommandExecutor, 'assignProposedReviewSetCodes' | 'dryRunAcceptReviewSet'>;
}

type PresentReviewSetToolDetails =
  | StructuralIllegal
  | PresentReviewSetDetails
  | ExchangeValidationFailureDetails;

const PresentReviewSetParams = toolParameters(zPresentReviewSetParams);

export function createPresentReviewSetTool(deps?: ReviewSetStructuredExchangeDeps) {
  return defineTool<typeof PresentReviewSetParams, PresentReviewSetToolDetails>({
    name: PRESENT_REVIEW_SET_TOOL,
    label: 'Present review set',
    description:
      'Dry-run validate and display a Brunch graph review-set proposal. Use ask with continues only after this result validates successfully, because a structurally illegal proposal must be corrected and re-presented instead.',
    promptSnippet: 'Present a graph review set for exact human approval',
    promptGuidelines: [
      'Use present_review_set only for exact graph drafts the user can approve or reject as a batch.',
      'If the tool returns structural_illegal, fix the payload and retry; do not ask the user to review invalid graph drafts.',
      'Call ask with continues only after a successful present_review_set result. Do not call request_review; the runtime derives the preserved review request details from this present result.',
    ],
    parameters: PresentReviewSetParams,
    executionMode: 'sequential',

    async execute(_toolCallId, rawParams) {
      const parsed = zPresentReviewSetParams.safeParse(rawParams);
      if (!parsed.success) return validationFailureResult(PRESENT_REVIEW_SET_TOOL, parsed.error);
      const params = parsed.data satisfies PresentReviewSetParams;
      if (!deps) {
        const details = {
          status: 'structural_illegal' as const,
          diagnostics: [
            { field: 'present_review_set', message: 'review-set graph dependencies unavailable' },
          ],
        };
        return {
          content: [{ type: 'text' as const, text: formatExchangeStructuralIllegal(details) }],
          details,
        };
      }

      const payload = deps.commandExecutor.assignProposedReviewSetCodes({
        specId: deps.specId,
        payload: params.payload,
      });
      if (isStructuralIllegal(payload)) {
        return {
          content: [{ type: 'text' as const, text: formatExchangeStructuralIllegal(payload) }],
          details: payload,
        };
      }

      const dryRun = deps.commandExecutor.dryRunAcceptReviewSet({
        specId: deps.specId,
        proposalEntryId: params.proposalEntryId,
        payload,
      });
      if (dryRun.status === 'structural_illegal') {
        return {
          content: [{ type: 'text' as const, text: formatExchangeStructuralIllegal(dryRun) }],
          details: dryRun,
        };
      }

      const projection = projectPresentReviewSet({
        exchangeId: params.exchangeId,
        payload,
      });
      return {
        content: [{ type: 'text' as const, text: formatPresentReviewSet(projection) }],
        details: projection.details,
      };
    },

    renderCall() {
      return renderEmptyStructuredExchangeCall();
    },

    renderResult(result, _options, theme) {
      return renderDetailsOrMarkdownResult(
        result,
        zPresentReviewSetDetails,
        (details) => new ExchangeReviewSetResultComponent(details, theme),
        () => renderMarkdownResult(result, theme),
      );
    },
  });
}

export const presentReviewSetTool = createPresentReviewSetTool();

function isStructuralIllegal(
  value: ReviewSetProposalPayload | StructuralIllegal,
): value is StructuralIllegal {
  return 'status' in value;
}

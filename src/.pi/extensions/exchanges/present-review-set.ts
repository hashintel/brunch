import { defineTool } from '@earendil-works/pi-coding-agent';

import type { CommandExecutor, StructuralIllegal } from '../../../graph/command-executor.js';
import type { ReviewSetProposalPayload } from '../../../graph/review-set.js';
import { projectPresentReviewSet } from '../../../projections/exchanges/present-review-set.js';
import { formatPresentReviewSet } from '../../../renderers/exchanges/present-review-set.js';
import { piSchema } from './pi-schema.js';
import {
  zPresentReviewSetParams,
  type PresentReviewSetDetails,
  type PresentReviewSetParams,
} from './schemas/index.js';
import { renderMarkdownResult } from './shared/markdown.js';

export const PRESENT_REVIEW_SET_TOOL = 'present_review_set' as const;

export interface ReviewSetStructuredExchangeDeps {
  readonly specId: number;
  readonly commandExecutor: Pick<CommandExecutor, 'dryRunAcceptReviewSet'>;
}

type PresentReviewSetToolDetails = StructuralIllegal | PresentReviewSetDetails;

const PresentReviewSetParams = piSchema(zPresentReviewSetParams);

export function createPresentReviewSetTool(deps?: ReviewSetStructuredExchangeDeps) {
  return defineTool<typeof PresentReviewSetParams, PresentReviewSetToolDetails>({
    name: PRESENT_REVIEW_SET_TOOL,
    label: 'Present review set',
    description:
      'Dry-run validate and display a Brunch graph review-set proposal. Use request_response after this result is available.',
    promptSnippet: 'Present a graph review set for exact human approval',
    promptGuidelines: [
      'Use present_review_set only for exact graph drafts the user can approve or reject as a batch.',
      'If the tool returns structural_illegal, fix the payload and retry; do not ask the user to review invalid graph drafts.',
      'Call request_response only after a successful present_review_set result.',
    ],
    parameters: PresentReviewSetParams,
    executionMode: 'sequential',

    async execute(_toolCallId, rawParams) {
      const params = zPresentReviewSetParams.parse(rawParams) satisfies PresentReviewSetParams;
      if (!deps) {
        const details = {
          status: 'structural_illegal' as const,
          diagnostics: [
            { field: 'present_review_set', message: 'review-set graph dependencies unavailable' },
          ],
        };
        return { content: [{ type: 'text' as const, text: formatStructuralIllegal(details) }], details };
      }

      const dryRun = deps.commandExecutor.dryRunAcceptReviewSet({
        specId: deps.specId,
        proposalEntryId: params.proposalEntryId,
        payload: params.payload,
      });
      if (dryRun.status === 'structural_illegal') {
        return {
          content: [{ type: 'text' as const, text: formatStructuralIllegal(dryRun) }],
          details: dryRun,
        };
      }

      const projection = projectPresentReviewSet({
        exchangeId: params.exchangeId,
        // Safe after a successful dry run: the deep validator (graph/review-set.ts)
        // has confirmed the full shape. The boundary schema only guarantees an
        // object with schemaVersion: 1, so widen through unknown deliberately.
        payload: params.payload as unknown as ReviewSetProposalPayload,
      });
      return {
        content: [{ type: 'text' as const, text: formatPresentReviewSet(projection) }],
        details: projection.details,
      };
    },

    renderCall() {
      return renderMarkdownResult({ content: [] });
    },

    renderResult(result, _options, theme) {
      return renderMarkdownResult(result, theme);
    },
  });
}

export const presentReviewSetTool = createPresentReviewSetTool();

function formatStructuralIllegal(result: {
  readonly diagnostics: readonly { readonly field: string; readonly message: string }[];
}): string {
  return ['# STRUCTURAL_ILLEGAL', '', ...result.diagnostics.map((d) => `- ${d.field}: ${d.message}`)].join(
    '\n',
  );
}

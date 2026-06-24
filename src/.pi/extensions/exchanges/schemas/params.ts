import * as z from 'zod';

import { zReviewSetProposalPayloadForBoundary } from '../../../../graph/review-set.js';

export const zPresentedOptionParam = z
  .object({
    id: z
      .string()
      .min(1)
      // Option ids round-trip through a per-line `<!-- option-id: … -->` marker
      // recovered by a regex that stops at `>`; ids with `>` or line breaks would
      // silently fail to reconstruct (see structured-exchange-loop/pending-exchange.ts).
      .regex(/^[^>\r\n]+$/, 'Option id must not contain ">" or line breaks.')
      .describe('Stable option id for the later request_response result details.'),
    content: z.string().describe('Markdown-readable option content.'),
    rationale: z.string().describe('Why this option is plausible or recommended.').optional(),
  })
  .strict();

export const zPresentQuestionParams = z
  .object({
    exchangeId: z
      .string()
      .min(1)
      .describe('Stable id tying this question to the later request_response call.'),
    heading: z.string().describe('Question or offer heading.'),
    body: z.string().describe('Markdown body for context before the response.').optional(),
    options: z
      .array(zPresentedOptionParam)
      .min(1)
      .describe('Finite response options. Omit this field for a free-text answer.')
      .optional(),
    multiple: z
      .boolean()
      .describe('When options are present, collect one-or-more choices instead of a single choice.')
      .optional(),
    allowOther: z.boolean().describe('Whether the user may choose Other for option responses.').optional(),
    allowNone: z
      .boolean()
      .describe('Whether the user may choose None for multi-choice responses.')
      .optional(),
    commentPrompt: z.string().describe('Prompt for an optional comment after choosing options.').optional(),
  })
  .strict();
export type PresentQuestionParams = z.infer<typeof zPresentQuestionParams>;

export const zPresentReviewSetParams = z
  .object({
    exchangeId: z
      .string()
      .min(1)
      .describe('Stable id tying this review-set proposal to the later request_response review.'),
    proposalEntryId: z
      .string()
      .describe('Optional transcript/proposal entry id to carry into later acceptance audit.')
      .optional(),
    // Boundary teaching only: the nested shape is owned beside the graph-owned
    // validateReviewSetPayloadShape diagnostic validator. The schema rejects
    // non-objects, wrong top-level tool shapes, and malformed nested companions;
    // missing required nested fields still flow to the graph validator for
    // field-level STRUCTURAL_ILLEGAL diagnostics.
    payload: zReviewSetProposalPayloadForBoundary,
  })
  .strict();
export type PresentReviewSetParams = z.infer<typeof zPresentReviewSetParams>;

export const zRequestResponseParams = z
  .object({
    exchangeId: z.string().min(1).describe('The structured exchange id from the pending present_* entry.'),
  })
  .strict();
export type RequestResponseParams = z.infer<typeof zRequestResponseParams>;

export function toStructuredExchangeJsonSchema(schema: z.ZodType): unknown {
  return z.toJSONSchema(schema, { unrepresentable: 'throw' });
}

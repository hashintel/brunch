import * as z from 'zod';

import { zReviewSetProposalPayloadForBoundary } from '../../graph/review-set.js';
import { zDigestMaterial, zPresentedCandidate } from './present.js';

const zPresentedOptionParam = z
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
    heading: z.string().trim().min(1).describe('Question or offer heading.'),
    body: z.string().describe('Markdown body for context before the response.').optional(),
    options: z
      .array(zPresentedOptionParam)
      .min(1)
      .describe(
        'Finite response options. Omit this field for a free-text answer; include it instead of embedding numbered choices in body markdown.',
      )
      .optional(),
    multiple: z
      .boolean()
      .describe(
        'Only meaningful when options are present: collect one-or-more choices instead of a single choice.',
      )
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

export const zPresentCandidatesParams = z
  .object({
    exchangeId: z
      .string()
      .min(1)
      .describe('Stable id tying this candidate presentation to the later request_response call.'),
    heading: z.string().trim().min(1).describe('Candidate comparison heading.'),
    body: z.string().describe('Markdown body for context before the candidate list.').optional(),
    candidates: z
      .array(zPresentedCandidate)
      .min(1)
      .describe(
        'Recognition-only candidate expressions to compare and choose from; selection records fan-in intent but does not commit graph truth.',
      ),
  })
  .strict();
export type PresentCandidatesParams = z.infer<typeof zPresentCandidatesParams>;

export const zPresentDigestParams = z
  .object({
    exchangeId: z
      .string()
      .min(1)
      .describe('Stable id tying this digest presentation to the later request_response review.'),
    heading: z.string().trim().min(1).describe('Digest heading.'),
    body: z.string().describe('Markdown body for context before the digest.').optional(),
    digest: zDigestMaterial.describe(
      'Prose-only digest material: abstract plus optional analysis and recommendation. Do not include graph nodes, edges, draft ids, command payloads, or review-set material.',
    ),
  })
  .strict();
export type PresentDigestParams = z.infer<typeof zPresentDigestParams>;

export const zRequestResponseParams = z
  .object({
    exchangeId: z.string().min(1).describe('The same exchange id passed to the pending present_* call.'),
  })
  .strict();
export type RequestResponseParams = z.infer<typeof zRequestResponseParams>;

export function toStructuredExchangeJsonSchema(schema: z.ZodType): unknown {
  return z.toJSONSchema(schema, { unrepresentable: 'throw' });
}

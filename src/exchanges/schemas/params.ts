import * as z from 'zod';

import { zReviewSetProposalPayloadForBoundary } from '../../graph/review-set.js';
import { zDigestMaterial, zPresentedCandidate } from './present.js';
import { zQuestionnaireQuestions } from './questionnaire.js';
import { zNonBlankMarkdown } from './shared.js';

// 'other' and 'none' are reserved: the runtime injects them as escape choices
// (allowOther/allowNone), and the RPC answer path maps those raw ids to the
// other/none choice kinds — a listed option reusing them would collide.
const RESERVED_ESCAPE_OPTION_IDS = ['other', 'none'] as const;

function isNotReservedEscapeId(id: string): boolean {
  return !RESERVED_ESCAPE_OPTION_IDS.includes(id as (typeof RESERVED_ESCAPE_OPTION_IDS)[number]);
}

const zAskOptionParam = z
  .object({
    id: z
      .string()
      .min(1)
      .regex(/^[^>\r\n]+$/, 'Option id must not contain ">" or line breaks.')
      .refine(isNotReservedEscapeId, 'Option ids "other" and "none" are reserved escape choices.'),
    label: z.string().trim().min(1),
    description: zNonBlankMarkdown.optional(),
  })
  .strict();
export type AskOptionParam = z.infer<typeof zAskOptionParam>;

const zAskLabels = z
  .object({
    topLabel: z
      .string()
      .trim()
      .min(1, 'markdown cannot be empty')
      .describe('Optional rounded-box top border label.')
      .optional(),
    bottomLabel: z
      .string()
      .trim()
      .min(1, 'markdown cannot be empty')
      .describe('Optional rounded-box bottom border label.')
      .optional(),
  })
  .strict();

export const zStandaloneAskParams = zAskLabels
  .extend({
    exchangeId: z.string().min(1).describe('Stable id for this one-shot ask result.'),
    acceptsDigest: z
      .string()
      .min(1)
      .describe('Referenced present_digest exchange whose final abstract this questionnaire accepts.')
      .optional(),
    questions: zQuestionnaireQuestions.describe('Fixed ordered bounded questionnaire.').optional(),
    body: z
      .string()
      .trim()
      .min(1, 'markdown cannot be empty')
      .describe('Markdown question body rendered and persisted with the answer.')
      .optional(),
    options: z
      .array(zAskOptionParam)
      .min(1)
      .describe('Finite response options. Omit for a free-text answer.')
      .optional(),
    multiple: z.boolean().describe('When options are present, allow one-or-more selections.').optional(),
    allowOther: z.boolean().describe('Whether the user may choose Other for option responses.').optional(),
    allowNone: z.boolean().describe('Whether the user may choose None for option responses.').optional(),
    commentPrompt: z
      .string()
      .trim()
      .min(1, 'markdown cannot be empty')
      .describe(
        'Prompt for an optional trailing comment; omit to skip the optional-comment step. Comments the response schema requires (Other/None selections) are always collected.',
      )
      .optional(),
  })
  .strict()
  .superRefine((params, ctx) => {
    if (!params.body && !params.questions)
      ctx.addIssue({ code: 'custom', path: ['body'], message: 'standalone ask requires body or questions' });
    if (params.acceptsDigest && !params.questions) {
      const ids = params.options?.map((option) => option.id);
      if (
        !params.body ||
        params.multiple ||
        params.allowOther ||
        params.allowNone ||
        params.commentPrompt ||
        ids?.length !== 2 ||
        ids[0] !== 'confirm' ||
        ids[1] !== 'revise'
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['acceptsDigest'],
          message: 'digest confirmation requires exactly the confirm and revise single-select options',
        });
      }
    }
    if (params.questions && (params.options || params.multiple || params.allowOther || params.allowNone)) {
      ctx.addIssue({
        code: 'custom',
        path: ['questions'],
        message: 'questionnaire cannot use top-level option controls',
      });
    }
  });
export type StandaloneAskParams = z.infer<typeof zStandaloneAskParams>;

export const zContinuingAskParams = z
  .object({
    continues: z
      .string()
      .min(1)
      .describe('Exchange id of an offer whose details declare the ask payload to collect.'),
    preface: z
      .string()
      .trim()
      .min(1, 'markdown cannot be empty')
      .describe(
        'Optional model-authored preface for a reference-based continuation; not part of the payload.',
      )
      .optional(),
  })
  .strict();
export type ContinuingAskParams = z.infer<typeof zContinuingAskParams>;

export const zAskParams = zAskLabels
  .extend({
    acceptsDigest: z
      .string()
      .min(1)
      .describe('Referenced present_digest exchange accepted by this questionnaire.')
      .optional(),
    questions: zQuestionnaireQuestions.describe('Fixed ordered bounded questionnaire.').optional(),
    exchangeId: z
      .string()
      .min(1)
      .describe('Stable id for this one-shot ask result. Omit when continuing an offer by reference.')
      .optional(),
    continues: z
      .string()
      .min(1)
      .describe('Exchange id of an offer whose details declare the ask payload to collect.')
      .optional(),
    preface: z
      .string()
      .trim()
      .min(1, 'markdown cannot be empty')
      .describe(
        'Optional model-authored preface for a reference-based continuation; not part of the payload.',
      )
      .optional(),
    body: z
      .string()
      .trim()
      .min(1, 'markdown cannot be empty')
      .describe('Markdown question body rendered and persisted with the answer.')
      .optional(),
    options: z
      .array(zAskOptionParam)
      .min(1)
      .describe('Finite response options. Omit for a free-text answer.')
      .optional(),
    multiple: z.boolean().describe('When options are present, allow one-or-more selections.').optional(),
    allowOther: z.boolean().describe('Whether the user may choose Other for option responses.').optional(),
    allowNone: z.boolean().describe('Whether the user may choose None for option responses.').optional(),
    commentPrompt: z
      .string()
      .trim()
      .min(1, 'markdown cannot be empty')
      .describe(
        'Prompt for an optional trailing comment; omit to skip the optional-comment step. Comments the response schema requires (Other/None selections) are always collected.',
      )
      .optional(),
  })
  .strict()
  .superRefine((params, ctx) => {
    if (params.continues) {
      const modelAuthoredPayloadKeys = [
        'exchangeId',
        'body',
        'options',
        'multiple',
        'allowOther',
        'allowNone',
        'commentPrompt',
        'topLabel',
        'bottomLabel',
        'acceptsDigest',
        'questions',
      ] as const;
      for (const key of modelAuthoredPayloadKeys) {
        if (params[key] !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'continuing ask payload is declared by the referenced offer',
          });
        }
      }
      return;
    }
    if (!params.exchangeId) {
      ctx.addIssue({ code: 'custom', path: ['exchangeId'], message: 'standalone ask requires exchangeId' });
    }
    if (!params.body && !params.questions) {
      ctx.addIssue({ code: 'custom', path: ['body'], message: 'standalone ask requires body or questions' });
    }
    if (params.acceptsDigest && !params.questions) {
      const ids = params.options?.map((option) => option.id);
      if (
        !params.body ||
        params.multiple ||
        params.allowOther ||
        params.allowNone ||
        params.commentPrompt ||
        ids?.length !== 2 ||
        ids[0] !== 'confirm' ||
        ids[1] !== 'revise'
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['acceptsDigest'],
          message: 'digest confirmation requires exactly the confirm and revise single-select options',
        });
      }
    }
    if (params.questions && (params.options || params.multiple || params.allowOther || params.allowNone)) {
      ctx.addIssue({
        code: 'custom',
        path: ['questions'],
        message: 'questionnaire cannot use top-level option controls',
      });
    }
  });
export type AskParams = StandaloneAskParams | ContinuingAskParams;

const zPresentedOptionParam = z
  .object({
    id: z
      .string()
      .min(1)
      // Option ids round-trip through a per-line `<!-- option-id: … -->` marker
      // recovered by a regex that stops at `>`; ids with `>` or line breaks would
      // silently fail to reconstruct (see structured-exchange-loop/pending-exchange.ts).
      .regex(/^[^>\r\n]+$/, 'Option id must not contain ">" or line breaks.')
      .refine(isNotReservedEscapeId, 'Option ids "other" and "none" are reserved escape choices.')
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
      .describe(
        'Whether the user may choose None for option responses — an answered rejection stating that no listed option applies (single- or multi-choice).',
      )
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
      .describe('Stable id tying this review-set proposal to the later ask({ continues }) review.'),
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
      .describe('Stable id tying this candidate presentation to the later ask({ continues }) call.'),
    heading: z.string().trim().min(1).describe('Candidate comparison heading.'),
    body: z.string().describe('Markdown body for context before the candidate list.').optional(),
    candidates: z
      .array(
        zPresentedCandidate.refine(
          (candidate) => isNotReservedEscapeId(candidate.id),
          'Candidate ids "other" and "none" are reserved escape choices.',
        ),
      )
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
      .describe('Stable id tying this digest presentation to the later ask({ continues }) review.'),
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

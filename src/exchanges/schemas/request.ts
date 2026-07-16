import * as z from 'zod';

import {
  zQuestionnaireAnswer,
  zQuestionnaireAnswersFor,
  zQuestionnaireQuestion,
  zQuestionnaireQuestions,
} from './questionnaire.js';
import {
  zMarkdown,
  zNonBlankMarkdown,
  zRequestAnswerToolMeta,
  zRequestChoiceToolMeta,
  zRequestChoicesToolMeta,
  zRequestDetailsHeader,
  zRequestDigestReviewToolMeta,
  zRequestReviewSetToolMeta,
} from './shared.js';

export const zCancelledOutcome = z
  .object({
    cancelled: z
      .object({
        message: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict();
export const CancelledOutcomeSchema = z.toJSONSchema(zCancelledOutcome, {
  unrepresentable: 'throw',
});

export const zUnavailableOutcome = z
  .object({
    unavailable: z
      .object({
        message: z.string().min(1),
      })
      .strict(),
  })
  .strict();
export const UnavailableOutcomeSchema = z.toJSONSchema(zUnavailableOutcome, {
  unrepresentable: 'throw',
});

export const zChoiceKind = z.enum(['listed', 'other', 'none']);
export type ChoiceKind = z.infer<typeof zChoiceKind>;
export const ChoiceKindSchema = z.toJSONSchema(zChoiceKind, {
  unrepresentable: 'throw',
});

export const zSelectedChoice = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    kind: zChoiceKind,
  })
  .strict();
export type SelectedChoice = z.infer<typeof zSelectedChoice>;
export const SelectedChoiceSchema = z.toJSONSchema(zSelectedChoice, {
  unrepresentable: 'throw',
});

export const zAnsweredOptionEcho = z
  .object({
    id: z.string().min(1),
    content: zNonBlankMarkdown,
    rationale: zMarkdown.optional(),
  })
  .strict();
export type AnsweredOptionEcho = z.infer<typeof zAnsweredOptionEcho>;

export function structuredExchangeResponseRequiresComment(params: {
  readonly choiceKinds?: readonly ChoiceKind[] | undefined;
  readonly reviewDecision?: 'approve' | 'request_changes' | 'reject' | undefined;
}): boolean {
  return (
    params.reviewDecision === 'request_changes' ||
    params.choiceKinds?.some((kind) => kind === 'other' || kind === 'none') === true
  );
}

const zChoiceAnsweredPayload = z
  .object({
    choice: zSelectedChoice,
    options: z.array(zAnsweredOptionEcho).min(1),
    comment: zMarkdown.optional(),
  })
  .strict()
  .superRefine((payload, ctx) => {
    if (
      structuredExchangeResponseRequiresComment({ choiceKinds: [payload.choice.kind] }) &&
      (!payload.comment || payload.comment.trim().length === 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['comment'],
        message: 'other and none choices require comment',
      });
    }
  });
export const zRequestChoiceAnswered = zChoiceAnsweredPayload;

const zChoicesAnsweredPayload = z
  .object({
    choices: z.array(zSelectedChoice).min(1),
    options: z.array(zAnsweredOptionEcho).min(1),
    comment: zMarkdown.optional(),
  })
  .strict()
  .superRefine((payload, ctx) => {
    if (
      structuredExchangeResponseRequiresComment({
        choiceKinds: payload.choices.map((choice) => choice.kind),
      }) &&
      (!payload.comment || payload.comment.trim().length === 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['comment'],
        message: 'other and none choices require comment',
      });
    }
    // none asserts that no listed option applies, so it contradicts any
    // co-selected choice; it must be the sole selection.
    if (payload.choices.some((choice) => choice.kind === 'none') && payload.choices.length > 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['choices'],
        message: 'none cannot be combined with other selections',
      });
    }
  });
export const zRequestChoicesAnswered = zChoicesAnsweredPayload;

export const zRequestAnswerDetails = z.union([
  zRequestDetailsHeader
    .extend({
      tool_meta: zRequestAnswerToolMeta,
      answered: z
        .object({
          text: zMarkdown.refine((value) => value.trim().length > 0, {
            message: 'answer text cannot be empty',
          }),
        })
        .strict(),
    })
    .strict(),
  zRequestDetailsHeader
    .extend({
      tool_meta: zRequestAnswerToolMeta.omit({ next: true }),
      cancelled: zCancelledOutcome.shape.cancelled,
    })
    .strict(),
  zRequestDetailsHeader
    .extend({
      tool_meta: zRequestAnswerToolMeta.omit({ next: true }),
      unavailable: zUnavailableOutcome.shape.unavailable,
    })
    .strict(),
]);
export type RequestAnswerDetails = z.infer<typeof zRequestAnswerDetails>;
export const RequestAnswerDetailsSchema = z.toJSONSchema(zRequestAnswerDetails, { unrepresentable: 'throw' });

export const zRequestChoiceDetails = z.union([
  zRequestDetailsHeader
    .extend({
      tool_meta: zRequestChoiceToolMeta,
      answered: zRequestChoiceAnswered,
    })
    .strict(),
  zRequestDetailsHeader
    .extend({
      tool_meta: zRequestChoiceToolMeta,
      cancelled: zCancelledOutcome.shape.cancelled,
    })
    .strict(),
  zRequestDetailsHeader
    .extend({
      tool_meta: zRequestChoiceToolMeta,
      unavailable: zUnavailableOutcome.shape.unavailable,
    })
    .strict(),
]);
export type RequestChoiceDetails = z.infer<typeof zRequestChoiceDetails>;
export const RequestChoiceDetailsSchema = z.toJSONSchema(zRequestChoiceDetails, { unrepresentable: 'throw' });

export const zRequestChoicesDetails = z.union([
  zRequestDetailsHeader
    .extend({
      tool_meta: zRequestChoicesToolMeta,
      answered: zRequestChoicesAnswered,
    })
    .strict(),
  zRequestDetailsHeader
    .extend({
      tool_meta: zRequestChoicesToolMeta.omit({ next: true }),
      cancelled: zCancelledOutcome.shape.cancelled,
    })
    .strict(),
  zRequestDetailsHeader
    .extend({
      tool_meta: zRequestChoicesToolMeta.omit({ next: true }),
      unavailable: zUnavailableOutcome.shape.unavailable,
    })
    .strict(),
]);
export type RequestChoicesDetails = z.infer<typeof zRequestChoicesDetails>;
export const RequestChoicesDetailsSchema = z.toJSONSchema(zRequestChoicesDetails, {
  unrepresentable: 'throw',
});

export const zReviewDecision = z.enum(['approve', 'request_changes', 'reject']);
export const ReviewDecisionSchema = z.toJSONSchema(zReviewDecision, {
  unrepresentable: 'throw',
});

const zReviewAnsweredPayload = z.union([
  z
    .object({
      decision: z.literal('approve'),
      comment: zMarkdown.optional(),
    })
    .strict(),
  z
    .object({
      decision: z.literal('request_changes'),
      comment: zMarkdown.refine(
        (value) =>
          !structuredExchangeResponseRequiresComment({ reviewDecision: 'request_changes' }) ||
          value.trim().length > 0,
        {
          message: 'request_changes requires comment',
        },
      ),
    })
    .strict(),
  z
    .object({
      decision: z.literal('reject'),
      comment: zMarkdown.optional(),
    })
    .strict(),
]);
export const zRequestReviewAnswered = zReviewAnsweredPayload;

export const zRequestReviewSetDetails = z.union([
  zRequestDetailsHeader
    .extend({
      tool_meta: zRequestReviewSetToolMeta,
      answered: zRequestReviewAnswered,
    })
    .strict(),
  zRequestDetailsHeader
    .extend({
      tool_meta: zRequestReviewSetToolMeta.omit({ next: true }),
      cancelled: zCancelledOutcome.shape.cancelled,
    })
    .strict(),
  zRequestDetailsHeader
    .extend({
      tool_meta: zRequestReviewSetToolMeta.omit({ next: true }),
      unavailable: zUnavailableOutcome.shape.unavailable,
    })
    .strict(),
]);

const zDigestReviewAnsweredPayload = z.union([
  z
    .object({
      decision: z.literal('approve'),
      accepted_abstract: zNonBlankMarkdown,
      comment: zMarkdown.optional(),
    })
    .strict(),
  z
    .object({
      decision: z.literal('request_changes'),
      comment: zMarkdown.refine((value) => value.trim().length > 0, {
        message: 'request_changes requires comment',
      }),
    })
    .strict(),
  z
    .object({
      decision: z.literal('reject'),
      comment: zMarkdown.optional(),
    })
    .strict(),
]);
export const zRequestDigestReviewAnswered = zDigestReviewAnsweredPayload;

export const zRequestDigestReviewDetails = z.union([
  zRequestDetailsHeader
    .extend({
      tool_meta: zRequestDigestReviewToolMeta,
      answered: zRequestDigestReviewAnswered,
    })
    .strict(),
  zRequestDetailsHeader
    .extend({
      tool_meta: zRequestDigestReviewToolMeta.omit({ next: true }),
      cancelled: zCancelledOutcome.shape.cancelled,
    })
    .strict(),
  zRequestDetailsHeader
    .extend({
      tool_meta: zRequestDigestReviewToolMeta.omit({ next: true }),
      unavailable: zUnavailableOutcome.shape.unavailable,
    })
    .strict(),
]);

const zAskQuestionOptionEcho = z
  .object({
    id: z.string().min(1),
    label: zNonBlankMarkdown,
    description: zNonBlankMarkdown.optional(),
  })
  .strict();
export type AskQuestionOptionEcho = z.infer<typeof zAskQuestionOptionEcho>;

const zAskQuestionEcho = z
  .object({
    body: zNonBlankMarkdown,
    options: z.array(zAskQuestionOptionEcho).min(1).optional(),
    multiple: z.boolean().optional(),
    commentPrompt: zNonBlankMarkdown.optional(),
    otherPrompt: zNonBlankMarkdown.optional(),
  })
  .strict();
export type AskQuestionEcho = z.infer<typeof zAskQuestionEcho>;

export const zAskQuestionnaireDetails = zRequestDetailsHeader
  .extend({
    tool_meta: z.object({ curr: z.literal('ask'), next: z.literal('capture_answer') }).strict(),
    question: z.object({ body: zNonBlankMarkdown }).strict(),
    accepts_digest: z.string().min(1),
    questionnaire: z
      .array(z.object({ question: zQuestionnaireQuestion, answer: zQuestionnaireAnswer }).strict())
      .min(1),
    answered: z.object({ submitted: z.literal(true), accepted_abstract: zNonBlankMarkdown }).strict(),
  })
  .strict()
  .superRefine((details, ctx) => {
    const questions = details.questionnaire.map(({ question }) => question);
    const answers = details.questionnaire.map(({ answer }) => answer);
    if (!zQuestionnaireQuestions.safeParse(questions).success) {
      ctx.addIssue({ code: 'custom', path: ['questionnaire'], message: 'invalid questionnaire questions' });
    }
    if (!zQuestionnaireAnswersFor(questions).safeParse(answers).success) {
      ctx.addIssue({ code: 'custom', path: ['questionnaire'], message: 'answers do not match questions' });
    }
    details.questionnaire.forEach(({ question, answer }, index) => {
      if (question.id !== answer.questionId) {
        ctx.addIssue({
          code: 'custom',
          path: ['questionnaire', index, 'answer', 'questionId'],
          message: 'answer does not correspond to paired question',
        });
      }
    });
  });
export type AskQuestionnaireDetails = z.infer<typeof zAskQuestionnaireDetails>;

export const zAskDigestConfirmationDetails = zRequestDetailsHeader
  .extend({
    tool_meta: z.object({ curr: z.literal('ask'), next: z.literal('capture_choice') }).strict(),
    question: zAskQuestionEcho.extend({ options: z.array(zAskQuestionOptionEcho).length(2) }),
    accepts_digest: z.string().min(1),
    answered: zRequestChoiceAnswered.extend({ accepted_abstract: zNonBlankMarkdown }),
  })
  .strict();
export type AskDigestConfirmationDetails = z.infer<typeof zAskDigestConfirmationDetails>;

export const zAskDetails = z.union([
  zAskQuestionnaireDetails,
  zAskDigestConfirmationDetails,
  zRequestDetailsHeader
    .extend({
      tool_meta: z.object({ curr: z.literal('ask'), next: z.literal('capture_answer').optional() }).strict(),
      question: zAskQuestionEcho,
      answered: z
        .object({
          text: zNonBlankMarkdown,
          comment: zMarkdown.optional(),
        })
        .strict(),
    })
    .strict(),
  zRequestDetailsHeader
    .extend({
      tool_meta: z.object({ curr: z.literal('ask'), next: z.literal('capture_choice').optional() }).strict(),
      question: zAskQuestionEcho.extend({ options: z.array(zAskQuestionOptionEcho).min(1) }),
      answered: zRequestChoiceAnswered,
    })
    .strict(),
  zRequestDetailsHeader
    .extend({
      tool_meta: z.object({ curr: z.literal('ask'), next: z.literal('capture_choices').optional() }).strict(),
      question: zAskQuestionEcho.extend({
        options: z.array(zAskQuestionOptionEcho).min(1),
        multiple: z.literal(true),
      }),
      answered: zRequestChoicesAnswered,
    })
    .strict(),
  zRequestDetailsHeader
    .extend({
      tool_meta: z.object({ curr: z.literal('ask') }).strict(),
      question: zAskQuestionEcho,
      cancelled: zCancelledOutcome.shape.cancelled,
    })
    .strict(),
  zRequestDetailsHeader
    .extend({
      tool_meta: z.object({ curr: z.literal('ask') }).strict(),
      question: zAskQuestionEcho,
      unavailable: zUnavailableOutcome.shape.unavailable,
    })
    .strict(),
]);
export type AskDetails = z.infer<typeof zAskDetails>;
export const AskDetailsSchema = z.toJSONSchema(zAskDetails, { unrepresentable: 'throw' });

export const zRequestReviewDetails = z.union([zRequestReviewSetDetails, zRequestDigestReviewDetails]);
export type RequestReviewDetails = z.infer<typeof zRequestReviewDetails>;
export type RequestDigestReviewDetails = z.infer<typeof zRequestDigestReviewDetails>;
export const RequestReviewDetailsSchema = z.toJSONSchema(zRequestReviewDetails, { unrepresentable: 'throw' });

export const zRequestDetails = z.union([
  zAskDetails,
  zRequestAnswerDetails,
  zRequestChoiceDetails,
  zRequestChoicesDetails,
  zRequestReviewDetails,
]);
export type RequestDetails = z.infer<typeof zRequestDetails>;
export const RequestDetailsSchema = z.toJSONSchema(zRequestDetails, {
  unrepresentable: 'throw',
});

type KeysOfUnion<T> = T extends unknown ? keyof T : never;

/**
 * Request outcome keys, projected from the details-schema union branches.
 * Every request details branch extends the shared header + `tool_meta` with
 * exactly one of these keys; the transcript carries the outcome as key
 * presence, never a status string.
 */
export type RequestOutcomeKey = Exclude<
  KeysOfUnion<RequestDetails>,
  | KeysOfUnion<z.infer<typeof zRequestDetailsHeader>>
  | 'tool_meta'
  | 'question'
  | 'accepts_digest'
  | 'questionnaire'
>;

// `satisfies Record<RequestOutcomeKey, true>` drift-couples this list to the
// schema branches in both directions: a missing or extra key fails to compile.
const requestOutcomeKeyMarkers = {
  answered: true,
  cancelled: true,
  unavailable: true,
} satisfies Record<RequestOutcomeKey, true>;

export const REQUEST_OUTCOME_KEYS = Object.keys(requestOutcomeKeyMarkers) as readonly RequestOutcomeKey[];

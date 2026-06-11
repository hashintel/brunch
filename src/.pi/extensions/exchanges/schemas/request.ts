import * as z from 'zod';

import {
  zMarkdown,
  zRequestAnswerToolMeta,
  zRequestChoiceToolMeta,
  zRequestChoicesToolMeta,
  zRequestDetailsHeader,
  zRequestReviewToolMeta,
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

const zChoiceAnsweredPayload = z
  .object({
    choice: zSelectedChoice,
    comment: zMarkdown.optional(),
  })
  .strict()
  .superRefine((payload, ctx) => {
    if (
      (payload.choice.kind === 'other' || payload.choice.kind === 'none') &&
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
    comment: zMarkdown.optional(),
  })
  .strict()
  .superRefine((payload, ctx) => {
    if (
      payload.choices.some((choice) => choice.kind === 'other' || choice.kind === 'none') &&
      (!payload.comment || payload.comment.trim().length === 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['comment'],
        message: 'other and none choices require comment',
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
          text: zMarkdown,
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
export const zRequestReviewAnswered = zReviewAnsweredPayload;

export const zRequestReviewDetails = z.union([
  zRequestDetailsHeader
    .extend({
      tool_meta: zRequestReviewToolMeta,
      answered: zRequestReviewAnswered,
    })
    .strict(),
  zRequestDetailsHeader
    .extend({
      tool_meta: zRequestReviewToolMeta.omit({ next: true }),
      cancelled: zCancelledOutcome.shape.cancelled,
    })
    .strict(),
  zRequestDetailsHeader
    .extend({
      tool_meta: zRequestReviewToolMeta.omit({ next: true }),
      unavailable: zUnavailableOutcome.shape.unavailable,
    })
    .strict(),
]);
export type RequestReviewDetails = z.infer<typeof zRequestReviewDetails>;
export const RequestReviewDetailsSchema = z.toJSONSchema(zRequestReviewDetails, { unrepresentable: 'throw' });

export const zRequestDetails = z.union([
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
  KeysOfUnion<z.infer<typeof zRequestDetailsHeader>> | 'tool_meta'
>;

// `satisfies Record<RequestOutcomeKey, true>` drift-couples this list to the
// schema branches in both directions: a missing or extra key fails to compile.
const requestOutcomeKeyMarkers = {
  answered: true,
  cancelled: true,
  unavailable: true,
} satisfies Record<RequestOutcomeKey, true>;

export const REQUEST_OUTCOME_KEYS = Object.keys(requestOutcomeKeyMarkers) as readonly RequestOutcomeKey[];

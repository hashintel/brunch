import * as z from "zod"

import { zMarkdown, zRequestDetailsHeader } from "./shared.js"

export const zCancelledOutcome = z
  .object({
    cancelled: z
      .object({
        message: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict()
export type CancelledOutcome = z.infer<typeof zCancelledOutcome>
export const CancelledOutcomeSchema = z.toJSONSchema(zCancelledOutcome, {
  unrepresentable: "throw",
})

export const zUnavailableOutcome = z
  .object({
    unavailable: z
      .object({
        message: z.string().min(1),
      })
      .strict(),
  })
  .strict()
export type UnavailableOutcome = z.infer<typeof zUnavailableOutcome>
export const UnavailableOutcomeSchema = z.toJSONSchema(zUnavailableOutcome, {
  unrepresentable: "throw",
})

export const zChoiceKind = z.enum(["listed", "other", "none"])
export type ChoiceKind = z.infer<typeof zChoiceKind>
export const ChoiceKindSchema = z.toJSONSchema(zChoiceKind, {
  unrepresentable: "throw",
})

export const zSelectedChoice = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    kind: zChoiceKind,
  })
  .strict()
export type SelectedChoice = z.infer<typeof zSelectedChoice>
export const SelectedChoiceSchema = z.toJSONSchema(zSelectedChoice, {
  unrepresentable: "throw",
})

const zChoiceAnsweredPayload = z
  .object({
    choice: zSelectedChoice,
    comment: zMarkdown.optional(),
  })
  .strict()
  .superRefine((payload, ctx) => {
    if (
      (payload.choice.kind === "other" || payload.choice.kind === "none") &&
      (!payload.comment || payload.comment.trim().length === 0)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["comment"],
        message: "other and none choices require comment",
      })
    }
  })
export const zRequestChoiceAnswered = zChoiceAnsweredPayload
export type RequestChoiceAnswered = z.infer<typeof zRequestChoiceAnswered>

const zChoicesAnsweredPayload = z
  .object({
    choices: z.array(zSelectedChoice).min(1),
    comment: zMarkdown.optional(),
  })
  .strict()
  .superRefine((payload, ctx) => {
    if (
      payload.choices.some(
        (choice) => choice.kind === "other" || choice.kind === "none",
      ) &&
      (!payload.comment || payload.comment.trim().length === 0)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["comment"],
        message: "other and none choices require comment",
      })
    }
  })
export const zRequestChoicesAnswered = zChoicesAnsweredPayload
export type RequestChoicesAnswered = z.infer<typeof zRequestChoicesAnswered>

export const zRequestAnswerDetails = z.union([
  zRequestDetailsHeader
    .extend({
      tool_meta: z
        .object({
          prev: z.literal("present_question"),
          curr: z.literal("request_answer"),
          next: z.literal("capture_answer").optional(),
        })
        .strict(),
      answered: z
        .object({
          text: zMarkdown,
        })
        .strict(),
    })
    .strict(),
  zRequestDetailsHeader
    .extend({
      tool_meta: z
        .object({
          prev: z.literal("present_question"),
          curr: z.literal("request_answer"),
        })
        .strict(),
      cancelled: zCancelledOutcome.shape.cancelled,
    })
    .strict(),
  zRequestDetailsHeader
    .extend({
      tool_meta: z
        .object({
          prev: z.literal("present_question"),
          curr: z.literal("request_answer"),
        })
        .strict(),
      unavailable: zUnavailableOutcome.shape.unavailable,
    })
    .strict(),
])
export type RequestAnswerDetails = z.infer<typeof zRequestAnswerDetails>
export const RequestAnswerDetailsSchema = z.toJSONSchema(
  zRequestAnswerDetails,
  { unrepresentable: "throw" },
)

export const zRequestChoiceDetails = z.union([
  zRequestDetailsHeader
    .extend({
      tool_meta: z.union([
        z
          .object({
            prev: z.literal("present_options"),
            curr: z.literal("request_choice"),
            next: z.literal("capture_choice").optional(),
          })
          .strict(),
        z
          .object({
            prev: z.literal("present_candidates"),
            curr: z.literal("request_choice"),
            next: z.literal("capture_candidate").optional(),
          })
          .strict(),
      ]),
      answered: zRequestChoiceAnswered,
    })
    .strict(),
  zRequestDetailsHeader
    .extend({
      tool_meta: z.union([
        z
          .object({
            prev: z.literal("present_options"),
            curr: z.literal("request_choice"),
          })
          .strict(),
        z
          .object({
            prev: z.literal("present_candidates"),
            curr: z.literal("request_choice"),
          })
          .strict(),
      ]),
      cancelled: zCancelledOutcome.shape.cancelled,
    })
    .strict(),
  zRequestDetailsHeader
    .extend({
      tool_meta: z.union([
        z
          .object({
            prev: z.literal("present_options"),
            curr: z.literal("request_choice"),
          })
          .strict(),
        z
          .object({
            prev: z.literal("present_candidates"),
            curr: z.literal("request_choice"),
          })
          .strict(),
      ]),
      unavailable: zUnavailableOutcome.shape.unavailable,
    })
    .strict(),
])
export type RequestChoiceDetails = z.infer<typeof zRequestChoiceDetails>
export const RequestChoiceDetailsSchema = z.toJSONSchema(
  zRequestChoiceDetails,
  { unrepresentable: "throw" },
)

export const zRequestChoicesDetails = z.union([
  zRequestDetailsHeader
    .extend({
      tool_meta: z
        .object({
          prev: z.literal("present_options"),
          curr: z.literal("request_choices"),
          next: z.literal("capture_choices").optional(),
        })
        .strict(),
      answered: zRequestChoicesAnswered,
    })
    .strict(),
  zRequestDetailsHeader
    .extend({
      tool_meta: z
        .object({
          prev: z.literal("present_options"),
          curr: z.literal("request_choices"),
        })
        .strict(),
      cancelled: zCancelledOutcome.shape.cancelled,
    })
    .strict(),
  zRequestDetailsHeader
    .extend({
      tool_meta: z
        .object({
          prev: z.literal("present_options"),
          curr: z.literal("request_choices"),
        })
        .strict(),
      unavailable: zUnavailableOutcome.shape.unavailable,
    })
    .strict(),
])
export type RequestChoicesDetails = z.infer<typeof zRequestChoicesDetails>
export const RequestChoicesDetailsSchema = z.toJSONSchema(
  zRequestChoicesDetails,
  { unrepresentable: "throw" },
)

export const zReviewDecision = z.enum(["approve", "request_changes", "reject"])
export type ReviewDecision = z.infer<typeof zReviewDecision>
export const ReviewDecisionSchema = z.toJSONSchema(zReviewDecision, {
  unrepresentable: "throw",
})

const zReviewAnsweredPayload = z.union([
  z
    .object({
      decision: z.literal("approve"),
      comment: zMarkdown.optional(),
    })
    .strict(),
  z
    .object({
      decision: z.literal("request_changes"),
      comment: zMarkdown.refine((value) => value.trim().length > 0, {
        message: "request_changes requires comment",
      }),
    })
    .strict(),
  z
    .object({
      decision: z.literal("reject"),
      comment: zMarkdown.optional(),
    })
    .strict(),
])
export const zRequestReviewAnswered = zReviewAnsweredPayload
export type RequestReviewAnswered = z.infer<typeof zRequestReviewAnswered>

export const zRequestReviewDetails = z.union([
  zRequestDetailsHeader
    .extend({
      tool_meta: z
        .object({
          prev: z.literal("present_review_set"),
          curr: z.literal("request_review"),
          next: z.literal("capture_review").optional(),
        })
        .strict(),
      answered: zRequestReviewAnswered,
    })
    .strict(),
  zRequestDetailsHeader
    .extend({
      tool_meta: z
        .object({
          prev: z.literal("present_review_set"),
          curr: z.literal("request_review"),
        })
        .strict(),
      cancelled: zCancelledOutcome.shape.cancelled,
    })
    .strict(),
  zRequestDetailsHeader
    .extend({
      tool_meta: z
        .object({
          prev: z.literal("present_review_set"),
          curr: z.literal("request_review"),
        })
        .strict(),
      unavailable: zUnavailableOutcome.shape.unavailable,
    })
    .strict(),
])
export type RequestReviewDetails = z.infer<typeof zRequestReviewDetails>
export const RequestReviewDetailsSchema = z.toJSONSchema(
  zRequestReviewDetails,
  { unrepresentable: "throw" },
)

export const zRequestDetails = z.union([
  zRequestAnswerDetails,
  zRequestChoiceDetails,
  zRequestChoicesDetails,
  zRequestReviewDetails,
])
export type RequestDetails = z.infer<typeof zRequestDetails>
export const RequestDetailsSchema = z.toJSONSchema(zRequestDetails, {
  unrepresentable: "throw",
})

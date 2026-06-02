import * as z from "zod"

import { zCaptureDetailsHeader } from "./shared.js"

export const zCaptureAnswerDetails = zCaptureDetailsHeader
  .extend({
    tool_meta: z
      .object({
        prev: z.literal("request_answer"),
        curr: z.literal("capture_answer"),
      })
      .strict(),
  })
  .strict()
export type CaptureAnswerDetails = z.infer<typeof zCaptureAnswerDetails>
export const CaptureAnswerDetailsSchema = z.toJSONSchema(
  zCaptureAnswerDetails,
  { unrepresentable: "throw" },
)

export const zCaptureChoiceDetails = zCaptureDetailsHeader
  .extend({
    tool_meta: z
      .object({
        prev: z.literal("request_choice"),
        curr: z.literal("capture_choice"),
      })
      .strict(),
  })
  .strict()
export type CaptureChoiceDetails = z.infer<typeof zCaptureChoiceDetails>
export const CaptureChoiceDetailsSchema = z.toJSONSchema(
  zCaptureChoiceDetails,
  { unrepresentable: "throw" },
)

export const zCaptureChoicesDetails = zCaptureDetailsHeader
  .extend({
    tool_meta: z
      .object({
        prev: z.literal("request_choices"),
        curr: z.literal("capture_choices"),
      })
      .strict(),
  })
  .strict()
export type CaptureChoicesDetails = z.infer<typeof zCaptureChoicesDetails>
export const CaptureChoicesDetailsSchema = z.toJSONSchema(
  zCaptureChoicesDetails,
  { unrepresentable: "throw" },
)

export const zCaptureReviewDetails = zCaptureDetailsHeader
  .extend({
    tool_meta: z
      .object({
        prev: z.literal("request_review"),
        curr: z.literal("capture_review"),
      })
      .strict(),
  })
  .strict()
export type CaptureReviewDetails = z.infer<typeof zCaptureReviewDetails>
export const CaptureReviewDetailsSchema = z.toJSONSchema(
  zCaptureReviewDetails,
  { unrepresentable: "throw" },
)

export const zCaptureCandidateDetails = zCaptureDetailsHeader
  .extend({
    tool_meta: z
      .object({
        prev: z.literal("request_choice"),
        curr: z.literal("capture_candidate"),
      })
      .strict(),
  })
  .strict()
export type CaptureCandidateDetails = z.infer<typeof zCaptureCandidateDetails>
export const CaptureCandidateDetailsSchema = z.toJSONSchema(
  zCaptureCandidateDetails,
  { unrepresentable: "throw" },
)

export const zCaptureDetails = z.union([
  zCaptureAnswerDetails,
  zCaptureChoiceDetails,
  zCaptureChoicesDetails,
  zCaptureReviewDetails,
  zCaptureCandidateDetails,
])
export type CaptureDetails = z.infer<typeof zCaptureDetails>
export const CaptureDetailsSchema = z.toJSONSchema(zCaptureDetails, {
  unrepresentable: "throw",
})

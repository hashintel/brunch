import * as z from "zod"

export const STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA =
  "brunch.structured_exchange.present" as const
export const STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA =
  "brunch.structured_exchange.request" as const
export const STRUCTURED_EXCHANGE_CAPTURE_DETAILS_SCHEMA =
  "brunch.structured_exchange.capture" as const
export const STRUCTURED_EXCHANGE_DETAILS_VERSION = 1 as const

export const zMarkdown = z.string()
export type Markdown = z.infer<typeof zMarkdown>
export const MarkdownSchema = z.toJSONSchema(zMarkdown, {
  unrepresentable: "throw",
})

export const zGraphNodeRef = z.object({ node_id: z.string().min(1) }).strict()
export type GraphNodeRef = z.infer<typeof zGraphNodeRef>
export const GraphNodeRefSchema = z.toJSONSchema(zGraphNodeRef, {
  unrepresentable: "throw",
})

export const zPresentToolName = z.enum([
  "present_question",
  "present_options",
  "present_review_set",
  "present_candidates",
])
export type PresentToolName = z.infer<typeof zPresentToolName>
export const PresentToolNameSchema = z.toJSONSchema(zPresentToolName, {
  unrepresentable: "throw",
})

export const zRequestToolName = z.enum([
  "request_answer",
  "request_choice",
  "request_choices",
  "request_review",
])
export type RequestToolName = z.infer<typeof zRequestToolName>
export const RequestToolNameSchema = z.toJSONSchema(zRequestToolName, {
  unrepresentable: "throw",
})

export const zCaptureToolName = z.enum([
  "capture_answer",
  "capture_choice",
  "capture_choices",
  "capture_review",
  "capture_candidate",
])
export type CaptureToolName = z.infer<typeof zCaptureToolName>
export const CaptureToolNameSchema = z.toJSONSchema(zCaptureToolName, {
  unrepresentable: "throw",
})

export const zPresentDetailsHeader = z
  .object({
    schema: z.literal(STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA),
    v: z.literal(STRUCTURED_EXCHANGE_DETAILS_VERSION),
    exchange_id: z.string().min(1),
  })
  .strict()
export type PresentDetailsHeader = z.infer<typeof zPresentDetailsHeader>
export const PresentDetailsHeaderSchema = z.toJSONSchema(
  zPresentDetailsHeader,
  { unrepresentable: "throw" },
)

export const zRequestDetailsHeader = z
  .object({
    schema: z.literal(STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA),
    v: z.literal(STRUCTURED_EXCHANGE_DETAILS_VERSION),
    exchange_id: z.string().min(1),
  })
  .strict()
export type RequestDetailsHeader = z.infer<typeof zRequestDetailsHeader>
export const RequestDetailsHeaderSchema = z.toJSONSchema(
  zRequestDetailsHeader,
  { unrepresentable: "throw" },
)

export const zCaptureDetailsHeader = z
  .object({
    schema: z.literal(STRUCTURED_EXCHANGE_CAPTURE_DETAILS_SCHEMA),
    v: z.literal(STRUCTURED_EXCHANGE_DETAILS_VERSION),
    exchange_id: z.string().min(1),
  })
  .strict()
export type CaptureDetailsHeader = z.infer<typeof zCaptureDetailsHeader>
export const CaptureDetailsHeaderSchema = z.toJSONSchema(
  zCaptureDetailsHeader,
  { unrepresentable: "throw" },
)

export const zPresentToolMeta = z.discriminatedUnion("curr", [
  z
    .object({
      curr: z.literal("present_question"),
      next: z.literal("request_answer"),
    })
    .strict(),
  z
    .object({
      curr: z.literal("present_options"),
      next: z.enum(["request_choice", "request_choices"]),
    })
    .strict(),
  z
    .object({
      curr: z.literal("present_review_set"),
      next: z.literal("request_review"),
    })
    .strict(),
  z
    .object({
      curr: z.literal("present_candidates"),
      next: z.literal("request_choice"),
    })
    .strict(),
])
export type PresentToolMeta = z.infer<typeof zPresentToolMeta>
export const PresentToolMetaSchema = z.toJSONSchema(zPresentToolMeta, {
  unrepresentable: "throw",
})

export const zRequestToolMeta = z.union([
  z
    .object({
      prev: z.literal("present_question"),
      curr: z.literal("request_answer"),
      next: z.literal("capture_answer").optional(),
    })
    .strict(),
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
  z
    .object({
      prev: z.literal("present_options"),
      curr: z.literal("request_choices"),
      next: z.literal("capture_choices").optional(),
    })
    .strict(),
  z
    .object({
      prev: z.literal("present_review_set"),
      curr: z.literal("request_review"),
      next: z.literal("capture_review").optional(),
    })
    .strict(),
])
export type RequestToolMeta = z.infer<typeof zRequestToolMeta>
export const RequestToolMetaSchema = z.toJSONSchema(zRequestToolMeta, {
  unrepresentable: "throw",
})

export const zCaptureToolMeta = z.union([
  z
    .object({
      prev: z.literal("request_answer"),
      curr: z.literal("capture_answer"),
    })
    .strict(),
  z
    .object({
      prev: z.literal("request_choice"),
      curr: z.literal("capture_choice"),
    })
    .strict(),
  z
    .object({
      prev: z.literal("request_choices"),
      curr: z.literal("capture_choices"),
    })
    .strict(),
  z
    .object({
      prev: z.literal("request_review"),
      curr: z.literal("capture_review"),
    })
    .strict(),
  z
    .object({
      prev: z.literal("request_choice"),
      curr: z.literal("capture_candidate"),
    })
    .strict(),
])
export type CaptureToolMeta = z.infer<typeof zCaptureToolMeta>
export const CaptureToolMetaSchema = z.toJSONSchema(zCaptureToolMeta, {
  unrepresentable: "throw",
})

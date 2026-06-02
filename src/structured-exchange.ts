export const STRUCTURED_EXCHANGE_RESULT_SCHEMA =
  "brunch.structured_exchange.result" as const

export type StructuredExchangeStatus = "answered" | "cancelled" | "unavailable"
export type StructuredExchangeMode = "text" | "single-select" | "multi-select"

export interface StructuredExchangeOption {
  label: string
  value: string
  description?: string
}

export type StructuredExchangeAnswer = {
  type: "text"
  label: string
  value: string
} | {
  type: "option"
  label: string
  value: string
  index: number
} | {
  type: "other"
  label: string
  value: string
}

export interface StructuredExchangeResultDetails {
  schema: typeof STRUCTURED_EXCHANGE_RESULT_SCHEMA
  schemaVersion: 1
  status: StructuredExchangeStatus
  question: string
  context?: string
  mode: StructuredExchangeMode
  options?: StructuredExchangeOption[]
  answers: StructuredExchangeAnswer[]
  rejectedOptions?: StructuredExchangeOption[]
  note?: string
  transport?: { surface: "tui-custom" | "rpc-editor" | "headless" }
  message?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function isStructuredExchangeResultDetails(
  value: unknown,
): value is StructuredExchangeResultDetails {
  if (!isRecord(value)) return false
  return (
    value.schema === STRUCTURED_EXCHANGE_RESULT_SCHEMA &&
    value.schemaVersion === 1 &&
    (value.status === "answered" ||
      value.status === "cancelled" ||
      value.status === "unavailable") &&
    typeof value.question === "string" &&
    (value.mode === "text" ||
      value.mode === "single-select" ||
      value.mode === "multi-select") &&
    Array.isArray(value.answers)
  )
}

export function isTerminalStructuredExchangeResultDetails(
  value: unknown,
): value is StructuredExchangeResultDetails {
  return (
    isStructuredExchangeResultDetails(value) &&
    (value.status === "answered" || value.status === "cancelled")
  )
}

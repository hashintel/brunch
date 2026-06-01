import {
  STRUCTURED_EXCHANGE_PRESENT_SCHEMA,
  STRUCTURED_EXCHANGE_REQUEST_SCHEMA,
  type PresentToolName,
  type RequestToolName,
  type StructuredExchangePresentDetails,
  type StructuredExchangeRequestDetails,
  isRecord,
} from "./model.js"

const PRESENT_TOOLS: readonly PresentToolName[] = [
  "present_question",
  "present_options",
  "present_review_set",
  "present_candidates",
]
const REQUEST_TOOLS: readonly RequestToolName[] = [
  "request_answer",
  "request_choice",
  "request_choices",
  "request_review",
]

function isPresentToolName(value: unknown): value is PresentToolName {
  return (
    typeof value === "string" &&
    PRESENT_TOOLS.includes(value as PresentToolName)
  )
}

function isRequestToolName(value: unknown): value is RequestToolName {
  return (
    typeof value === "string" &&
    REQUEST_TOOLS.includes(value as RequestToolName)
  )
}

export function isStructuredExchangePresentDetails(
  value: unknown,
): value is StructuredExchangePresentDetails {
  if (!isRecord(value)) return false
  if (value.schema !== STRUCTURED_EXCHANGE_PRESENT_SCHEMA) return false
  if (value.schemaVersion !== 1) return false
  if (typeof value.exchangeId !== "string" || value.exchangeId.length === 0) {
    return false
  }
  if (!isPresentToolName(value.presentTool)) return false
  if (
    value.kind !== "question" &&
    value.kind !== "options" &&
    value.kind !== "review_set" &&
    value.kind !== "candidates"
  ) {
    return false
  }
  if (value.status !== "presented") return false
  if (typeof value.createdAtToolCallId !== "string") return false
  if (value.expectedRequest !== undefined) {
    if (!isRecord(value.expectedRequest)) return false
    if (!isRequestToolName(value.expectedRequest.tool)) return false
    if (typeof value.expectedRequest.required !== "boolean") return false
  }
  return true
}

export function isStructuredExchangeRequestDetails(
  value: unknown,
): value is StructuredExchangeRequestDetails {
  if (!isRecord(value)) return false
  if (value.schema !== STRUCTURED_EXCHANGE_REQUEST_SCHEMA) return false
  if (value.schemaVersion !== 1) return false
  if (typeof value.exchangeId !== "string" || value.exchangeId.length === 0) {
    return false
  }
  if (!isRequestToolName(value.requestTool)) return false
  if (
    value.status !== "answered" &&
    value.status !== "cancelled" &&
    value.status !== "unavailable"
  ) {
    return false
  }
  if (!isRecord(value.respondsTo)) return false
  if (value.respondsTo.exchangeId !== value.exchangeId) return false
  if (!isPresentToolName(value.respondsTo.presentTool)) return false
  if (typeof value.createdAtToolCallId !== "string") return false
  return true
}

interface EntryLike {
  type?: unknown
  message?: {
    role?: unknown
    details?: unknown
  }
}

function toolResultDetails(entry: EntryLike): unknown {
  return entry.type === "message" && entry.message?.role === "toolResult"
    ? entry.message.details
    : undefined
}

export interface IncompleteStructuredExchangePresent {
  entry: EntryLike
  details: StructuredExchangePresentDetails
}

export function findIncompleteStructuredExchangePresents(
  entries: readonly EntryLike[],
): IncompleteStructuredExchangePresent[] {
  const presents = new Map<string, IncompleteStructuredExchangePresent>()
  const completed = new Set<string>()

  for (const entry of entries) {
    const details = toolResultDetails(entry)
    if (isStructuredExchangePresentDetails(details)) {
      if (details.expectedRequest?.required !== false) {
        presents.set(details.exchangeId, { entry, details })
      }
    } else if (isStructuredExchangeRequestDetails(details)) {
      completed.add(details.exchangeId)
    }
  }

  return [...presents.values()].filter(
    (present) => !completed.has(present.details.exchangeId),
  )
}

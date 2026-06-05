/**
 * Canonical projection for `request_answer` responses.
 *
 * Input:
 * - StructuredExchangeRequestDetails for answered/cancelled/unavailable cases
 *
 * Output:
 * - normalized answer/comment/status projection for durable response content
 *
 * Used by:
 * - structured-exchange/format/request-answer.ts
 * - session/structured-exchange-loop.ts
 * - .pi/extensions/structured-exchange/request-answer.ts
 */

export {};

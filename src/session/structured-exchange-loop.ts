/**
 * Structured-exchange loop — public entry point over its private sub-tree
 * (`structured-exchange-loop/`). The file outgrew its mini-library boundary, so
 * it splits by semantic purpose per the AGENTS.md fractal pattern:
 *
 * - `pending-exchange.ts`   — read path: reconstruct the pending structured
 *                             exchange (+ its schema) from a session envelope.
 * - `accepted-response.ts`  — write path: materialize an accepted user response
 *                             into the synthetic `request_*` toolResult.
 * - `synthetic-tool-call.ts`— provider-legality synthetic assistant toolCall
 *                             pairing (id rule + message minting).
 *
 * External consumers import only from this root; only this file imports from the
 * sub-tree.
 */

export {
  PendingStructuredExchangeSchema,
  pendingExchangeFromEnvelope,
  projectPendingStructuredExchange,
  providerToolCallIdForPending,
  zPendingStructuredExchange,
  type PendingStructuredExchange,
} from './structured-exchange-loop/pending-exchange.js';
export {
  syntheticExchangeToolCallMessage,
  syntheticExchangeToolResultMessage,
  type SyntheticExchangeToolCallMessage,
  type SyntheticExchangeToolResultMessage,
} from './structured-exchange-loop/synthetic-tool-call.js';
export {
  acceptedResponseFromParams,
  type AcceptedStructuredExchangeResponse,
  type StructuredExchangeResponseInput,
} from './structured-exchange-loop/accepted-response.js';

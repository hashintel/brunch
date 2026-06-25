/**
 * Canonical projection for selected-spec graph overview context.
 *
 * Input:
 * - GraphOverview from graph/queries.ts
 *
 * Output:
 * - compact typed shape for LLM-facing formatting
 * - ordered nodes/edges, omission counts, and truncation policy decisions
 *
 * Used by:
 * - agents/contexts/graph/graph-slice.ts
 * - .pi/extensions/brunch-data/graph/index.ts via graph overview tool results
 * - .pi/extensions/prompting.ts via pushed graph context
 */

export {};

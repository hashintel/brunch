/**
 * Canonical projection for selected-spec graph overview snapshots.
 *
 * Input:
 * - GraphOverview from graph/snapshot.ts
 *
 * Output:
 * - compact typed shape for LLM-facing formatting
 * - ordered nodes/edges, omission counts, and truncation policy decisions
 *
 * Used by:
 * - graph/format/overview.ts
 * - .pi/extensions/graph/index.ts via graph overview tool results
 * - .pi/extensions/prompting.ts via pushed graph snapshot context
 */

export {};

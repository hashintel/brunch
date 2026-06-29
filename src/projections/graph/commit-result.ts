/**
 * Canonical projection for mutate_graph mutation results.
 *
 * Input:
 * - MutateGraphResult from graph/command-executor.ts
 *
 * Output:
 * - compact typed success/failure shape for model-facing formatting
 * - created refs, diagnostic ordering, and omission policy
 *
 * Used by:
 * - agents/contexts/graph/commit-result.ts
 * - .pi/extensions/brunch-data/graph/index.ts via mutate_graph tool results
 */

export {};

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
 * - renderers/graph/commit-result.ts
 * - .pi/extensions/graph/index.ts via mutate_graph tool results
 */

export {};

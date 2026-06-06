/**
 * Canonical projection for commit_graph mutation results.
 *
 * Input:
 * - CommitGraphResult from graph/command-executor.ts
 *
 * Output:
 * - compact typed success/failure shape for model-facing formatting
 * - created refs, diagnostic ordering, and omission policy
 *
 * Used by:
 * - renderers/graph/commit-result.ts
 * - .pi/extensions/graph/index.ts via commit_graph tool results
 */

export {};

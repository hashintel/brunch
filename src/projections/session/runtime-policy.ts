// Temporary migration bridge: foreground agent runtime policy now lives in
// `src/agents/runtime/policy.ts`. This file is removed by the next refactor
// item once topology docs/import guards stop naming the old projections owner.
export * from '../../agents/runtime/policy.js';

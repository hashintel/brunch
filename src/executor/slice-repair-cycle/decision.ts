import type { SliceRepairPolicy } from './model.js';

export type CompletedVerificationIntent =
  | { readonly kind: 'pass'; readonly cycle: number }
  | { readonly kind: 'repair'; readonly sourceCycle: number; readonly nextCycle: number }
  | { readonly kind: 'exhaust'; readonly cycle: number };

export function decideCompletedVerification(args: {
  readonly verdict: 'passed' | 'failed';
  readonly cycle: number;
  readonly policy: SliceRepairPolicy;
}): CompletedVerificationIntent {
  if (
    !Number.isInteger(args.cycle) ||
    args.cycle < 1 ||
    !Number.isInteger(args.policy.maxRepairCycles) ||
    args.policy.maxRepairCycles < 1
  ) {
    throw new Error('invalid repair-cycle decision input');
  }
  if (args.verdict === 'passed') return { kind: 'pass', cycle: args.cycle };
  return args.cycle < args.policy.maxRepairCycles
    ? { kind: 'repair', sourceCycle: args.cycle, nextCycle: args.cycle + 1 }
    : { kind: 'exhaust', cycle: args.cycle };
}

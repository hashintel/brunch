// FE-829 slice 5: the build-architect eval harness.
//
// `evaluatePlanShape` is a total, pure acceptance oracle for emitted plans.
// `brunch plan` now AUTHORS its slice set with a non-deterministic LLM stage
// (slice 4B), so we need a deterministic, honestly-testable scorer that
// answers two questions the slice-5 plan poses: is the plan cook-executable
// (contract conformance), and does it have the SHAPE of the reference
// fixtures (structural similarity)?
//
// The verdict is an explicit, narrow gate — never "score >= X" — so the
// architect cannot game a scalar into acceptance:
//   - any `error`-severity contract finding under the strict `emitted`
//     profile, or
//   - any `file-write-conflict` (single-writer-per-file is the file-layout
//     invariant from slice 4A), or
//   - any slice missing a `writes` declaration (emitted plans must own their
//     files; an absent declaration is a hole, not a default)
// → `reject`. Otherwise `accept`.
//
// The `metrics` are graded structural features measured against the SHARED
// fixture-design principles (docs/design/orchestrator-demo-fixtures.md), not
// against any one fixture's ids / paths / counts — a generated plan for a
// different spec will never match a fixture lexically, so we score the
// abstract traits the principles encode. `overall` is a convenience summary
// for trending / ranking, NOT the gate.
//
// The three reference fixtures are the harness self-test: each must `accept`
// and score maximally (see `plan-eval.test.ts`).

import { checkPlan, type ContractExpectations, type ContractResult } from './plan-contract.js';
import type { Plan } from './types.js';

export interface PlanEvalMetrics {
  /** Slices owning ≥1 verification target / total slices. */
  verificationCoverage: number;
  /** Multi-slice epics carrying an integration seam / multi-slice epics (1 if none). */
  integrationSeamCoverage: number;
  /** Slices declaring ≥1 written file / total slices. */
  writesCoverage: number;
  /** 1 if no path is written by ≥2 slices, else 0. */
  singleWriterScore: number;
  /** 1 − (transitively-redundant edges / total edges); 1 if no edges. */
  redundantDependencyScore: number;
  /** Slices writing 1–2 files (sharp, one-module slices) / total slices. */
  sliceSharpnessScore: number;
  /** 1 if the plan encodes real build-order (edges present) or is trivially small. */
  dependencySignalScore: number;
}

export interface PlanEvalEvidence {
  /** Paths written by ≥2 slices, with the conflicting slice ids. */
  conflictingPaths: Array<{ path: string; sliceIds: string[] }>;
  /** Edges where the target is already reachable via another path. */
  redundantEdges: Array<{ sliceId: string; dependsOn: string }>;
  /** Slice ids with no `writes` declaration. */
  slicesMissingWrites: string[];
  /** Multi-slice epic ids lacking an integration seam. */
  multiSliceEpicsMissingSeam: string[];
}

export interface PlanEvalReport {
  verdict: 'accept' | 'reject';
  /** Human-readable reasons the verdict is `reject` (empty when `accept`). */
  hardFailures: string[];
  /** The underlying strict-profile contract result. */
  contract: ContractResult;
  metrics: PlanEvalMetrics;
  /** Weighted mean of `metrics` for trending only — not the gate. */
  overall: number;
  evidence: PlanEvalEvidence;
}

// Soft heuristics (sharpness, dependency-signal) carry half weight: they are
// useful trend signals but legitimately vary with the spec, so they should
// not dominate the summary score.
const METRIC_WEIGHTS: Record<keyof PlanEvalMetrics, number> = {
  verificationCoverage: 1,
  integrationSeamCoverage: 1,
  writesCoverage: 1,
  singleWriterScore: 1,
  redundantDependencyScore: 1,
  sliceSharpnessScore: 0.5,
  dependencySignalScore: 0.5,
};

/**
 * Total, pure evaluation. Never throws; never mutates the input. Runs the
 * strict `emitted` contract (callers may pass coverage expectations through
 * `expectations`), then layers the eval-harness-specific hard rules and the
 * structural metric vector on top.
 */
export function evaluatePlanShape(
  plan: Plan,
  expectations: Omit<ContractExpectations, 'profile'> = {},
): PlanEvalReport {
  const contract = checkPlan(plan, { ...expectations, profile: 'emitted' });

  const sliceCountByEpic = new Map<string, number>();
  for (const slice of plan.slices) {
    sliceCountByEpic.set(slice.epic_id, (sliceCountByEpic.get(slice.epic_id) ?? 0) + 1);
  }

  const conflictingPaths = contract.findings
    .filter((f) => f.code === 'file-write-conflict')
    .map((f) => ({ path: f.path, sliceIds: f.sliceIds }));

  const slicesMissingWrites = plan.slices
    .filter((slice) => (slice.writes ?? []).length === 0)
    .map((slice) => slice.id);

  // The contract owns the seam invariant (what counts as multi-slice / an
  // integration seam). Derive the missing-seam set from the findings it
  // already produced under the strict profile rather than re-detecting it, so
  // eval and contract cannot drift. The epic-count map below is retained only
  // for the `integrationSeamCoverage` denominator (total multi-slice epics),
  // which the findings do not carry.
  const multiSliceEpicsMissingSeam = contract.findings
    .filter((f) => f.code === 'multi-slice-epic-missing-integration-seam')
    .map((f) => f.epicId);

  const redundantEdges = findRedundantEdges(plan);

  // Hard gate: explicit, narrow, never a score threshold.
  const hardFailures: string[] = [];
  if (!contract.ok) {
    const errorCodes = [
      ...new Set(contract.findings.filter((f) => f.severity === 'error').map((f) => f.code)),
    ];
    hardFailures.push(`contract errors (emitted profile): ${errorCodes.join(', ')}`);
  }
  for (const { path, sliceIds } of conflictingPaths) {
    hardFailures.push(`file-write-conflict on ${path} (${sliceIds.join(', ')})`);
  }
  if (slicesMissingWrites.length > 0) {
    hardFailures.push(`slices missing writes: ${slicesMissingWrites.join(', ')}`);
  }

  const total = plan.slices.length;
  const multiSliceEpics = plan.epics.filter((e) => (sliceCountByEpic.get(e.id) ?? 0) >= 2);
  const edgeCount = plan.slices.reduce((sum, slice) => sum + slice.depends_on.length, 0);
  const sharpSlices = plan.slices.filter((slice) => {
    const n = (slice.writes ?? []).length;
    return n >= 1 && n <= 2;
  }).length;

  const metrics: PlanEvalMetrics = {
    verificationCoverage: ratio(plan.slices.filter((s) => s.verification.length > 0).length, total),
    integrationSeamCoverage:
      multiSliceEpics.length === 0
        ? 1
        : ratio(multiSliceEpics.length - multiSliceEpicsMissingSeam.length, multiSliceEpics.length),
    writesCoverage: ratio(total - slicesMissingWrites.length, total),
    singleWriterScore: conflictingPaths.length === 0 ? 1 : 0,
    redundantDependencyScore: edgeCount === 0 ? 1 : ratio(edgeCount - redundantEdges.length, edgeCount),
    sliceSharpnessScore: ratio(sharpSlices, total),
    dependencySignalScore: total <= 2 || edgeCount > 0 ? 1 : 0,
  };

  return {
    verdict: hardFailures.length === 0 ? 'accept' : 'reject',
    hardFailures,
    contract,
    metrics,
    overall: weightedMean(metrics),
    evidence: { conflictingPaths, redundantEdges, slicesMissingWrites, multiSliceEpicsMissingSeam },
  };
}

/**
 * Transitively-redundant edges: an edge a→b is redundant when b is already
 * reachable from a through a's OTHER dependencies. Such edges over-serialize
 * the plan (principle 3 — `depends_on` only for genuine build-order). Cycles
 * are tolerated: reachability is bounded by the visited set.
 */
function findRedundantEdges(plan: Plan): Array<{ sliceId: string; dependsOn: string }> {
  const depsById = new Map<string, string[]>(plan.slices.map((slice) => [slice.id, [...slice.depends_on]]));
  const redundant: Array<{ sliceId: string; dependsOn: string }> = [];

  for (const slice of plan.slices) {
    const directDeps = slice.depends_on;
    for (const target of directDeps) {
      // Can we reach `target` from `slice` WITHOUT using the direct edge?
      const seeds = directDeps.filter((dep) => dep !== target);
      if (reachable(seeds, target, depsById)) {
        redundant.push({ sliceId: slice.id, dependsOn: target });
      }
    }
  }
  return redundant;
}

function reachable(
  seeds: readonly string[],
  target: string,
  depsById: ReadonlyMap<string, string[]>,
): boolean {
  const stack = [...seeds];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node === target) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    for (const dep of depsById.get(node) ?? []) stack.push(dep);
  }
  return false;
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : numerator / denominator;
}

function weightedMean(metrics: PlanEvalMetrics): number {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const key of Object.keys(METRIC_WEIGHTS) as Array<keyof PlanEvalMetrics>) {
    const weight = METRIC_WEIGHTS[key];
    weightedSum += metrics[key] * weight;
    weightTotal += weight;
  }
  return weightedSum / weightTotal;
}

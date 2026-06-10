// FE-829 slice 1: the executability contract (D167-K / I129-K).
//
// `checkPlan` is the producer-agnostic, total/pure predicate that answers
// "is this plan cook-executable?" — for hand-authored fixtures, today's
// reconciler output, and a future build-architect LLM alike. `repairPlan`
// is the deterministic repair: it fixes the *mechanical* class (drop self
// / dangling deps, Kahn cycle-break, mint a missing per-slice verification
// target, synthesize the per-epic integration seam) and leaves the
// *design* class (an uncovered requirement) for a human or the LLM stage.
//
// Two profiles resolve the tension between the integration-seam invariant
// and the read-only reference fixtures (`layered-todo` / `resilient-
// pipeline` have bare multi-slice epics): the missing seam is a *warning*
// under `base` (so authored fixtures pass `check` unmodified) and an
// *error* under `emitted` (so `brunch plan` output must repair it before
// it ships). `repairPlan` always synthesizes the seam, so emitted plans
// satisfy the strict profile and the FE-800 integration-blind gap closes.

import { breakDependencyCycles } from './plan-graph.js';
import { defaultToolchain, type Toolchain } from './project-profile.js';
import type { Epic, Plan, Slice } from './types.js';

export type ContractProfile = 'base' | 'emitted';

export interface ContractExpectations {
  /**
   * 'base' (default) accepts authored / reference plans: a multi-slice
   * epic without an integration seam is a warning. 'emitted' is the
   * strict profile for `brunch plan` output: that same gap is an error.
   */
  profile?: ContractProfile;
  /**
   * Slice ids that must each appear (or be explicitly non-buildable) for
   * full requirement coverage. Omit — as authored fixtures do — to skip
   * the coverage check entirely; coverage is not derivable from a `Plan`
   * alone. Legacy 1:1 form (requirement id === slice id); use the
   * `requirementIds` family below when slices are authored (FE-829 4B).
   */
  requirementSliceIds?: readonly string[];
  /** Requirement slice ids explicitly judged non-buildable upstream. */
  nonBuildableSliceIds?: readonly string[];
  /**
   * Generalized coverage (FE-829 slice 4B): requirement ids that must each
   * be covered (appear in `coveredRequirementIds`) or be explicitly
   * non-buildable. Decouples coverage from a 1:1 requirement↔slice mapping
   * so an authored, decomposed plan can be checked by requirement
   * provenance. Takes precedence over `requirementSliceIds` when set.
   */
  requirementIds?: readonly string[];
  /** Requirement ids covered by ≥1 surviving slice's provenance. */
  coveredRequirementIds?: readonly string[];
  /** Requirement ids explicitly judged non-buildable upstream. */
  nonBuildableRequirementIds?: readonly string[];
}

export type ContractFinding =
  | { code: 'self-dependency'; severity: 'error'; sliceId: string }
  | { code: 'dangling-dependency'; severity: 'error'; sliceId: string; missingId: string }
  | { code: 'dependency-cycle'; severity: 'error'; sliceId: string; dependsOn: string }
  | { code: 'slice-missing-verification'; severity: 'error'; sliceId: string }
  | { code: 'slice-missing-epic'; severity: 'error'; sliceId: string; epicId: string }
  | { code: 'multi-slice-epic-missing-integration-seam'; severity: 'warning' | 'error'; epicId: string }
  | { code: 'uncovered-requirement'; severity: 'error'; sliceId: string }
  | { code: 'duplicate-slice-id'; severity: 'error'; sliceId: string }
  | { code: 'duplicate-epic-id'; severity: 'error'; epicId: string }
  | { code: 'file-write-conflict'; severity: 'warning'; path: string; sliceIds: string[] };

export interface ContractResult {
  /** No `error`-severity findings under the selected profile. */
  ok: boolean;
  findings: ContractFinding[];
}

const INTEGRATION_KIND = 'integration-test';

/**
 * Total, pure executability predicate. Never throws; never mutates the
 * input. `ok` is true iff no `error`-severity finding remains under the
 * selected profile.
 */
export function checkPlan(plan: Plan, expectations: ContractExpectations = {}): ContractResult {
  const profile = expectations.profile ?? 'base';
  const findings: ContractFinding[] = [];

  const sliceIds = new Set(plan.slices.map((slice) => slice.id));
  const epicIds = new Set(plan.epics.map((epic) => epic.id));
  const dependsOnById = new Map<string, readonly string[]>(
    plan.slices.map((slice) => [slice.id, slice.depends_on] as const),
  );

  const seenSliceIds = new Set<string>();
  for (const slice of plan.slices) {
    if (seenSliceIds.has(slice.id)) {
      findings.push({ code: 'duplicate-slice-id', severity: 'error', sliceId: slice.id });
    } else {
      seenSliceIds.add(slice.id);
    }
  }

  const seenEpicIds = new Set<string>();
  for (const epic of plan.epics) {
    if (seenEpicIds.has(epic.id)) {
      findings.push({ code: 'duplicate-epic-id', severity: 'error', epicId: epic.id });
    } else {
      seenEpicIds.add(epic.id);
    }
  }

  for (const slice of plan.slices) {
    for (const dep of slice.depends_on) {
      if (dep === slice.id) {
        findings.push({ code: 'self-dependency', severity: 'error', sliceId: slice.id });
      } else if (!sliceIds.has(dep)) {
        findings.push({ code: 'dangling-dependency', severity: 'error', sliceId: slice.id, missingId: dep });
      }
    }
    if (slice.verification.length === 0) {
      findings.push({ code: 'slice-missing-verification', severity: 'error', sliceId: slice.id });
    }
    if (!epicIds.has(slice.epic_id)) {
      findings.push({
        code: 'slice-missing-epic',
        severity: 'error',
        sliceId: slice.id,
        epicId: slice.epic_id,
      });
    }
  }

  // Cycles are reported via the shared Kahn policy so detection and repair
  // agree on exactly which edges are the offending ones.
  for (const edge of breakDependencyCycles(sliceIds, dependsOnById).droppedEdges) {
    findings.push({
      code: 'dependency-cycle',
      severity: 'error',
      sliceId: edge.sliceId,
      dependsOn: edge.dependsOn,
    });
  }

  const sliceCountByEpic = countSlicesByEpic(plan);
  for (const epic of plan.epics) {
    if ((sliceCountByEpic.get(epic.id) ?? 0) >= 2 && !hasIntegrationSeam(epic)) {
      findings.push({
        code: 'multi-slice-epic-missing-integration-seam',
        severity: profile === 'emitted' ? 'error' : 'warning',
        epicId: epic.id,
      });
    }
  }

  // Requirement coverage. Generalized form (by provenance) takes precedence;
  // the legacy 1:1 form (requirement id === slice id) remains for callers
  // that have not adopted authored decomposition.
  if (expectations.requirementIds) {
    const covered = new Set(expectations.coveredRequirementIds ?? []);
    const nonBuildable = new Set(expectations.nonBuildableRequirementIds ?? []);
    for (const requiredId of expectations.requirementIds) {
      if (!covered.has(requiredId) && !nonBuildable.has(requiredId)) {
        findings.push({ code: 'uncovered-requirement', severity: 'error', sliceId: requiredId });
      }
    }
  } else if (expectations.requirementSliceIds) {
    const nonBuildable = new Set(expectations.nonBuildableSliceIds ?? []);
    for (const requiredId of expectations.requirementSliceIds) {
      if (!sliceIds.has(requiredId) && !nonBuildable.has(requiredId)) {
        findings.push({ code: 'uncovered-requirement', severity: 'error', sliceId: requiredId });
      }
    }
  }

  // File ownership: single-writer-per-file. A path declared by ≥2 slices is a
  // design-class conflict (resolving it changes decomposition / ownership, so
  // it is never auto-repaired). Duplicate paths within ONE slice are deduped
  // first so a slice listing the same path twice cannot self-conflict.
  const writersByPath = new Map<string, string[]>();
  for (const slice of plan.slices) {
    for (const path of new Set(slice.writes ?? [])) {
      const writers = writersByPath.get(path) ?? [];
      writers.push(slice.id);
      writersByPath.set(path, writers);
    }
  }
  for (const [path, conflictSliceIds] of writersByPath) {
    if (conflictSliceIds.length >= 2) {
      findings.push({ code: 'file-write-conflict', severity: 'warning', path, sliceIds: conflictSliceIds });
    }
  }

  return { ok: findings.every((finding) => finding.severity !== 'error'), findings };
}

export type ContractRepair =
  | { code: 'dropped-self-loop'; sliceId: string }
  | { code: 'dropped-dependency-nonexistent-id'; sliceId: string; missingId: string }
  | { code: 'cycle-break-dropped-edge'; sliceId: string; droppedDependsOn: string }
  | { code: 'synthesized-verification-target'; sliceId: string; target: string }
  | { code: 'synthesized-integration-seam'; epicId: string; target: string };

/**
 * Deterministic mechanical-class repair. Returns a normalized plan plus a
 * typed repair per change. Idempotent: `repairPlan(repairPlan(p).plan)`
 * yields an equal plan and no further repairs, and `checkPlan` accepts the
 * result under the strict `emitted` profile when no design-class issue
 * (an uncovered requirement, or a `file-write-conflict`) remains.
 *
 * File ownership is design-class: repair never rewrites `writes`, moves
 * ownership between slices, or synthesizes a join slice. Overlapping
 * `writes` are preserved verbatim (carried through the slice spread) and
 * surfaced only via `checkPlan`; resolving them is an authoring decision.
 */
export function repairPlan(
  plan: Plan,
  toolchain: Toolchain = defaultToolchain,
): { plan: Plan; repairs: ContractRepair[] } {
  const repairs: ContractRepair[] = [];
  const sliceIds = new Set(plan.slices.map((slice) => slice.id));

  // 1. Drop self / dangling dependency edges (each surfaced once).
  const cleanedDeps = new Map<string, string[]>();
  for (const slice of plan.slices) {
    const kept: string[] = [];
    let selfWarned = false;
    for (const dep of slice.depends_on) {
      if (dep === slice.id) {
        if (!selfWarned) {
          repairs.push({ code: 'dropped-self-loop', sliceId: slice.id });
          selfWarned = true;
        }
        continue;
      }
      if (!sliceIds.has(dep)) {
        repairs.push({ code: 'dropped-dependency-nonexistent-id', sliceId: slice.id, missingId: dep });
        continue;
      }
      kept.push(dep);
    }
    cleanedDeps.set(slice.id, kept);
  }

  // 2. Break cycles with the shared deterministic policy.
  const { dependsOnById, droppedEdges } = breakDependencyCycles(sliceIds, cleanedDeps);
  for (const edge of droppedEdges) {
    repairs.push({
      code: 'cycle-break-dropped-edge',
      sliceId: edge.sliceId,
      droppedDependsOn: edge.dependsOn,
    });
  }

  // 3. Mint a per-slice verification target where none exists.
  const repairedSlices: Slice[] = plan.slices.map((slice) => {
    let verification = slice.verification;
    if (verification.length === 0) {
      const target = toolchain.sliceTarget(slice.id);
      repairs.push({ code: 'synthesized-verification-target', sliceId: slice.id, target });
      verification = [{ kind: 'unit-test', target }];
    }
    return { ...slice, depends_on: dependsOnById.get(slice.id) ?? [], verification };
  });

  // 4. Synthesize the integration seam on every multi-slice epic.
  const sliceCountByEpic = countSlicesByEpic({ ...plan, slices: repairedSlices });
  const repairedEpics: Epic[] = plan.epics.map((epic) => {
    if ((sliceCountByEpic.get(epic.id) ?? 0) >= 2 && !hasIntegrationSeam(epic)) {
      const target = toolchain.epicTarget(epic.id);
      repairs.push({ code: 'synthesized-integration-seam', epicId: epic.id, target });
      return { ...epic, verification: [...epic.verification, { kind: INTEGRATION_KIND, target }] };
    }
    return epic;
  });

  return { plan: { ...plan, epics: repairedEpics, slices: repairedSlices }, repairs };
}

function countSlicesByEpic(plan: Plan): Map<string, number> {
  const counts = new Map<string, number>();
  for (const slice of plan.slices) {
    counts.set(slice.epic_id, (counts.get(slice.epic_id) ?? 0) + 1);
  }
  return counts;
}

function hasIntegrationSeam(epic: Epic): boolean {
  return epic.verification.some((entry) => entry.kind === INTEGRATION_KIND);
}

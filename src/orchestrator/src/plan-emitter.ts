// FE-800 slices 4-5 + FE-829 slice 4B: end-to-end plan emission.
//
// Walks one `CompletedSpecSnapshot` through:
//   1. deterministic projection (the requirement universe + criteria),
//   2. the build-architect AUTHORING LLM call (`architectPlan`) — decomposes
//      requirements into file-disjoint scaffold/behaviour/join slices with
//      `writes` + `derivedFrom`,
//   3. deterministic materialization (`materializeArchitectedPlan`) +
//      contract repair (`repairPlan`),
//   4. a generalized executability + coverage gate (`checkPlan`, `emitted`
//      profile).
//
// If authoring fails (thrown/parse) OR the authored plan is unusable after
// repair (e.g. a requirement is left uncovered), the emitter FALLS BACK to a
// purely deterministic plan: `reconcilePlan(projected, ∅)` + `repairPlan`.
// The fallback never makes a second LLM call, so callers always receive a
// usable, contract-satisfying plan plus one audit-ready warning stream.

import {
  architectPlan,
  defaultArchitectRunModel,
  type ArchitectResult,
  type RunModel,
} from './plan-architect.js';
import { checkPlan, repairPlan, type ContractResult } from './plan-contract.js';
import { materializeArchitectedPlan, type MaterializeWarning } from './plan-materialize.js';
import { projectPlanningContext } from './plan-planning-context.js';
import { buildPlanSpec, projectPlanFromSpec, type CompletedSpecSnapshot } from './plan-projection.js';
import {
  explainReconciliationWarning,
  formatReconciliationWarning,
  reconcilePlan,
  reconciliationWarningCategory,
  type PlanningEnrichment,
  type ReconciliationWarning,
} from './plan-reconciliation.js';
import { detectProfile, detectTestDir, type ProfileDetection } from './project-detect.js';
import { resolveToolchain, withTestDir, type ProfileId, type Toolchain } from './project-profile.js';
import type { Plan, PlanMode, PlanSpec } from './types.js';

const EMPTY_ENRICHMENT: PlanningEnrichment = {
  sliceDependencies: [],
  epics: [],
  nonBuildableSliceIds: [],
};

/**
 * Single warning union for the emitter. Widens `ReconciliationWarning` and
 * the materializer's warnings with the emitter-level seam + fallback codes,
 * so a caller iterating `warnings` sees one stream.
 */
export type EmitterWarning =
  | ReconciliationWarning
  | { code: 'synthesized-integration-seam'; epicId: string; target: string }
  | { code: 'dropped-unknown-requirement-ref'; sliceId: string; requirementId: string }
  | { code: 'dropped-epic-dependency-nonexistent-id'; epicId: string; missingId: string }
  | { code: 'cycle-break-dropped-epic-edge'; epicId: string; droppedDependsOn: string }
  | { code: 'file-write-conflict'; severity: 'warning'; path: string; sliceIds: string[] }
  | { code: 'architect-failed-fallback-to-projection'; reason: string };

export type EmitPlanResult = {
  plan: Plan;
  warnings: EmitterWarning[];
  /** Raw architect-stage status for callers that want the un-collapsed result. */
  architectResult: ArchitectResult;
};

export type EmitPlanOptions = {
  /**
   * LLM seam for the architect stage. Defaults to the production anthropic
   * adapter (`defaultArchitectRunModel`). Tests inject a stub.
   */
  runModel?: RunModel;
  /**
   * Toolchain profile override (the `--profile` CLI flag). Wins over the
   * spec's `profile`; the resolved id is always stamped onto the emitted
   * plan so `brunch cook` reads the same profile the emitter used.
   */
  profile?: ProfileId;
  /**
   * Toolchain descriptor that shapes verification targets. Defaults to the
   * one resolved from the selected profile (`resolveToolchain`).
   */
  toolchain?: Toolchain;
  /**
   * Project directory to detect the toolchain from (`brunch-detect`). Used only
   * for **brownfield** plans — greenfield has an empty worktree and never
   * detects. When omitted, detection is skipped and the FE-843 chain is
   * unchanged (back-compat for callers/tests that don't read a repo).
   */
  repoDir?: string;
  /** Injectable detector seam (tests). Defaults to `detectProfile`. */
  detect?: (repoDir: string) => ProfileDetection;
  /**
   * Injectable test-directory detector seam (tests). Defaults to
   * `detectTestDir`. Brownfield-only; co-locates generated tests where the host
   * repo already keeps its tests so a narrowed runner include glob still
   * discovers them.
   */
  detectTestDir?: (repoDir: string) => string | null;
};

/**
 * Resolve the profile id stamped onto the emitted plan, with `brunch-detect`
 * inserted as the brownfield front of the FE-843 chain:
 *
 *   flag ≫ detected (brownfield) ≫ spec ≫ architect-classified ≫ bun
 *
 * Detection reads the real repo, so its identity beats spec prose. A loud
 * detection failure must not silently fall to bun: it falls through to an
 * explicit spec/architect choice if one exists, otherwise throws — the
 * actionable failure `brunch-detect` promises instead of cooking a brownfield
 * repo under the wrong toolchain. Greenfield (or brownfield without a repo dir)
 * keeps the unchanged FE-843 chain.
 */
function resolveEmittedProfile(args: {
  flag?: ProfileId;
  mode: PlanMode;
  repoDir?: string;
  specProfile?: ProfileId;
  classified: ProfileId | null;
  detect: (repoDir: string) => ProfileDetection;
}): ProfileId {
  // Explicit flag wins and short-circuits detection (no repo read).
  if (args.flag) return args.flag;

  if (args.mode === 'brownfield' && args.repoDir !== undefined) {
    const detected = args.detect(args.repoDir);
    if (detected.detected) return detected.profile;
    if (args.specProfile) return args.specProfile;
    if (args.classified) return args.classified;
    throw new Error(`brunch detect: ${detected.reason}`);
  }

  return args.specProfile ?? args.classified ?? 'bun';
}

export async function emitPlanFromSnapshot(
  snapshot: CompletedSpecSnapshot,
  options: EmitPlanOptions = {},
): Promise<EmitPlanResult> {
  const runModel = options.runModel ?? defaultArchitectRunModel;

  const projected = projectPlanFromSpec(snapshot);
  const planningContext = projectPlanningContext(snapshot);
  // Spec provenance block (FE-885) — built once from the snapshot and attached
  // to whichever plan ships (architected or fallback). Inert to execution.
  const spec = buildPlanSpec(snapshot);

  const architectResult = await architectPlan(projected, runModel, planningContext);

  // Selection chain: flag ≫ detected (brownfield) ≫ spec ≫ architect-classified
  // ≫ bun. Resolved exactly once, here; both paths below stamp the result onto
  // the emitted plan. A failed architect simply skips its rung.
  const classified: ProfileId | null =
    architectResult.status === 'succeeded' ? (architectResult.draft.profile ?? null) : null;
  const profile: ProfileId = resolveEmittedProfile({
    flag: options.profile,
    mode: projected.mode,
    repoDir: options.repoDir,
    specProfile: projected.profile,
    classified,
    detect: options.detect ?? detectProfile,
  });
  // Co-locate generated tests where the brownfield repo already keeps its own.
  // Detection picks the runner (profile); this picks the *path*, because a
  // profile's default test directory can fall outside the host runner's
  // (narrowed) include glob and so be unrunnable — the FE-871 "No test files
  // found" failure. Skipped when a toolchain is injected directly, for
  // greenfield, or when no repo dir is available; null = no existing tests to
  // learn from, so the profile default stands.
  let toolchain = options.toolchain ?? resolveToolchain(profile);
  if (options.toolchain === undefined && projected.mode === 'brownfield' && options.repoDir !== undefined) {
    const testDir = (options.detectTestDir ?? detectTestDir)(options.repoDir);
    if (testDir !== null) toolchain = withTestDir(toolchain, testDir);
  }

  if (architectResult.status === 'failed') {
    return fallback(projected, profile, toolchain, architectResult, architectResult.reason, spec);
  }

  const {
    plan: materialized,
    coverage,
    warnings: materializeWarnings,
  } = materializeArchitectedPlan({ ...projected, profile }, architectResult.draft, toolchain);
  const { plan: repaired, repairs } = repairPlan(materialized, toolchain);
  const check = checkPlan(repaired, {
    profile: 'emitted',
    requirementIds: coverage.requirementIds,
    coveredRequirementIds: coverage.coveredRequirementIds,
    nonBuildableRequirementIds: coverage.nonBuildableRequirementIds,
  });

  if (!check.ok) {
    return fallback(projected, profile, toolchain, architectResult, describeCheckFailure(check), spec);
  }

  // A degenerate architect draft — zero authored slices while the projected
  // requirement universe is non-empty — passes the contract (nothing to fault)
  // yet would ship an empty, cook-executable-looking `plan.yaml` that does no
  // work. This happens when the architect marks every requirement
  // non-buildable (coverage is then vacuously satisfied). Treat it as an
  // authoring failure and fall back to the deterministic projection, which
  // always yields slices for a non-empty universe.
  if (repaired.slices.length === 0 && projected.slices.length > 0) {
    return fallback(
      projected,
      profile,
      toolchain,
      architectResult,
      'authored plan has no buildable slices for a non-empty requirement universe',
      spec,
    );
  }

  // Surface design-class contract warnings (e.g. a file-write-conflict) so an
  // authored plan never ships an unresolved file-ownership clash silently.
  const warnings: EmitterWarning[] = [...materializeWarnings, ...repairs];
  for (const finding of check.findings) {
    if (finding.code === 'file-write-conflict') {
      warnings.push({
        code: 'file-write-conflict',
        severity: 'warning',
        path: finding.path,
        sliceIds: finding.sliceIds,
      });
    }
  }
  return { plan: spec ? { ...repaired, spec } : repaired, warnings, architectResult };
}

/**
 * Deterministic fallback: reconcile the projected plan against an empty
 * enrichment, then repair. No LLM call. Used when the architect throws,
 * returns malformed output, or produces a plan that fails the contract.
 */
function fallback(
  projected: Plan,
  profile: ProfileId,
  toolchain: Toolchain,
  architectResult: ArchitectResult,
  reason: string,
  spec: PlanSpec | undefined,
): EmitPlanResult {
  const { plan: candidate, warnings: reconciliationWarnings } = reconcilePlan(
    { ...projected, profile },
    EMPTY_ENRICHMENT,
    toolchain,
  );
  const { plan, repairs } = repairPlan(candidate, toolchain);
  const warnings: EmitterWarning[] = [
    { code: 'architect-failed-fallback-to-projection', reason },
    ...reconciliationWarnings,
    ...repairs,
  ];
  return { plan: spec ? { ...plan, spec } : plan, warnings, architectResult };
}

function describeCheckFailure(check: ContractResult): string {
  const errors = check.findings.filter((finding) => finding.severity === 'error');
  const codes = [...new Set(errors.map((finding) => finding.code))].join(', ');
  return `authored plan failed the executability contract: ${codes}`;
}

/**
 * Audit-weight classification for an `EmitterWarning`. Adds `'failure'`
 * for the architect fallback; delegates reconciliation/materializer codes.
 * Exhaustive — a new emitter-level warning forces an update here.
 */
export function emitterWarningCategory(warning: EmitterWarning): 'transformation' | 'synthesis' | 'failure' {
  if (warning.code === 'architect-failed-fallback-to-projection') return 'failure';
  if (warning.code === 'synthesized-integration-seam') return 'synthesis';
  if (
    warning.code === 'dropped-unknown-requirement-ref' ||
    warning.code === 'dropped-epic-dependency-nonexistent-id' ||
    warning.code === 'cycle-break-dropped-epic-edge' ||
    warning.code === 'file-write-conflict'
  ) {
    return 'transformation';
  }
  return reconciliationWarningCategory(warning);
}

/**
 * Render an `EmitterWarning` as one human-readable line. Delegates to
 * `formatReconciliationWarning` for reconciliation codes.
 */
export function formatEmitterWarning(warning: EmitterWarning): string {
  if (warning.code === 'architect-failed-fallback-to-projection') {
    return `architect-failed-fallback-to-projection  ${warning.reason}`;
  }
  if (warning.code === 'synthesized-integration-seam') {
    return `synthesized-integration-seam  ${warning.epicId} → ${warning.target}`;
  }
  if (warning.code === 'dropped-unknown-requirement-ref') {
    return `dropped-unknown-requirement-ref  ${warning.sliceId} → ${warning.requirementId}`;
  }
  if (warning.code === 'dropped-epic-dependency-nonexistent-id') {
    return `dropped-epic-dependency-nonexistent-id  ${warning.epicId} → ${warning.missingId}`;
  }
  if (warning.code === 'cycle-break-dropped-epic-edge') {
    return `cycle-break-dropped-epic-edge  ${warning.epicId} → ${warning.droppedDependsOn}`;
  }
  if (warning.code === 'file-write-conflict') {
    return `file-write-conflict  ${warning.path} ← ${warning.sliceIds.join(', ')}`;
  }
  return formatReconciliationWarning(warning);
}

/**
 * One-sentence plain-English account of an `EmitterWarning`, appended
 * after the terse code line in `--verbose` mode. Delegates reconciliation
 * codes to `explainReconciliationWarning`.
 */
export function explainEmitterWarning(warning: EmitterWarning): string {
  if (warning.code === 'architect-failed-fallback-to-projection') {
    return 'the architect step failed; the plan fell back to a deterministic projection';
  }
  if (warning.code === 'synthesized-integration-seam') {
    return 'the epic authored no integration test, so a default integration seam was synthesized';
  }
  if (warning.code === 'dropped-unknown-requirement-ref') {
    return 'the slice referenced a requirement id the spec does not contain; the ref was dropped';
  }
  if (warning.code === 'dropped-epic-dependency-nonexistent-id') {
    return 'the epic depended on an id no epic declares; the edge was dropped';
  }
  if (warning.code === 'cycle-break-dropped-epic-edge') {
    return 'the edge was dropped to break a dependency cycle between epics';
  }
  if (warning.code === 'file-write-conflict') {
    return 'more than one slice writes this file; review for a missing dependency or a split';
  }
  return explainReconciliationWarning(warning);
}

export type { MaterializeWarning };

// FE-885 slice 3: project a cook run's execution back onto the spec's intent
// graph as a durable, spec-keyed snapshot (`exec-progress.json`).
//
// `projectExecProgress` is a PURE function over plan provenance (`Plan.spec` +
// `Slice.derived_from`, both stamped in slice 1) and the terminal
// `OrchestratorResult`. It records, per REQUIREMENT, a lifecycle status and,
// per ACCEPTANCE CRITERION, structural coverage only — never an unverified
// per-criterion pass/fail (D161-K honesty: the architect synthesizes one
// toolchain-derived test target per slice, not one per criterion, so
// per-criterion evidence does not exist).
//
// `reports.jsonl` stays the append-only source log (D156-K); this artifact is a
// rebuildable projection of it, written by an atomic temp-then-rename so a
// concurrent reader never sees a torn file (I140-K). The `needs-review` status
// is wire-ready but inert until the semantic assessor lands (slice 4 / D173-K).

import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { OrchestratorResult, Plan, ReportLine, SemanticDisposition } from './types.js';

export const EXEC_PROGRESS_FILE = 'exec-progress.json';

const SEMANTIC_ASSESSED_EVENT = 'semantic-assessed';

/**
 * Requirement lifecycle status. `next` is a separate readiness facet (see
 * `ExecProgressRequirement.next`), not a status. `needs-review` is derived from
 * a `needs-human-review` semantic disposition (D173-K) — wire-ready but inert
 * in v1, since the assessor stub emits no disposition.
 */
export type RequirementStatus =
  | 'pending'
  | 'in-progress'
  | 'completed'
  | 'blocked'
  | 'needs-review'
  | 'not-executable';

export type ExecProgressRequirement = {
  item_id: string;
  content: string;
  status: RequirementStatus;
  /** Ready to start now: pending with every dependency already completed. */
  next: boolean;
  /** Contributing slice ids (provenance), for UI drill-down. */
  slices: string[];
};

export type ExecProgressCriterion = {
  item_id: string;
  content: string;
  verifies: string[];
  /** A verification target exists for the requirement(s) this criterion verifies. Structural only. */
  covered: boolean;
};

export type ExecProgress = {
  spec_id: string;
  run_id: string;
  run_status: OrchestratorResult['status'];
  reason?: OrchestratorResult['reason'];
  requirements: ExecProgressRequirement[];
  criteria: ExecProgressCriterion[];
};

type SliceDisposition = 'completed' | 'blocked' | 'pending';

/**
 * Project the terminal result onto the spec. Pure: no IO, no clock. Returns a
 * progress with empty requirement/criterion lists when the plan carries no
 * `spec` block (an authored/fixture run with no spec identity), so callers can
 * uniformly guard on a non-empty projection.
 */
export function projectExecProgress(input: {
  plan: Plan;
  result: OrchestratorResult;
  runId: string;
  /** Source log (D156-K). Only `semantic-assessed` disposition is read here. */
  reports?: ReportLine[];
}): ExecProgress {
  const { plan, result, runId } = input;
  const spec = plan.spec;
  const reviewSlices = slicesNeedingReview(input.reports ?? []);

  const sliceStatus = new Map(result.slices.map((s) => [s.sliceId, s.status]));
  const epicStatus = new Map(result.epics.map((e) => [e.epicId, e.status]));

  const epicDeps = new Map(plan.epics.map((e) => [e.id, e.depends_on ?? []]));
  const sliceById = new Map(plan.slices.map((s) => [s.id, s]));

  const epicBlocked = (epicId: string): boolean =>
    reachesHalt(epicId, epicDeps, (id) => epicStatus.get(id) === 'halted');

  const sliceDepsById = new Map(plan.slices.map((s) => [s.id, s.depends_on]));
  const sliceBlocked = (sliceId: string): boolean => {
    if (reachesHalt(sliceId, sliceDepsById, (id) => sliceStatus.get(id) === 'halted')) return true;
    const epicId = sliceById.get(sliceId)?.epic_id;
    return epicId !== undefined && epicBlocked(epicId);
  };

  const dispositionOf = (sliceId: string): SliceDisposition => {
    if (sliceBlocked(sliceId)) return 'blocked';
    if (sliceStatus.get(sliceId) === 'completed') return 'completed';
    return 'pending';
  };

  // A pending slice is "next" (ready) when every dependency has completed.
  const sliceIsNext = (sliceId: string): boolean => {
    if (dispositionOf(sliceId) !== 'pending') return false;
    return (sliceDepsById.get(sliceId) ?? []).every((dep) => dispositionOf(dep) === 'completed');
  };

  const contributingSlices = (requirementItemId: string): string[] =>
    plan.slices
      .filter((s) => s.id === requirementItemId || (s.derived_from?.includes(requirementItemId) ?? false))
      .map((s) => s.id);

  const requirements: ExecProgressRequirement[] = (spec?.requirements ?? []).map((requirement) => {
    const slices = contributingSlices(requirement.item_id);
    // A `needs-human-review` disposition on any contributing slice is the
    // human-attention signal (D173-K) — it outranks the structural lifecycle
    // status (the slice halted, so it would otherwise read `blocked`). Inert in
    // v1: the assessor stub emits no disposition, so this never fires.
    const needsReview = slices.some((s) => reviewSlices.has(s));
    const status: RequirementStatus = needsReview
      ? 'needs-review'
      : requirementStatus(slices.map(dispositionOf));
    const next = status === 'pending' && slices.some(sliceIsNext);
    return { item_id: requirement.item_id, content: requirement.content, status, next, slices };
  });

  const criteria: ExecProgressCriterion[] = (spec?.criteria ?? []).map((criterion) => ({
    item_id: criterion.item_id,
    content: criterion.content,
    verifies: criterion.verifies,
    covered: criterion.verifies.some((requirementItemId) => contributingSlices(requirementItemId).length > 0),
  }));

  return {
    spec_id: spec?.spec_id ?? '',
    run_id: runId,
    run_status: result.status,
    ...(result.reason !== undefined ? { reason: result.reason } : {}),
    requirements,
    criteria,
  };
}

/**
 * Aggregate a requirement's status from its contributing slices' dispositions.
 * No contributing slice → `not-executable` (a non-buildable / never-scheduled
 * requirement). `needs-review` is not derivable here (semantic, slice 4).
 */
function requirementStatus(dispositions: SliceDisposition[]): RequirementStatus {
  if (dispositions.length === 0) return 'not-executable';
  if (dispositions.includes('blocked')) return 'blocked';
  if (dispositions.every((d) => d === 'completed')) return 'completed';
  if (dispositions.includes('completed')) return 'in-progress';
  return 'pending';
}

/**
 * Slices whose latest `semantic-assessed` report carries a `needs-human-review`
 * disposition (D173-K) — last write per slice wins. Inert in v1 (the assessor
 * stub emits no disposition), so this returns an empty set in practice.
 */
function slicesNeedingReview(reports: ReportLine[]): Set<string> {
  const latest = new Map<string, SemanticDisposition | undefined>();
  for (const line of reports) {
    if (line.event !== SEMANTIC_ASSESSED_EVENT) continue;
    const disposition = line.payload['disposition'];
    latest.set(
      line.sliceId,
      disposition === 'needs-human-review' || disposition === 'rework' ? disposition : undefined,
    );
  }
  const out = new Set<string>();
  for (const [sliceId, disposition] of latest) {
    if (disposition === 'needs-human-review') out.add(sliceId);
  }
  return out;
}

/**
 * DFS over a dependency graph: does `start` reach a node satisfying `isHalted`
 * (itself or transitively via `depsById`)? Plans are acyclic after
 * materialization; a `seen` set guards against any residual cycle.
 */
function reachesHalt(
  start: string,
  depsById: ReadonlyMap<string, readonly string[]>,
  isHalted: (id: string) => boolean,
): boolean {
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    if (isHalted(id)) return true;
    for (const dep of depsById.get(id) ?? []) stack.push(dep);
  }
  return false;
}

/**
 * Atomically write `exec-progress.json` into `storeDir` (the spec-scoped run
 * store from slice 2). Temp-then-`rename` so a concurrent reader never sees a
 * torn file. Returns the written path.
 */
export function writeExecProgress(storeDir: string, progress: ExecProgress): string {
  mkdirSync(storeDir, { recursive: true });
  const path = join(storeDir, EXEC_PROGRESS_FILE);
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(progress, null, 2) + '\n');
  renameSync(tmp, path);
  return path;
}

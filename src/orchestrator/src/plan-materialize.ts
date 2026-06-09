// FE-829 slice 4B: deterministic materialization of an architect draft.
//
// Takes the projected requirement universe (for requirement ids + criteria)
// plus the LLM-authored `ArchitectDraft` and normalizes it into a
// cook-runnable `Plan` — preserving authored slice ids + `writes`, but
// deterministically cleaning the parts the model cannot be trusted to get
// right: unknown requirement refs, self/dangling deps, cycles, orphan epic
// membership, empty epics, and verification targets (synthesized from the
// toolchain, never authored — D160-K / A98).
//
// Pure: no I/O, no LLM, no randomness. Every drop/redirect/synthesis
// surfaces as a typed warning. Returns the plan plus a `coverage` sidecar
// (requirement provenance) so the emitter can gate the authored plan with
// `checkPlan`'s generalized coverage check and fall back when a requirement
// is left uncovered.

import type { ArchitectDraft } from './plan-architect.js';
import { breakDependencyCycles } from './plan-graph.js';
import type { ReconciliationWarning } from './plan-reconciliation.js';
import { defaultToolchain, type Toolchain } from './project-profile.js';
import type { Epic, Plan, Slice } from './types.js';

const DEFAULT_EPIC_ID = 'default';
const DEFAULT_EPIC_SUMMARY = 'All requirements';

/** Requirement-provenance inputs for `checkPlan`'s generalized coverage. */
export interface CoverageExpectations {
  requirementIds: string[];
  coveredRequirementIds: string[];
  nonBuildableRequirementIds: string[];
}

export type MaterializeWarning =
  | ReconciliationWarning
  | { code: 'dropped-unknown-requirement-ref'; sliceId: string; requirementId: string }
  | { code: 'dropped-epic-dependency-nonexistent-id'; epicId: string; missingId: string };

export function materializeArchitectedPlan(
  projected: Plan,
  draft: ArchitectDraft,
  toolchain: Toolchain = defaultToolchain,
): { plan: Plan; coverage: CoverageExpectations; warnings: MaterializeWarning[] } {
  const warnings: MaterializeWarning[] = [];

  const requirementIds = projected.slices.map((slice) => slice.id);
  const requirementIdSet = new Set(requirementIds);
  const criteriaByRequirementId = new Map<string, string[]>(
    projected.slices.map((slice) => [
      slice.id,
      slice.verification.filter((entry) => entry.kind === 'criterion').map((entry) => entry.target),
    ]),
  );

  const authoredSliceIds = new Set(draft.slices.map((slice) => slice.id));

  // 1. Filter each slice's requirement provenance to known requirement ids.
  const derivedFromBySliceId = new Map<string, string[]>();
  for (const slice of draft.slices) {
    const kept: string[] = [];
    for (const requirementId of slice.derivedFrom) {
      if (requirementIdSet.has(requirementId)) {
        kept.push(requirementId);
      } else {
        warnings.push({ code: 'dropped-unknown-requirement-ref', sliceId: slice.id, requirementId });
      }
    }
    derivedFromBySliceId.set(slice.id, kept);
  }

  // 2. Clean dependency edges (self / dangling), then break cycles via the
  //    shared Kahn policy so materialize and repair never drift.
  const cleanedDeps = new Map<string, string[]>();
  for (const slice of draft.slices) {
    const kept: string[] = [];
    let selfWarned = false;
    for (const dep of slice.depends_on) {
      if (dep === slice.id) {
        if (!selfWarned) {
          warnings.push({ code: 'dropped-self-loop', sliceId: slice.id });
          selfWarned = true;
        }
        continue;
      }
      if (!authoredSliceIds.has(dep)) {
        warnings.push({ code: 'dropped-dependency-nonexistent-id', sliceId: slice.id, missingId: dep });
        continue;
      }
      kept.push(dep);
    }
    cleanedDeps.set(slice.id, kept);
  }
  const { dependsOnById: acyclicDeps, droppedEdges } = breakDependencyCycles(authoredSliceIds, cleanedDeps);
  for (const edge of droppedEdges) {
    warnings.push({
      code: 'cycle-break-dropped-edge',
      sliceId: edge.sliceId,
      droppedDependsOn: edge.dependsOn,
    });
  }

  // 3. Resolve epic membership from `slice.epic_id` (single source). Slices
  //    pointing at an unknown epic land in a synthesized default epic.
  const validEpicIds = new Set(draft.epics.map((epic) => epic.id));
  const epicIdBySlice = new Map<string, string>();
  let hasOrphan = false;
  for (const slice of draft.slices) {
    if (validEpicIds.has(slice.epic_id)) {
      epicIdBySlice.set(slice.id, slice.epic_id);
    } else {
      epicIdBySlice.set(slice.id, DEFAULT_EPIC_ID);
      hasOrphan = true;
      warnings.push({ code: 'orphan-slice-assigned-to-default-epic', sliceId: slice.id });
    }
  }

  // 4. Build output slices (draft order): preserve writes, append criteria
  //    prose from provenance, synthesize the verification target.
  const outputSlices: Slice[] = draft.slices.map((slice) => {
    const target = toolchain.sliceTarget(slice.id);
    warnings.push({ code: 'synthesized-verification-target', sliceId: slice.id, target });
    const slice_: Slice = {
      id: slice.id,
      epic_id: epicIdBySlice.get(slice.id) ?? DEFAULT_EPIC_ID,
      definition: appendCriteria(
        slice.definition,
        derivedFromBySliceId.get(slice.id) ?? [],
        criteriaByRequirementId,
      ),
      depends_on: acyclicDeps.get(slice.id) ?? [],
      verification: [{ kind: 'unit-test', target }],
    };
    if (slice.writes.length > 0) slice_.writes = slice.writes;
    return slice_;
  });

  // 5. Build output epics: drop empty ones (warning), keep draft order,
  //    append the default epic only if orphans landed there.
  const sliceCountByEpic = new Map<string, number>();
  for (const epicId of epicIdBySlice.values()) {
    sliceCountByEpic.set(epicId, (sliceCountByEpic.get(epicId) ?? 0) + 1);
  }
  const survivingEpics = draft.epics.filter((epic) => (sliceCountByEpic.get(epic.id) ?? 0) > 0);
  const survivingEpicIds = new Set(survivingEpics.map((epic) => epic.id));

  // Preserve authored cross-epic gates (e.g. `cli` waiting on `core`),
  // cleaned with the same policy as slices: an edge onto an epic that is not
  // in the output (unknown id, or one dropped for being empty) is removed and
  // surfaced as a typed warning — never silently — so a mistyped or stale gate
  // is auditable rather than vanishing. Cycles are then broken via the shared
  // Kahn pass so emitted multi-epic plans keep upstream→downstream order
  // instead of running every epic concurrently.
  const cleanedEpicDeps = new Map<string, string[]>();
  for (const epic of survivingEpics) {
    const kept: string[] = [];
    for (const dep of epic.depends_on ?? []) {
      if (survivingEpicIds.has(dep)) {
        kept.push(dep);
      } else {
        warnings.push({ code: 'dropped-epic-dependency-nonexistent-id', epicId: epic.id, missingId: dep });
      }
    }
    cleanedEpicDeps.set(epic.id, kept);
  }
  const { dependsOnById: acyclicEpicDeps, droppedEdges: droppedEpicEdges } = breakDependencyCycles(
    survivingEpicIds,
    cleanedEpicDeps,
  );
  for (const edge of droppedEpicEdges) {
    warnings.push({
      code: 'cycle-break-dropped-edge',
      sliceId: edge.sliceId,
      droppedDependsOn: edge.dependsOn,
    });
  }

  const outputEpics: Epic[] = [];
  for (const epic of draft.epics) {
    if (!survivingEpicIds.has(epic.id)) {
      warnings.push({ code: 'dropped-empty-epic', epicId: epic.id, epicSummary: epic.summary });
      continue;
    }
    outputEpics.push({
      id: epic.id,
      summary: epic.summary,
      depends_on: acyclicEpicDeps.get(epic.id) ?? [],
      verification: [],
    });
  }
  if (hasOrphan && !outputEpics.some((epic) => epic.id === DEFAULT_EPIC_ID)) {
    outputEpics.push({
      id: DEFAULT_EPIC_ID,
      summary: DEFAULT_EPIC_SUMMARY,
      depends_on: [],
      verification: [],
    });
  }

  // 6. Coverage sidecar: requirement is covered iff it appears in some
  //    surviving slice's (filtered) provenance.
  const coveredRequirementIds = new Set<string>();
  for (const kept of derivedFromBySliceId.values()) {
    for (const requirementId of kept) coveredRequirementIds.add(requirementId);
  }
  const nonBuildableRequirementIds = draft.nonBuildableRequirementIds.filter((id) =>
    requirementIdSet.has(id),
  );

  return {
    plan: { mode: projected.mode, profile: projected.profile, epics: outputEpics, slices: outputSlices },
    coverage: {
      requirementIds,
      coveredRequirementIds: [...coveredRequirementIds],
      nonBuildableRequirementIds,
    },
    warnings,
  };
}

function appendCriteria(
  definition: string,
  requirementIds: readonly string[],
  criteriaByRequirementId: Map<string, string[]>,
): string {
  const texts: string[] = [];
  const seen = new Set<string>();
  for (const requirementId of requirementIds) {
    for (const text of criteriaByRequirementId.get(requirementId) ?? []) {
      if (seen.has(text)) continue;
      seen.add(text);
      texts.push(text);
    }
  }
  if (texts.length === 0) return definition;
  const bulletList = texts.map((text) => `- ${text}`).join('\n');
  return `${definition}\n\nVerifying criteria:\n${bulletList}`;
}

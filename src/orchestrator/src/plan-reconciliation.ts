// FE-800 slice 3: deterministic reconciliation.
//
// Takes slice 1's projected Plan plus slice 2's LLM PlanningEnrichment
// and produces a cook-runnable Plan + structured warnings. Pure — no
// I/O, no LLM, no randomness. Every transformation that drops,
// redirects, breaks, or synthesizes a value surfaces as a typed
// ReconciliationWarning so the reviewer can audit slice 2's output.

import { breakDependencyCycles } from './plan-graph.js';
import { defaultToolchain, type Toolchain } from './project-profile.js';
import type { Epic, Plan, Slice } from './types.js';

/**
 * The deterministic-fallback enrichment that `reconcilePlan` consumes: per-slice
 * dependency edges, epic grouping, and non-buildable slice ids over the slice-1
 * projected universe. Originally the output of the (now-retired) slice-3 LLM
 * planner; on today's mainline `plan-emitter` supplies an empty enrichment so
 * reconciliation runs as the pure projection fallback when authoring fails.
 */
export type PlanningEnrichment = {
  sliceDependencies: { sliceId: string; dependsOn: string[] }[];
  epics: { id: string; summary: string; sliceIds: string[] }[];
  nonBuildableSliceIds: string[];
};

export type ReconciliationWarning =
  | { code: 'synthesized-verification-target'; sliceId: string; target: string }
  | { code: 'dropped-dependency-nonexistent-id'; sliceId: string; missingId: string }
  | { code: 'dropped-self-loop'; sliceId: string }
  | { code: 'cycle-break-dropped-edge'; sliceId: string; droppedDependsOn: string }
  | { code: 'dropped-dependency-on-non-buildable'; sliceId: string; nonBuildableId: string }
  | { code: 'dropped-non-buildable-slice'; sliceId: string; definition: string }
  | { code: 'dropped-empty-epic'; epicId: string; epicSummary: string }
  | { code: 'orphan-slice-assigned-to-default-epic'; sliceId: string };

const DEFAULT_EPIC_ID = 'default';
const DEFAULT_EPIC_SUMMARY = 'All requirements';

export function reconcilePlan(
  projected: Plan,
  enrichment: PlanningEnrichment,
  toolchain: Toolchain = defaultToolchain,
): { plan: Plan; warnings: ReconciliationWarning[] } {
  const warnings: ReconciliationWarning[] = [];

  // 1. Partition projected slices into surviving vs non-buildable.
  const projectedSliceIds = new Set(projected.slices.map((slice) => slice.id));
  const nonBuildableIds = new Set(enrichment.nonBuildableSliceIds.filter((id) => projectedSliceIds.has(id)));
  const survivingSlices: Slice[] = [];
  for (const slice of projected.slices) {
    if (nonBuildableIds.has(slice.id)) {
      warnings.push({
        code: 'dropped-non-buildable-slice',
        sliceId: slice.id,
        definition: slice.definition,
      });
      continue;
    }
    survivingSlices.push(slice);
  }
  const survivingIds = new Set(survivingSlices.map((slice) => slice.id));

  // 2. Project the enrichment's per-slice depends_on through the survivor set.
  //    Filter self-loops, non-buildable targets, and nonexistent ids — each with a warning.
  const dependsOnBySliceId = new Map<string, string[]>();
  for (const id of survivingIds) dependsOnBySliceId.set(id, []);
  for (const entry of enrichment.sliceDependencies) {
    if (!survivingIds.has(entry.sliceId)) continue;
    const filtered: string[] = [];
    let selfLoopWarned = false;
    for (const dep of entry.dependsOn) {
      if (dep === entry.sliceId) {
        if (!selfLoopWarned) {
          warnings.push({ code: 'dropped-self-loop', sliceId: entry.sliceId });
          selfLoopWarned = true;
        }
        continue;
      }
      if (nonBuildableIds.has(dep)) {
        warnings.push({
          code: 'dropped-dependency-on-non-buildable',
          sliceId: entry.sliceId,
          nonBuildableId: dep,
        });
        continue;
      }
      if (!projectedSliceIds.has(dep)) {
        warnings.push({
          code: 'dropped-dependency-nonexistent-id',
          sliceId: entry.sliceId,
          missingId: dep,
        });
        continue;
      }
      filtered.push(dep);
    }
    dependsOnBySliceId.set(entry.sliceId, filtered);
  }

  // 3. Cycle-break via the shared Kahn policy (lex-smallest tie-break),
  //    so reconciliation and the FE-829 PlanContract repair never drift.
  const { dependsOnById: acyclicDeps, droppedEdges } = breakDependencyCycles(
    survivingIds,
    dependsOnBySliceId,
  );
  for (const edge of droppedEdges) {
    warnings.push({
      code: 'cycle-break-dropped-edge',
      sliceId: edge.sliceId,
      droppedDependsOn: edge.dependsOn,
    });
  }

  // 4. Resolve epic grouping. LLM-proposed epics with zero surviving slices
  //    are dropped (warning). Surviving slices not covered by any epic land
  //    in a synthesized default epic (warning per orphan).
  const epicAssignment = new Map<string, string>(); // sliceId -> epicId
  const epicOrder: string[] = [];
  const epicSummaryById = new Map<string, string>();
  for (const epic of enrichment.epics) {
    const includedSliceIds = epic.sliceIds.filter((id) => survivingIds.has(id) && !epicAssignment.has(id));
    if (includedSliceIds.length === 0) {
      warnings.push({
        code: 'dropped-empty-epic',
        epicId: epic.id,
        epicSummary: epic.summary,
      });
      continue;
    }
    epicOrder.push(epic.id);
    epicSummaryById.set(epic.id, epic.summary);
    for (const sid of includedSliceIds) epicAssignment.set(sid, epic.id);
  }
  const orphans: string[] = [];
  for (const slice of survivingSlices) {
    if (!epicAssignment.has(slice.id)) {
      orphans.push(slice.id);
      warnings.push({ code: 'orphan-slice-assigned-to-default-epic', sliceId: slice.id });
    }
  }
  if (orphans.length > 0) {
    if (!epicSummaryById.has(DEFAULT_EPIC_ID)) {
      epicOrder.push(DEFAULT_EPIC_ID);
      epicSummaryById.set(DEFAULT_EPIC_ID, DEFAULT_EPIC_SUMMARY);
    }
    for (const sid of orphans) epicAssignment.set(sid, DEFAULT_EPIC_ID);
  }

  // 5. Construct output slices in projected order with synthesized verification.
  const outputSlices: Slice[] = survivingSlices.map((slice) => {
    const target = toolchain.sliceTarget(slice.id);
    warnings.push({ code: 'synthesized-verification-target', sliceId: slice.id, target });
    return {
      id: slice.id,
      epic_id: epicAssignment.get(slice.id) ?? slice.epic_id,
      definition: enrichDefinitionWithCriteria(slice),
      depends_on: acyclicDeps.get(slice.id) ?? [],
      verification: [{ kind: 'unit-test', target }],
    };
  });

  // 6. Construct output epics. Fallback to default epic if nothing was built.
  let outputEpics: Epic[] = epicOrder.map((id) => ({
    id,
    summary: epicSummaryById.get(id) ?? DEFAULT_EPIC_SUMMARY,
    depends_on: [],
    verification: [],
  }));
  if (outputEpics.length === 0) {
    outputEpics = [
      {
        id: DEFAULT_EPIC_ID,
        summary: DEFAULT_EPIC_SUMMARY,
        depends_on: [],
        verification: [],
      },
    ];
  }

  return {
    plan: { mode: projected.mode, profile: projected.profile, epics: outputEpics, slices: outputSlices },
    warnings,
  };
}

/**
 * Classify a warning by audit weight so the CLI / display layer can
 * route `'transformation'` (something happened to the LLM output the
 * reviewer should see) versus `'synthesis'` (deterministic completion
 * that happens for every surviving slice and is predictable from the
 * slice id alone). Exhaustive switch — adding a new warning code is
 * a build break here.
 */
export function reconciliationWarningCategory(
  warning: ReconciliationWarning,
): 'transformation' | 'synthesis' {
  switch (warning.code) {
    case 'synthesized-verification-target':
      return 'synthesis';
    case 'dropped-dependency-nonexistent-id':
    case 'dropped-self-loop':
    case 'cycle-break-dropped-edge':
    case 'dropped-dependency-on-non-buildable':
    case 'dropped-non-buildable-slice':
    case 'dropped-empty-epic':
    case 'orphan-slice-assigned-to-default-epic':
      return 'transformation';
  }
}

/**
 * Render a warning as a single human-readable line. Co-located with
 * the warning union so a new code adds its formatter in the same diff
 * as its type definition.
 */
export function formatReconciliationWarning(warning: ReconciliationWarning): string {
  switch (warning.code) {
    case 'synthesized-verification-target':
      return `synthesized-verification-target  ${warning.sliceId} → ${warning.target}`;
    case 'dropped-dependency-nonexistent-id':
      return `dropped-dependency-nonexistent-id  ${warning.sliceId} → ${warning.missingId}`;
    case 'dropped-self-loop':
      return `dropped-self-loop  ${warning.sliceId}`;
    case 'cycle-break-dropped-edge':
      return `cycle-break-dropped-edge  ${warning.sliceId} → ${warning.droppedDependsOn}`;
    case 'dropped-dependency-on-non-buildable':
      return `dropped-dependency-on-non-buildable  ${warning.sliceId} → ${warning.nonBuildableId}`;
    case 'dropped-non-buildable-slice':
      return `dropped-non-buildable-slice  ${warning.sliceId}`;
    case 'dropped-empty-epic':
      return `dropped-empty-epic  ${warning.epicId} (${warning.epicSummary})`;
    case 'orphan-slice-assigned-to-default-epic':
      return `orphan-slice-assigned-to-default-epic  ${warning.sliceId}`;
  }
}

/**
 * One-sentence plain-English account of why a reconciliation warning
 * fired. Appended after the terse code line in `--verbose` mode so a
 * reviewer doesn't have to know the code vocabulary. Co-located with the
 * union so a new code adds its explanation in the same diff.
 */
export function explainReconciliationWarning(warning: ReconciliationWarning): string {
  switch (warning.code) {
    case 'synthesized-verification-target':
      return 'the slice authored no verification, so a default test target was synthesized from its id';
    case 'dropped-dependency-nonexistent-id':
      return 'the slice depended on an id no slice declares; the edge was dropped';
    case 'dropped-self-loop':
      return 'the slice depended on itself; the self-edge was dropped';
    case 'cycle-break-dropped-edge':
      return 'the edge was dropped to break a dependency cycle between slices';
    case 'dropped-dependency-on-non-buildable':
      return 'the slice depended on a non-buildable slice; the edge was dropped';
    case 'dropped-non-buildable-slice':
      return 'the slice had nothing buildable and was dropped from the plan';
    case 'dropped-empty-epic':
      return 'the epic had no surviving slices and was dropped';
    case 'orphan-slice-assigned-to-default-epic':
      return 'the slice referenced no valid epic and was reassigned to the default epic';
  }
}

function enrichDefinitionWithCriteria(slice: Slice): string {
  const criterionTexts = slice.verification
    .filter((entry) => entry.kind === 'criterion')
    .map((entry) => entry.target);
  if (criterionTexts.length === 0) return slice.definition;
  const bulletList = criterionTexts.map((text) => `- ${text}`).join('\n');
  return `${slice.definition}\n\nVerifying criteria:\n${bulletList}`;
}

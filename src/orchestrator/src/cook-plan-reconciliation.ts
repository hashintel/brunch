// FE-800 slice 3: deterministic reconciliation.
//
// Takes slice 1's projected Plan plus slice 2's LLM PlanningEnrichment
// and produces a cook-runnable Plan + structured warnings. Pure — no
// I/O, no LLM, no randomness. Every transformation that drops,
// redirects, breaks, or synthesizes a value surfaces as a typed
// ReconciliationWarning so the reviewer can audit slice 2's output.

import type { PlanningEnrichment } from './cook-plan-llm-planning.js';
import type { Epic, Plan, Slice } from './types.js';

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

export function reconcileCookPlan(
  projected: Plan,
  enrichment: PlanningEnrichment,
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

  // 3. Cycle-break via Kahn's algorithm with lex-smallest tie-break.
  //    When no in-degree-zero node remains, drop all "remaining" incoming
  //    deps of the lex-smallest remaining sliceId (warning per edge).
  const remaining = new Set(survivingIds);
  while (remaining.size > 0) {
    const ready: string[] = [];
    for (const id of remaining) {
      const deps = dependsOnBySliceId.get(id) ?? [];
      if (deps.every((dep) => !remaining.has(dep))) ready.push(id);
    }
    if (ready.length > 0) {
      for (const id of ready) remaining.delete(id);
      continue;
    }
    const sorted = [...remaining].sort();
    const target = sorted[0]!;
    const deps = dependsOnBySliceId.get(target) ?? [];
    const kept: string[] = [];
    for (const dep of deps) {
      if (remaining.has(dep)) {
        warnings.push({
          code: 'cycle-break-dropped-edge',
          sliceId: target,
          droppedDependsOn: dep,
        });
      } else {
        kept.push(dep);
      }
    }
    dependsOnBySliceId.set(target, kept);
    // Loop continues; `target` now has zero remaining-in-degree.
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
    const target = `tests/${slice.id}.test.ts`;
    warnings.push({ code: 'synthesized-verification-target', sliceId: slice.id, target });
    return {
      id: slice.id,
      epic_id: epicAssignment.get(slice.id) ?? slice.epic_id,
      definition: enrichDefinitionWithCriteria(slice),
      depends_on: dependsOnBySliceId.get(slice.id) ?? [],
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

  return { plan: { epics: outputEpics, slices: outputSlices }, warnings };
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

function enrichDefinitionWithCriteria(slice: Slice): string {
  const criterionTexts = slice.verification
    .filter((entry) => entry.kind === 'criterion')
    .map((entry) => entry.target);
  if (criterionTexts.length === 0) return slice.definition;
  const bulletList = criterionTexts.map((text) => `- ${text}`).join('\n');
  return `${slice.definition}\n\nVerifying criteria:\n${bulletList}`;
}

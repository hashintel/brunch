# Cards

Frontier item: `memory/PLAN.md` Active #1 — **Canonical terminology and record-identity normalization**

Status legend: `next`, `in progress`, `done`, `dropped`

## Orientation
- Containing seam: client/shared naming ownership above the stable `/project/$id` routes, `/api/projects` endpoints, and existing DB record/table names.
- Frontier item focus: continue retiring app-owned `project` terminology now that the descriptor/specification seam and workspace transcript split have landed.
- Volatile state: `memory/REFACTOR.md` is exhausted and retired; this queue replaces it for the next bounded execution steps inside the same frontier item.
- Main open risk: avoid drifting into physical transport/storage renames before the remaining app-owned terminology cleanup is complete and re-evaluated.

---

## Card 1 — Specification aliases become the default client-facing type seam `[status: done]`

### Objective
Client-facing workspace code, mutations, and tests consume `Specification*` aliases instead of `Project*` app-facing types wherever the legacy project naming is not required by the wire or storage seam.

### Acceptance Criteria
- ✓ Client-owned modules stop importing `ProjectMode`, `ProjectState`, `ProjectStateTurn`, or `ProjectListItem` when an equivalent `Specification*` alias already exists.
- ✓ Focused client/shared tests still pass with no route-path, API-endpoint, or DB-field changes.

### Verification Approach
- Inner: `npm run fix`
- Middle: focused client/shared tests around list, workspace controller/view, and mutation seams
- Outer: none

### Promotion check
Stays light: no requirement, assumption, decision, invariant, route, or persistence change is expected.

---

## Card 2 — Specification/workspace helper names replace remaining client runtime `project` terminology `[status: next]`

### Objective
Rename client-owned helper and module symbols to specification/workspace vocabulary where the current `project` wording is only compatibility cruft, while preserving `/project/$id`, `/api/projects`, and DB identifiers.

### Acceptance Criteria
- ✓ Client runtime helper/module names no longer use `project` for specification-scoped concepts such as list/mutation/hydration/view-model seams when those names are not wire-owned.
- ✓ Focused router/workspace tests still pass, and route paths plus endpoint paths remain unchanged.

### Verification Approach
- Inner: `npm run fix`
- Middle: focused router, list, hydration, and workspace controller tests
- Outer: none

### Promotion check
Stays light: terminology-only refactor inside already-settled seams.

---

## Not yet queued
The remaining higher-risk physical identity work — especially any transport/schema-level `project` → `specification` rename or any persisted `scope` → `grounding` migration — should be re-scoped after these two bounded cleanup cards land, because its exact shape may still change based on what legacy app-owned terminology remains.

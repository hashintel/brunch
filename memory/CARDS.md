# Cards — Canonical terminology and record-identity normalization

## Orientation
- **Containing seam:** naming/ownership realignment across server persistence, shared workflow helpers, and the client workspace shell.
- **Frontier item:** `Canonical terminology and record-identity normalization` in `memory/PLAN.md` remains the single branch-sized work item; these cards are execution slices inside it.
- **Volatile state:** no `HANDOFF.md` is present, so there is no extra carry-over state constraining the next slice.
- **Main open risk:** broad rename churn could accidentally couple low-risk terminology cleanup to higher-risk transport/persistence migration, so this queue stops before cards whose shape is likely to change based on earlier implementation findings.

## Queue rationale
These next slices are sequentially obvious and can be verified independently without changing requirements, assumptions, decisions, or invariants. The queue deliberately stops before the physical `project` table/API rename and the persisted `scope` → `grounding` phase-key migration, because those later moves may change shape once the lower-risk cleanup lands.

---

## Card 1 — Remove persisted workspace path from specification records `[status: done]`

### Target Behavior
Brownfield and greenfield specifications continue to work after the specification record stops persisting `cwd` and workspace path is derived only from runtime context.

### Boundary Crossings
```text
→ server app creation and phase-intent entry (`src/server/app.ts`, `src/server/phase-intent-runtime.ts`)
→ persistence schema and data access (`src/server/schema.ts`, `src/server/db.ts`, drizzle migrations)
→ observer/context consumers of workspace path (`src/server/observer.ts` and related context builders)
→ shared payload validation plus seeded/runtime tests (`src/shared/api-types.ts`, server/client tests)
```

### Risks and Assumptions
- RISK: brownfield kickoff or observer prompts may still depend on `project.cwd` being hydrated from the DB → MITIGATION: thread runtime `projectCwd` through the runtime-owned seams that actually need workspace context and remove DB reads only after those callers are covered.
- ASSUMPTION: one running Brunch workspace owns exactly one runtime workspace path, so persisting `cwd` per specification is redundant → VALIDATE: greenfield and brownfield seeded flows still work after reload and observer context still includes the runtime workspace path where needed → `memory/SPEC.md` Decision D81 / D113.

### Acceptance Criteria
- ✓ Specification list/state payloads no longer expose a persisted `cwd` field.
- ✓ Brownfield grounding strategy selection and downstream observer/context flows still work using runtime workspace context.
- ✓ Existing seeded scenarios and tests stop seeding or asserting specification-level `cwd` persistence.

### Verification Approach
- Inner: targeted schema/db/api/app/observer tests plus `npm run fix` — proves `cwd` is removed from persistence and payload contracts without breaking local compilation.
- Middle: `npm run verify` — proves migrations, app routes, and seeded brownfield flows still pass end-to-end.
- Outer: manual brownfield kickoff walkthrough — proves the runtime-derived workspace path still supports visible grounding behavior.

---

## Card 2 — Rename client-owned project wording to specification without transport changes `[status: next]`

### Target Behavior
The client-owned workspace shell, list, and local module naming refer to a specification rather than a project while current server transport paths and DB identifiers remain unchanged.

### Boundary Crossings
```text
→ client route shell and list modules (`src/client/routes/-project-list.tsx`, related tests/stories)
→ client mutation and local naming seams (`src/client/mutations/project-mutations.ts`, consumer imports)
→ workspace-facing component props and local variable names in route/layout files
→ client tests that still assert `project` terminology at the UI/module boundary
```

### Risks and Assumptions
- RISK: a sweeping rename could accidentally drag in route-path or API-contract changes and make the slice too large → MITIGATION: keep this card strictly to client-owned copy, symbols, component/module names, and local props; do not change `/api/projects` or the persisted schema here.
- ASSUMPTION: local client naming cleanup is valuable before public transport/type renames because adapters can temporarily absorb the mismatch → VALIDATE: the UI, imports, and tests read clearly as specification-owned while the network contract stays behaviorally identical.

### Acceptance Criteria
- ✓ Client-facing copy, component/module names, and local variables stop using `project` where the product concept is clearly a specification.
- ✓ No API path, DB table, or shared wire-schema rename is required to land this slice.
- ✓ Existing navigation and creation flows behave the same after the terminology cleanup.

### Verification Approach
- Inner: focused client route/mutation/component tests plus `npm run fix`.
- Middle: `npm run verify` — proves route generation, typecheck, and tests still pass after the client-owned rename.
- Outer: manual smoke through create → open specification → navigate workspace.

---

## Card 3 — Introduce canonical grounding vocabulary at the helper seam without changing persisted phase keys `[status: next after card 2]`

### Target Behavior
Shared and client workflow helpers expose `grounding` as the canonical first-phase vocabulary while persisted workflow keys remain `scope` for now.

### Boundary Crossings
```text
→ shared phase helper modules (`src/shared/phase-routes.ts`, `src/shared/phase-display.ts`, related shared types)
→ client route/sidebar/interview consumers of phase labels and route metadata
→ tests that currently treat `scope` as the only authoritative helper-level name
```

### Risks and Assumptions
- RISK: helper-level vocabulary changes could accidentally leak into persistence or break workflow lookups keyed by `scope` → MITIGATION: keep serialized workflow keys, DB enums, and server-phase logic unchanged; introduce canonical helper exports/adapters only at the shared/client seam.
- ASSUMPTION: making `grounding` the helper-level term first will reduce later rename churn before the physical phase-key migration → VALIDATE: client/shared callers can read and render the first phase canonically without changing server payload semantics.

### Acceptance Criteria
- ✓ Shared/client helper APIs and labels present `grounding` as the canonical first-phase vocabulary.
- ✓ Persisted workflow payloads, DB enums, and server logic still operate with the current `scope` key after this slice.
- ✓ Route/sidebar/interview consumers compile and behave correctly using the updated helper seam.

### Verification Approach
- Inner: focused shared/client helper tests plus `npm run fix`.
- Middle: `npm run verify` — proves helper consumers and route logic still pass with the adapter seam in place.
- Outer: manual navigation across grounding and later phases to confirm labels/routes still read coherently.

---

## Not yet queued

These belong to the same frontier item, but are **not** pre-scoped yet because their exact shape may change after the cards above land:

- physical `project` → `specification` rename across DB tables, shared public transport types, and server read models
- physical persisted phase-key migration from `scope` → `grounding`
- any route-path rename that would change generated file-route ownership rather than only local/client terminology

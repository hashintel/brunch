<!-- CARDS.md — temporary execution queue for one active frontier item.
     Created by ln-scope. Delete or overwrite when exhausted or superseded. -->

# Cards

Frontier item: **Active 1 — Canonical terminology and record-identity normalization**

## Orientation
- Containing seam: durable naming/identity across workflow phase keys, shared transport types, DB schema, server persistence, and routed entry seams.
- Relevant frontier item: `memory/PLAN.md` Active 1 now explicitly calls for physical `project` → `specification` migration, physical `scope` → `grounding` migration, and deletion of alias/adaptation seams.
- Volatile state: `memory/REFACTOR.md` has been retired; this queue is now the live execution aid for the naming frontier.
- Main open risk: all three cards touch shared/server ownership files, so the implementation may break hard between cards; destructive reseed and fixture regeneration are intentional, but verification must keep the app truthful after each cut.

## Queue discipline note
This queue is valid because the user explicitly wants a break-and-fix cutover with **no migration or legacy-adaptation work**. The three cards are sequentially obvious enough to pre-scope: phase-key rename first, durable record rename second, alias/adaptation deletion third.

---

## Card 1 — Rename the first workflow phase from `scope` to `grounding`
**Status:** done  
**Weight:** full

### Target Behavior
The canonical first workflow phase key is `grounding` across persistence, shared contracts, runtime logic, fixtures, and tests, with `scope` removed from the happy path.

### Boundary Crossings
```text
→ shared phase contracts (`src/shared/phase-close.ts`, `src/shared/phase-descriptors.ts`, `src/shared/api-types.ts`, `src/shared/knowledge.ts`)
→ server persistence/runtime (`src/server/schema.ts`, `src/server/db.ts`, `src/server/interview.ts`, `src/server/phase-intent-runtime.ts`)
→ client workflow consumers / control cards / route helpers
→ fixtures, seeds, README/manual-testing references
```

### Risks and Assumptions
```text
- RISK: Identifier rename catches ordinary-English "scope" prose that should stay semantic rather than becoming a phase key rename. → MITIGATION: constrain the mechanical cut to enum/contract/runtime/test references first; review prose separately.
- RISK: Renaming the persisted phase key breaks reload/resume/export until all readers are updated. → MITIGATION: make the cut in one pass and immediately reseed fixtures before verification.
- ASSUMPTION: Destructive reseed is acceptable and cheaper than compatibility handling for local unstable data. → VALIDATE: remove stale local data/fixtures as needed and verify against freshly seeded scenarios. → memory/SPEC.md D111
```

### Acceptance Criteria
```text
✓ Shared phase enums/contracts use `grounding` as the first workflow key
✓ Server persistence/runtime no longer emits or expects `scope` on the happy path
✓ Freshly seeded kickoff, resume, close, and export flows succeed after reload
✓ Remaining `scope` references are non-phase prose or intentionally deferred follow-on copy
```

### Verification Approach
```text
- Inner: `npm run fix` — proves the cross-layer contract rename is syntactically and stylistically coherent
- Middle: `npm run verify` — proves runtime/schema/test seams still agree after the phase-key cut
- Outer: manual seeded walkthrough of a grounding kickoff/resume/export path — proves the renamed phase behaves truthfully in the app
```

---

## Card 2 — Make `specification` the only durable record identity
**Status:** next  
**Weight:** full

### Target Behavior
The canonical durable record identity is `specification` across schema, DB helpers, shared API contracts, server routes, and tests, with `project` removed from the happy path.

### Boundary Crossings
```text
→ DB schema + migrations (`src/server/schema.ts`, `drizzle/*`)
→ DB/server ownership (`src/server/db.ts`, `src/server/app.ts`, `src/server/project.ts` or successor seam)
→ shared transport contracts (`src/shared/api-types.ts`, `src/shared/specification.ts` or successor seam)
→ client loaders/mutations consuming specification-shaped payloads
→ fixtures/tests/docs naming the durable record
```

### Risks and Assumptions
```text
- RISK: The record-identity cut leaves mixed ownership where `specification` is surface vocabulary but `project` still owns the real contract. → MITIGATION: rename the source-of-truth schema/types first, then update dependents until `project` disappears from the happy path.
- RISK: Existing migration files/snapshots become misleading during a destructive cutover. → MITIGATION: prefer a clean regenerated schema/migration story over preserving old naming history for unstable local data.
- ASSUMPTION: Fresh reseed and regenerated fixtures are the desired recovery path if local state breaks during the cut. → VALIDATE: after the rename, seed scenarios from scratch and confirm canonical specification routes/loaders work. → memory/SPEC.md D111
```

### Acceptance Criteria
```text
✓ Primary schema / DB / shared-contract seams use `specification` / `specification_id` as canonical identity
✓ `/api/specifications/...` returns canonical specification-shaped payloads without project-first ownership
✓ Freshly seeded resume/export flows work after the durable rename
✓ Remaining `project` references are either unrelated English prose or clearly queued for Card 3 deletion
```

### Verification Approach
```text
- Inner: `npm run fix` — proves the identity rename remains internally consistent as files churn
- Middle: `npm run verify` — proves the schema/API/runtime stack still agrees after the durable record cut
- Outer: manual seeded in-progress and completed specification walkthroughs — proves resume/export still work under the renamed identity
```

---

## Card 3 — Delete project/specification aliases, wrappers, and legacy entry paths
**Status:** next  
**Weight:** full

### Target Behavior
No project/specification aliasing or adaptation layer remains in routes, API entry points, shared wrappers, or tests; the app exposes only canonical specification seams.

### Boundary Crossings
```text
→ routed entry seams (`src/client/routes/project/...`, `src/client/routes/specification/...`)
→ API entry seams (`/api/projects/...` aliases and specification handlers)
→ shared wrapper/adaptation modules (`src/shared/specification.ts` and any project-named compatibility seams)
→ tests/fixtures/docs still asserting alias behavior
```

### Risks and Assumptions
```text
- RISK: Removing aliases strands imports/routes that still rely on project-named files. → MITIGATION: treat broken imports as intentional fallout and repair all callers to canonical specification seams before final verification.
- RISK: Some project-named modules still hide real behavior instead of pure compatibility. → MITIGATION: either rename them canonically or inline/replace them; do not keep wrappers just to reduce diff size.
- ASSUMPTION: No external consumer requires `/project/...` or `/api/projects/...` compatibility. → VALIDATE: the frontier explicitly chooses break-and-fix with no legacy-adaptation needs; verification focuses only on canonical specification seams. → memory/PLAN.md Active 1
```

### Acceptance Criteria
```text
✓ `/project/...` routes and `/api/projects/...` handlers/redirects are removed
✓ Canonical specification routes/modules no longer import project-named implementations as their normal behavior
✓ Shared project/specification adapter layers are deleted or collapsed into canonical specification-owned modules
✓ Tests/fixtures/docs assert only canonical specification seams
```

### Verification Approach
```text
- Inner: `npm run fix` — proves alias deletion leaves a coherent import graph
- Middle: `npm run verify` — proves only canonical seams remain and the app still builds/tests cleanly
- Outer: manual canonical deep-link/reload/export walkthrough — proves users can complete the core flow without any alias path surviving
```

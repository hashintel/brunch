# Scope Cards — server-mini-library-compartmentalization / db.ts extraction

Containing frontier: `server-mini-library-compartmentalization`.

Execution posture: keep `src/server/db.ts` as the public persistence root while moving cohesive implementation regions into private `src/server/db/*-store.ts` modules. Preserve existing `./db.js` caller imports unless a later card explicitly scopes API redesign.

## Card 1 — Reconciliation store extraction

Status: done / uncommitted

### Target Behavior

`db.ts` remains the public persistence import surface while reconciliation-need persistence implementation lives in a private `src/server/db/reconciliation-store.ts` module.

### Boundary Crossings

```txt
→ existing callers importing reconciliation helpers from ./db.js
→ public persistence root src/server/db.ts
→ private persistence implementation src/server/db/reconciliation-store.ts
→ Drizzle schema / SQLite rows
```

### Risks and Assumptions

- RISK: import cycles emerge between `db.ts`, `schema.ts`, and the private store → MITIGATION: private store imports only `schema`, Drizzle helpers, and type-only public DB where needed.
- ASSUMPTION: reconciliation helpers are cohesive enough to extract first → VALIDATE: reconciliation tests pass with unchanged caller imports.

### Acceptance Criteria

```txt
✓ Reconciliation helpers/types are implemented outside db.ts and re-exported through db.ts.
✓ Existing callers continue importing reconciliation helpers/types from ./db.js.
✓ Reconciliation-related regression tests pass.
```

### Verification Approach

- Inner: focused persistence/agent tests — `npm run test -- db reconciliation-need reconciliation-agent`.
- Gate: `npm run verify` when unrelated suite failures are resolved or acknowledged.

## Card 2 — Annotation store extraction

Status: done

### Target Behavior

`db.ts` remains the public persistence import surface while annotation persistence implementation lives in a private `src/server/db/annotation-store.ts` module.

### Boundary Crossings

```txt
→ annotation routes and tests importing annotation helpers from ./db.js
→ public persistence root src/server/db.ts
→ private persistence implementation src/server/db/annotation-store.ts
→ Drizzle schema / SQLite rows
```

### Risks and Assumptions

- RISK: the annotation region is too small to pay for a subtree module → MITIGATION: keep the extraction mechanically simple and use it as the low-risk proof that small cohesive stores can live behind the facade.
- ASSUMPTION: annotation CRUD is independent of other db.ts private helpers → VALIDATE: private module imports only schema/Drizzle helpers plus `DB` type.

### Acceptance Criteria

```txt
✓ `createAnnotation`, `getAnnotationsForSpecification`, `getAnnotation`, and `deleteAnnotation` are implemented outside db.ts.
✓ Existing callers continue importing annotation helpers/types from ./db.js.
✓ Annotation route tests and db tests pass without behavior changes.
```

### Verification Approach

- Inner: focused route/store tests — `npm run test -- annotation db`.
- Gate: `npm run check`; full `npm run verify` when unrelated suite failures are resolved or acknowledged.

## Card 3 — Edit-impact query extraction

Status: done

### Target Behavior

`db.ts` remains the public persistence import surface while downstream edit-impact query implementation lives in a private `src/server/db/edit-impact-store.ts` module.

### Boundary Crossings

```txt
→ edit route / side-chat route importing edit-impact query helpers from ./db.js
→ public persistence root src/server/db.ts
→ private persistence implementation src/server/db/edit-impact-store.ts
→ knowledge_edge / knowledge_item / phase_outcome rows
```

### Risks and Assumptions

- RISK: this store overlaps conceptually with the broader intent graph store → MITIGATION: extract only downstream impact queries first because they form a cohesive read-side seam used by edit-impact classification.
- ASSUMPTION: preserving current helper names avoids route churn → VALIDATE: `edit-route.ts` and `side-chat-route.ts` imports stay unchanged.

### Acceptance Criteria

```txt
✓ `getDownstreamItems`, `getDownstreamEdges`, and `isItemInActiveReviewSet` are implemented outside db.ts and re-exported through db.ts.
✓ Edit-impact callers continue importing from ./db.js.
✓ Focused edit-impact/edit-route/side-chat tests pass or only fail for known unrelated authorization flakes.
```

### Verification Approach

- Inner: focused tests — `npm run test -- edit-impact side-chat-route edit-route`.
- Gate: `npm run check`; full `npm run verify` when unrelated suite failures are resolved or acknowledged.

## Card 4 — Intent graph mutation store extraction

Status: done

### Target Behavior

`db.ts` remains the public persistence import surface while generic intent/knowledge item and edge mutation helpers live in a private `src/server/db/intent-graph-store.ts` module.

### Boundary Crossings

```txt
→ observer/edit/core tests and routes importing intent graph helpers from ./db.js
→ public persistence root src/server/db.ts
→ private persistence implementation src/server/db/intent-graph-store.ts
→ knowledge_item / turn_knowledge_item / knowledge_edge rows
```

### Risks and Assumptions

- RISK: compatibility projection helpers (`createDecision`, `createAssumption`, parent helpers) obscure the canonical intent graph model → MITIGATION: move them as legacy-named facade exports over generic store internals without expanding compatibility language.
- RISK: this extraction may need shared reference-code/projection helpers from later read-model code → MITIGATION: keep mutation helpers separate from entity projection helpers; stop if extraction forces projection redesign.
- ASSUMPTION: mutation helpers form a real store seam independent of accepted review materialization → VALIDATE: observer/edit tests pass with unchanged public imports.

### Acceptance Criteria

```txt
✓ `createKnowledgeItem`, `getKnowledgeItem`, `linkKnowledgeItemToTurn`, `addKnowledgeRelationship`, `removeKnowledgeRelationship`, `updateKnowledgeItemContent`, and legacy decision/assumption helper exports are implemented outside db.ts.
✓ Existing callers continue importing from ./db.js.
✓ Observer/edit/db tests covering item and edge writes pass.
```

### Verification Approach

- Inner: focused tests — `npm run test -- observer edit-route db`.
- Gate: `npm run check`; full `npm run verify` when unrelated suite failures are resolved or acknowledged.

## Card 5 — Review materialization store extraction

Status: done

### Target Behavior

`db.ts` remains the public persistence import surface while accepted requirements/criteria review materialization lives in a private `src/server/db/review-materialization-store.ts` module.

### Boundary Crossings

```txt
→ app/export/context/observer callers importing entity projection helpers from ./db.js
→ public persistence root src/server/db.ts
→ private persistence implementation src/server/db/entity-projection-store.ts
→ knowledge tables + active-path turn lineage rows
→ shared API entity projection types
```

### Risks and Assumptions

- RISK: active-path filtering and accepted-review visibility depend on workflow/turn helpers currently local to db.ts → MITIGATION: implement read-side SQL locally in the projection store for now; do not route through db.ts and create a cycle.
- RISK: product lexicon says intent graph, while implementation still says knowledge → MITIGATION: prefer intent/entity naming for new private helpers where possible, while preserving public compatibility exports.
- ASSUMPTION: read-model projection is separable from mutation helpers after Card 4 → VALIDATE: no circular import between intent graph mutation store and projection store.

### Acceptance Criteria

```txt
✓ `getEntitiesForSpecificationByMode`, `getEntitiesForSpecification`, `getEntitiesForSpecificationOnActivePath`, `getCapturedItemsForTurns`, accepted entity read helpers, and supporting projection helpers are implemented outside db.ts.
✓ App/export/context/observer callers continue importing from ./db.js.
✓ Entity projection, observer, export, context, and db tests pass.
```

### Verification Approach

- Inner: focused tests — `npm run test -- db observer context export app`.
- Gate: `npm run check`; full `npm run verify` when unrelated suite failures are resolved or acknowledged.

## Card 6 — Entity projection read-model extraction

Status: done

### Target Behavior

`db.ts` remains the public persistence import surface while accepted requirements/criteria review materialization lives in a private `src/server/db/review-materialization-store.ts` module.

### Boundary Crossings

```txt
→ interview/core/db tests importing review materialization helpers from ./db.js
→ public persistence root src/server/db.ts
→ private persistence implementation src/server/db/review-materialization-store.ts
→ review-set assistant parts parsing
→ knowledge_item / turn_knowledge_item / knowledge_edge rows
```

### Risks and Assumptions

- RISK: review materialization shares helper concepts with entity projection → MITIGATION: extract materialization first as a write-side seam; allow small local reference-code lookup duplication until the read model is extracted.
- ASSUMPTION: accepted review materialization is a cohesive write-side seam distinct from generic intent graph mutation → VALIDATE: requirements/criteria review tests pass unchanged.

### Acceptance Criteria

```txt
✓ `materializeAcceptedRequirementsReviewSet`, `materializeAcceptedCriteriaReviewSet`, and their private accepted-review helpers are implemented outside db.ts.
✓ Existing callers continue importing materialization helpers from ./db.js.
✓ Requirements/criteria review persistence tests pass.
```

### Verification Approach

- Inner: focused tests — `npm run test -- db interview app`.
- Gate: `npm run check`; full `npm run verify` when unrelated suite failures are resolved or acknowledged.

## Card 7 — Workflow and phase outcome store extraction

Status: next

### Target Behavior

`db.ts` remains the public persistence import surface while phase outcome and workflow projection snapshot persistence lives in private `src/server/db/workflow-store.ts` and/or `src/server/db/phase-outcome-store.ts` modules.

### Boundary Crossings

```txt
→ core/chat transition/phase intent callers importing workflow helpers from ./db.js
→ public persistence root src/server/db.ts
→ private workflow persistence implementation
→ turn / option / phase_outcome / knowledge rows
→ workflow-projector read model
```

### Risks and Assumptions

- RISK: this is the highest-coupling extraction because workflow snapshots read turns, outcomes, accepted knowledge counts, and structural artifact ids → MITIGATION: do it late, after entity/review extractions clarify which helpers should be imported vs passed in.
- RISK: moving this may accidentally alter I110 workflow read/write truth boundaries → MITIGATION: no behavior changes; preserve existing workflow projector interface and run transition/projector tests.
- ASSUMPTION: phase outcome CRUD and workflow snapshot reads can share one private module without becoming too broad → VALIDATE: module exports remain cohesive and smaller than the original db.ts region.

### Acceptance Criteria

```txt
✓ Phase outcome helpers and workflow snapshot/current-phase helpers are implemented outside db.ts and re-exported through db.ts.
✓ Workflow transition callers continue importing from ./db.js.
✓ Workflow projector, phase close, chat transition, app, and db tests pass.
```

### Verification Approach

- Inner: focused tests — `npm run test -- workflow-projector phase-close chat-route-transition phase-intent app db`.
- Middle: route/workflow regression — ensure active path, closeability, and structural artifact projections still match fixtures.
- Gate: `npm run check`; full `npm run verify` when unrelated suite failures are resolved or acknowledged.

## Card 8 — Specification/chat/turn store extraction

Status: queued

### Target Behavior

`db.ts` remains the public persistence import surface while specification, chat, turn, option, and active-head persistence lives in private `src/server/db/specification-store.ts` and `src/server/db/chat-turn-store.ts` modules.

### Boundary Crossings

```txt
→ nearly all server callers importing specification/turn helpers from ./db.js
→ public persistence root src/server/db.ts
→ private specification/chat-turn persistence modules
→ specification / chat / turn / option rows
```

### Risks and Assumptions

- RISK: this is the broadest and most central extraction, so earlier cards may reveal a better split → MITIGATION: run this last and revise before building if prior extractions expose a different boundary.
- RISK: primary-chat active-head equivalence and multi-chat transitional invariants could regress → MITIGATION: run chat-substrate, core, app, and transition tests.
- ASSUMPTION: preserving public exports avoids broad caller churn while still clarifying ownership → VALIDATE: no non-test caller import paths change.

### Acceptance Criteria

```txt
✓ Specification creation/list/read, chat ownership, turn CRUD, option CRUD, active path, and active-head helpers are implemented outside db.ts and re-exported through db.ts.
✓ Existing callers continue importing from ./db.js.
✓ Core/chat-substrate/transition/app/db tests pass.
✓ `db.ts` is reduced to connection setup, type facade exports, and curated re-exports from private stores.
```

### Verification Approach

- Inner: focused tests — `npm run test -- db core chat-substrate chat-route-transition turn-response app`.
- Middle: persisted resume/projection regression via app tests.
- Gate: `npm run verify` or explicitly document unrelated failures before commit.
